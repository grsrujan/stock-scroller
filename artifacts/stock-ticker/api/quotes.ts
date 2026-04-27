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
const fxPromises = new Map<string, Promise<number>>();

async function getFxRate(from: string): Promise<number> {
  const to = "USD";
  if (!from || from === to) return 1.0;
  const key = `${from}${to}=X`;
  
  const cached = fxCache.get(key);
  if (cached && Date.now() - cached.ts < 3600_000) return cached.rate;

  if (fxPromises.has(key)) return fxPromises.get(key)!;

  const p = (async () => {
    try {
      const q = await yahooFinance.quote(key);
      const rate = q.regularMarketPrice || 1.0;
      fxCache.set(key, { rate, ts: Date.now() });
      return rate;
    } catch {
      return 1.0;
    } finally {
      fxPromises.delete(key);
    }
  })();

  fxPromises.set(key, p);
  return p;
}

const finInFlight = new Set<string>();
const finQueue: string[] = [];
let finActive = 0;
const FIN_MAX_CONCURRENT = 10;

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
    const rate = await getFxRate(currency);

    const convert = (val: any) => (typeof val === "number" ? val * rate : null);

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
      currency: "USD",
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

function getFinancials(sym: string): Financials {
  return financialsCache.get(sym)?.fin ?? { revenue: null, profit: null, liabilityAssetsRatio: null, floatShares: null, pbRatio: null, psRatio: null, currency: "USD" };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const raw = String(req.query["symbols"] ?? "").trim();
    if (!raw) {
      res.status(400).json({ error: "Missing 'symbols' query param" });
      return;
    }
    const symbols = raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 500);

    const cacheKey = symbols.join(",");
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      // Return cached quotes immediately, don't wait for FX or financial refreshes
      scheduleFinancialsLookups(symbols);
      res.json({ asOf: cached.ts, quotes: cached.quotes });
      return;
    }

    const batches = chunk(symbols, 50);
    const results = await Promise.all(
      batches.map((batch) => yahooFinance.quote(batch, {}, { validateResult: false })),
    );
    const flat = results.flat();
    const bySymbol = new Map<string, any>();
    for (const q of flat) {
      if (q && q.symbol) bySymbol.set(q.symbol.toUpperCase(), q);
    }

    const quotes: CachedQuote[] = [];
    for (const sym of symbols) {
      const q = bySymbol.get(sym);
      const fin = getFinancials(sym);
      
      if (!q) {
        quotes.push({ symbol: sym, price: null, currency: "USD", ...fin });
        continue;
      }

      const qRate = await getFxRate(q.currency);
      const price = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || null;
      
      quotes.push({
        symbol: sym,
        price: price ? price * qRate : null,
        change: q.regularMarketChange ? q.regularMarketChange * qRate : null,
        changePercent: q.regularMarketChangePercent || null,
        fiftyTwoHigh: q.fiftyTwoWeekHigh ? q.fiftyTwoWeekHigh * qRate : null,
        fiftyTwoLow: q.fiftyTwoWeekLow ? q.fiftyTwoWeekLow * qRate : null,
        dividendYieldPct: (q.trailingAnnualDividendYield || 0) * 100,
        marketCap: q.marketCap ? q.marketCap * qRate : null,
        peRatio: q.trailingPE || null,
        revenue: fin.revenue,
        profit: fin.profit,
        liabilityAssetsRatio: fin.liabilityAssetsRatio,
        floatCap: fin.floatShares ? fin.floatShares * (price || 0) * qRate : null,
        pbRatio: fin.pbRatio,
        psRatio: fin.psRatio,
        marketState: q.marketState || null,
        currency: "USD",
      });
    }

    cache.set(cacheKey, { ts: now, quotes });
    scheduleFinancialsLookups(symbols);
    res.json({ asOf: now, quotes });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
