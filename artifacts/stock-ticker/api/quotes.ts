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
  revenue: number | null;
  profit: number | null;
  marketState: string | null;
  currency: string | null;
};

type CacheEntry = {
  ts: number;
  quotes: CachedQuote[];
};

const CACHE_TTL_MS = 12_000;
const cache = new Map<string, CacheEntry>();

// Revenue / profit are reported quarterly so a 24h cache is plenty.
const FIN_TTL_MS = 24 * 60 * 60 * 1000;
const FIN_RETRY_MS = 60 * 60 * 1000;
type Financials = { revenue: number | null; profit: number | null };
const financialsCache = new Map<string, { fin: Financials; ts: number }>();
const finInFlight = new Set<string>();
const finQueue: string[] = [];
let finActive = 0;
const FIN_MAX_CONCURRENT = 4;

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
      { modules: ["financialData", "defaultKeyStatistics"] },
      { validateResult: false },
    );
    const fd = (summary as { financialData?: { totalRevenue?: number } } | null)?.financialData;
    const ks = (summary as { defaultKeyStatistics?: { netIncomeToCommon?: number } } | null)?.defaultKeyStatistics;
    const revenue = typeof fd?.totalRevenue === "number" ? fd.totalRevenue : null;
    const profit = typeof ks?.netIncomeToCommon === "number" ? ks.netIncomeToCommon : null;
    financialsCache.set(symbol, { fin: { revenue, profit }, ts: Date.now() });
  } catch {
    financialsCache.set(symbol, {
      fin: { revenue: null, profit: null },
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
  return financialsCache.get(sym)?.fin ?? { revenue: null, profit: null };
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
    const patched = cached.quotes.map((q) => {
      const fin = getFinancials(q.symbol);
      return {
        ...q,
        revenue: fin.revenue ?? q.revenue,
        profit: fin.profit ?? q.profit,
      };
    });
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

    const quotes: CachedQuote[] = symbols.map((sym) => {
      const q = bySymbol.get(sym);
      const fin = getFinancials(sym);
      if (!q) {
        return {
          symbol: sym,
          price: null,
          change: null,
          changePercent: null,
          fiftyTwoHigh: null,
          fiftyTwoLow: null,
          dividendYieldPct: null,
          marketCap: null,
          revenue: fin.revenue,
          profit: fin.profit,
          marketState: null,
          currency: null,
        };
      }
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
        price,
        change,
        changePercent,
        fiftyTwoHigh: (q.fiftyTwoWeekHigh as number | undefined) ?? null,
        fiftyTwoLow: (q.fiftyTwoWeekLow as number | undefined) ?? null,
        dividendYieldPct,
        marketCap: (q.marketCap as number | undefined) ?? null,
        revenue: fin.revenue,
        profit: fin.profit,
        marketState: (q.marketState as string | undefined) ?? null,
        currency: (q.currency as string | undefined) ?? null,
      };
    });

    cache.set(cacheKey, { ts: now, quotes });
    scheduleFinancialsLookups(symbols);
    res.json({ asOf: now, quotes });
  } catch (err) {
    console.error("Failed to fetch Yahoo quotes", err);
    if (cached) {
      res.json({ asOf: cached.ts, quotes: cached.quotes, stale: true });
      return;
    }
    res.status(502).json({ error: "Failed to fetch quotes" });
  }
}
