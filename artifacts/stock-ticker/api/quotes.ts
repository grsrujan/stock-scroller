// @ts-nocheck
import YahooFinance from "yahoo-finance2";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const yahooFinance = new YahooFinance();

type CachedQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  peRatio: number | null;
  revenue: number | null;
  profit: number | null;
  liabilityAssetsRatio: number | null;
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  marketState: string | null;
  currency: string | null;
};

type CacheEntry = {
  ts: number;
  quotes: CachedQuote[];
};

const CACHE_TTL_MS = 12_000;
const cache = new Map<string, CacheEntry>();

// Financial metrics reported quarterly/annually
const FIN_TTL_MS = 24 * 60 * 60 * 1000;
const FIN_RETRY_MS = 60 * 60 * 1000;

type Financials = {
  revenue: number | null;
  profit: number | null;
  liabilityAssetsRatio: number | null;
  floatShares: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  currency: string | null;
};

const financialsCache = new Map<string, { fin: Financials; ts: number }>();
const fxCache = new Map<string, { rate: number; ts: number }>();
const fxInFlight = new Set<string>();

const finInFlight = new Set<string>();
const finQueue: string[] = [];
let finActive = 0;
const FIN_MAX_CONCURRENT = 10;

async function getFxRate(from: string): Promise<number> {
  const to = "USD";
  if (from === to) return 1.0;
  const key = `${from}${to}=X`;
  
  const cached = fxCache.get(key);
  if (cached && Date.now() - cached.ts < 3600_000) return cached.rate;

  try {
    const q = await yahooFinance.quote(key);
    const rate = q.regularMarketPrice || 1.0;
    fxCache.set(key, { rate, ts: Date.now() });
    return rate;
  } catch {
    return 1.0;
  }
}

function pumpFinQueue() {
  while (finActive < FIN_MAX_CONCURRENT && finQueue.length > 0) {
    const sym = finQueue.shift()!;
    if (finInFlight.has(sym)) continue;
    finInFlight.add(sym);
    finActive++;
    fetchFinancialsFor(sym).finally(() => {
      finInFlight.delete(sym);
      finActive--;
      pumpFinQueue();
    });
  }
}

async function fetchFinancialsFor(symbol: string): Promise<void> {
  try {
    const summary = await yahooFinance.quoteSummary(
      symbol,
      { modules: ["financialData", "defaultKeyStatistics", "summaryDetail"] },
      { validateResult: false },
    );

    const fd = summary.financialData || {};
    const ks = summary.defaultKeyStatistics || {};
    const sd = summary.summaryDetail || {};

    const currency = fd.financialCurrency || "USD";
    let rate = 1.0;
    if (currency !== "USD") {
      rate = await getFxRate(currency);
    }

    const convert = (val: any) => (typeof val === "number" ? val * rate : null);

    // Liability/Assets Ratio
    let laRatio = null;
    const totalAssets = fd.totalAssets;
    const totalLiabilities = fd.totalLiabilities;
    if (typeof totalAssets === "number" && typeof totalLiabilities === "number" && totalAssets > 0) {
      laRatio = totalLiabilities / totalAssets;
    }

    const fin: Financials = {
      revenue: convert(fd.totalRevenue),
      profit: convert(ks.netIncomeToCommon),
      liabilityAssetsRatio: laRatio,
      floatShares: typeof ks.floatShares === "number" ? ks.floatShares : null,
      pbRatio: typeof ks.priceToBook === "number" ? ks.priceToBook : null,
      psRatio: typeof ks.priceToSalesTrailing12Months === "number" ? ks.priceToSalesTrailing12Months : (typeof sd.priceToSalesTrailing12Months === "number" ? sd.priceToSalesTrailing12Months : null),
      currency: "USD", // We've converted them
    };

    financialsCache.set(symbol, { fin, ts: Date.now() });
  } catch (err) {
    financialsCache.set(symbol, {
      fin: { revenue: null, profit: null, liabilityAssetsRatio: null, floatShares: null, pbRatio: null, psRatio: null, currency: "USD" },
      ts: Date.now() - FIN_TTL_MS + FIN_RETRY_MS,
    });
  }
}

function scheduleFinancialsLookups(symbols: string[]) {
  const now = Date.now();
  for (const sym of symbols) {
    const cached = financialsCache.get(sym);
    if (cached && now - cached.ts < FIN_TTL_MS) continue;
    if (finInFlight.has(sym)) continue;
    if (finQueue.includes(sym)) continue;
    finQueue.push(sym);
  }
  pumpFinQueue();
}

const EMPTY_FIN: Financials = {
  revenue: null,
  profit: null,
  liabilityAssetsRatio: null,
  floatShares: null,
  pbRatio: null,
  psRatio: null,
  currency: "USD",
};

