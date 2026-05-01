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
  exchange: string | null;
};

const financialsCache = new Map<string, any>();
const fxCache = new Map<string, number>();

async function getFxRate(from: string): Promise<number> {
  if (!from || from === "USD") return 1.0;
  const key = from.toUpperCase();
  if (fxCache.has(key)) return fxCache.get(key)!;
  try {
    const q = await yahooFinance.quote(`${key}USD=X`);
    const rate = q.regularMarketPrice || 1.0;
    fxCache.set(key, rate);
    return rate;
  } catch {
    return 1.0;
  }
}

async function fetchFin(symbol: string) {
  if (financialsCache.has(symbol)) return financialsCache.get(symbol);
  try {
    const s = await yahooFinance.quoteSummary(symbol, { 
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail"] 
    });
    const fd = s.financialData || {};
    const ks = s.defaultKeyStatistics || {};
    const sd = s.summaryDetail || {};
    
    // Financial currency vs Trading currency
    const finCurrency = fd.financialCurrency || "USD";
    const rate = await getFxRate(finCurrency);
    
    // Float percentage is safer for ADRs than raw share counts
    let floatRatio = 1.0;
    if (ks.floatShares && ks.sharesOutstanding) {
      floatRatio = ks.floatShares / ks.sharesOutstanding;
    } else if (ks.heldPercentInsiders != null) {
      floatRatio = 1 - ks.heldPercentInsiders;
    }

    const fin = {
      revenue: (fd.totalRevenue || null) ? fd.totalRevenue * rate : null,
      profit: (ks.netIncomeToCommon || null) ? ks.netIncomeToCommon * rate : null,
      floatRatio: floatRatio,
      pbRatio: ks.priceToBook || null,
      psRatio: ks.priceToSalesTrailing12Months || sd.priceToSalesTrailing12Months || null,
      // Fallback for dividend yield as Yahoo fields vary wildly for ADRs
      dividendYield: sd.dividendYield || ks.yield || sd.trailingAnnualDividendYield || null
    };
    financialsCache.set(symbol, fin);
    return fin;
  } catch {
    return { revenue: null, profit: null, floatRatio: 1.0, pbRatio: null, psRatio: null, dividendYield: null };
  }
}

function cleanExchange(ex: string): string {
  if (!ex) return "";
  const u = ex.toUpperCase();
  
  // US MARKETS
  if (u.includes("NAS") || u === "NGM" || u === "NMS" || u === "NMQ") return "NASDAQ";
  if (u.includes("NYS") || u === "NYQ" || u === "ASE" || u === "AMEX") return "NYSE";
  if (u.includes("ARCA")) return "NYSEARCA";
  if (u.includes("OTC") || u === "PNK" || u === "OBB") return "OTCMKTS";
  
  // INTERNATIONAL MARKETS
  if (u === "TOR" || u === "TSE" || u === "TSX") return "TSE"; // Toronto
  if (u === "LSE" || u === "LON") return "LON"; // London
  if (u === "BOM" || u === "NSE") return "NSE"; // India
  if (u === "HKG" || u === "HKEX") return "HKG"; // Hong Kong
  if (u === "TYO" || u === "TSEJ") return "TYO"; // Tokyo
  if (u === "ASX") return "ASX"; // Australia
  if (u === "FRA" || u === "GER") return "FRA"; // Frankfurt
  
  return u; // Return original if not mapped but cleaned
}

function cleanSymbol(sym: string): string {
  if (!sym) return "";
  // Strip Yahoo suffixes (e.g., AAPL.N -> AAPL, RY.TO -> RY, BP.L -> BP)
  return sym.split(".")[0].toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const raw = String(req.query["symbols"] || "").trim();
    if (!raw) return res.status(400).json({ error: "No symbols" });
    const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 100);

    const results = await yahooFinance.quote(symbols, {}, { validateResult: false });
    
    const quotes = await Promise.all(results.map(async (q) => {
      const fin = await fetchFin(q.symbol);
      const tradeRate = await getFxRate(q.currency);
      
      const price = q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0;
      const mcapUsd = (q.marketCap || 0) * tradeRate;
      
      // Handle yield conversion
      let yieldPct = fin.dividendYield;
      if (yieldPct === null) {
        yieldPct = q.trailingAnnualDividendYield || 0;
      }
      if (yieldPct > 0 && yieldPct < 1.0) {
         yieldPct *= 100;
      }

      return {
        symbol: cleanSymbol(q.symbol),
        exchange: cleanExchange(q.fullExchangeName || q.exchange || ""),
        price: price * tradeRate,
        change: (q.regularMarketChange || 0) * tradeRate,
        changePercent: q.regularMarketChangePercent || 0,
        fiftyTwoHigh: (q.fiftyTwoWeekHigh || 0) * tradeRate,
        fiftyTwoLow: (q.fiftyTwoWeekLow || 0) * tradeRate,
        marketCap: mcapUsd,
        peRatio: q.trailingPE || null,
        dividendYieldPct: yieldPct,
        revenue: fin.revenue,
        profit: fin.profit,
        floatCap: mcapUsd * fin.floatRatio,
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
