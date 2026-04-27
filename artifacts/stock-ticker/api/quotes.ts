// @ts-nocheck
import YahooFinance from "yahoo-finance2";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const yahooFinance = new YahooFinance();

// Minimal fields to stay under 10s and 5MB
type CachedQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  marketCap: number | null;
  peRatio: number | null;
  revenue: number | null;
  profit: number | null;
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYieldPct: number | null;
};

const financialsCache = new Map<string, any>();
const fxCache = new Map<string, number>();

async function getFxRate(from: string): Promise<number> {
  if (!from || from === "USD") return 1.0;
  if (fxCache.has(from)) return fxCache.get(from)!;
  try {
    const q = await yahooFinance.quote(`${from}USD=X`);
    const rate = q.regularMarketPrice || 1.0;
    fxCache.set(from, rate);
    return rate;
  } catch {
    return 1.0;
  }
}

async function fetchFin(symbol: string) {
  if (financialsCache.has(symbol)) return financialsCache.get(symbol);
  try {
    const s = await yahooFinance.quoteSummary(symbol, { modules: ["financialData", "defaultKeyStatistics", "summaryDetail"] });
    const fd = s.financialData || {};
    const ks = s.defaultKeyStatistics || {};
    const sd = s.summaryDetail || {};
    const currency = fd.financialCurrency || "USD";
    const rate = await getFxRate(currency);
    
    const fin = {
      revenue: (fd.totalRevenue || null) ? fd.totalRevenue * rate : null,
      profit: (ks.netIncomeToCommon || null) ? ks.netIncomeToCommon * rate : null,
      floatShares: ks.floatShares || null,
      pbRatio: ks.priceToBook || null,
      psRatio: ks.priceToSalesTrailing12Months || sd.priceToSalesTrailing12Months || null,
    };
    financialsCache.set(symbol, fin);
    return fin;
  } catch {
    return { revenue: null, profit: null, floatShares: null, pbRatio: null, psRatio: null };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const raw = String(req.query["symbols"] || "").trim();
    if (!raw) return res.status(400).json({ error: "No symbols" });
    const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 100);

    const results = await yahooFinance.quote(symbols, {}, { validateResult: false });
    const quotes = await Promise.all(results.map(async (q) => {
      const fin = await fetchFin(q.symbol);
      const rate = await getFxRate(q.currency);
      const price = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0;
      return {
        symbol: q.symbol,
        price: price * rate,
        change: (q.regularMarketChange || 0) * rate,
        changePercent: q.regularMarketChangePercent || 0,
        fiftyTwoHigh: (q.fiftyTwoWeekHigh || 0) * rate,
        fiftyTwoLow: (q.fiftyTwoWeekLow || 0) * rate,
        marketCap: (q.marketCap || 0) * rate,
        peRatio: q.trailingPE || null,
        dividendYieldPct: (q.trailingAnnualDividendYield || 0) * 100,
        revenue: fin.revenue,
        profit: fin.profit,
        floatCap: fin.floatShares ? fin.floatShares * price * rate : null,
        pbRatio: fin.pbRatio,
        psRatio: fin.psRatio,
      };
    }));

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=59");
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