function getFinancials(sym: string): Financials {
  return financialsCache.get(sym)?.fin ?? EMPTY_FIN;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query["symbols"] ?? "").trim();
  if (!raw) {
    res.status(400).json({ error: "Missing 'symbols' query param" });
    return;
  }
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 500);

  const cacheKey = symbols.join(",");
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.ts < CACHE_TTL_MS) {
    const patched = await Promise.all(cached.quotes.map(async (q) => {
      const fin = getFinancials(q.symbol);
      let quoteRate = 1.0;
      if (q.currency && q.currency !== "USD") {
        quoteRate = await getFxRate(q.currency);
      }
      return {
        ...q,
        price: q.price ? q.price * quoteRate : null,
        change: q.change ? q.change * quoteRate : null,
        fiftyTwoHigh: q.fiftyTwoHigh ? q.fiftyTwoHigh * quoteRate : null,
        fiftyTwoLow: q.fiftyTwoLow ? q.fiftyTwoLow * quoteRate : null,
        revenue: fin.revenue ?? q.revenue,
        profit: fin.profit ?? q.profit,
        floatCap: fin.floatShares ? fin.floatShares * (q.price || 0) * quoteRate : q.floatCap,
        marketCap: q.marketCap ? q.marketCap * quoteRate : null,
        currency: "USD",
      };
    }));
    scheduleFinancialsLookups(symbols);
    res.json({ asOf: cached.ts, quotes: patched });
    return;
  }

  try {
    const batches = chunk(symbols, 50);
    const results = await Promise.all(
      batches.map((batch) => yahooFinance.quote(batch, {}, { validateResult: false })),
    );
    const flat = results.flat();
    const bySymbol = new Map<string, (typeof flat)[number]>();
    for (const q of flat) {
      if (q && typeof q.symbol === "string") {
        bySymbol.set(q.symbol.toUpperCase(), q);
      }
    }

    const missingFin = symbols.filter(s => !financialsCache.has(s) && !finInFlight.has(s));
    if (missingFin.length > 0) {
      const toSync = missingFin.slice(0, 5);
      toSync.forEach(sym => finInFlight.add(sym));
      await Promise.all(toSync.map(async (sym) => {
        await fetchFinancialsFor(sym);
        finInFlight.delete(sym);
      }));
    }

    const quotes: CachedQuote[] = await Promise.all(symbols.map(async (sym) => {
      const q = bySymbol.get(sym);
      const fin = getFinancials(sym);

      if (!q) return { symbol: sym, price: null, currency: "USD", ...fin };

      const quoteCurrency = q.currency || "USD";
      const qRate = await getFxRate(quoteCurrency);

      const price =
        (q.regularMarketPrice as number | undefined) ??
        (q.postMarketPrice as number | undefined) ??
        (q.preMarketPrice as number | undefined) ??
        null;
      const change =
        (q.regularMarketChange as number | undefined) ??
        (q.postMarketChange as number | undefined) ??
        null;
      const changePercent =
        (q.regularMarketChangePercent as number | undefined) ??
        (q.postMarketChangePercent as number | undefined) ??
        null;

      const trailingDivYield = q.trailingAnnualDividendYield as number | undefined;
      const dividendYieldPct = typeof trailingDivYield === "number" ? trailingDivYield * 100 : 0;

      return {
        symbol: sym,
        price: price ? price * qRate : null,
        change: change ? change * qRate : null,
        changePercent,
        fiftyTwoHigh: q.fiftyTwoWeekHigh ? q.fiftyTwoWeekHigh * qRate : null,
        fiftyTwoLow: q.fiftyTwoWeekLow ? q.fiftyTwoWeekLow * qRate : null,
        dividendYieldPct,
        marketCap: q.marketCap ? q.marketCap * qRate : null,
        peRatio: (q.trailingPE as number | undefined) ?? null,
        revenue: fin.revenue,
        profit: fin.profit,
        liabilityAssetsRatio: fin.liabilityAssetsRatio,
        floatCap: fin.floatShares ? fin.floatShares * (price || 0) * qRate : null,
        pbRatio: fin.pbRatio,
        psRatio: fin.psRatio,
        marketState: (q.marketState as string | undefined) ?? null,
        currency: "USD",
      };
    }));

    cache.set(cacheKey, { ts: now, quotes });
    scheduleFinancialsLookups(symbols);
    res.json({ asOf: now, quotes });
  } catch (err) {
    console.error("Failed to fetch Yahoo quotes", err);
    res.status(502).json({ error: "Failed to fetch quotes" });
  }
}
