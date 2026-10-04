import { TOP_100_STOCKS } from "@/data/stocks";

export type ApiQuote = {
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
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  exchange: string | null;
};

export type StockQuote = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  peRatio: number | null;
  revenue: number | null;
  profit: number | null;
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  exchange: string | null;
};

export async function fetchAllQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const CHUNK_SIZE = 40;
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.allSettled(
    chunks.map(async (batch) => {
      const resp = await fetch(`/api/quotes?symbols=${batch.join(",")}`);
      if (!resp.ok) throw new Error(`Chunk failed: ${resp.status}`);
      const data = await resp.json();
      return data.quotes as ApiQuote[];
    }),
  );

  const flat: ApiQuote[] = [];
  for (const res of results) {
    if (res.status === "fulfilled") {
      flat.push(...res.value);
    }
  }

  return flat.map((q) => ({
    symbol: q.symbol,
    price: q.price ?? 0,
    change: q.change ?? 0,
    changePct: q.changePercent ?? 0,
    fiftyTwoHigh: q.fiftyTwoHigh,
    fiftyTwoLow: q.fiftyTwoLow,
    dividendYieldPct: q.dividendYieldPct,
    marketCap: q.marketCap,
    peRatio: q.peRatio,
    revenue: q.revenue,
    profit: q.profit,
    floatCap: q.floatCap,
    pbRatio: q.pbRatio,
    psRatio: q.psRatio,
    exchange: q.exchange,
  }));
}

const KNOWN_ETF_SYMBOLS = new Set<string>(
  TOP_100_STOCKS.filter((s) => s.sectors.includes("ETFs")).map((s) => s.symbol.toUpperCase())
);

export function getFinanceUrl(symbol: string, exchange?: string | null): string {
  if (!symbol) return "#";
  const sym = symbol.trim().toUpperCase();
  let ex = exchange ? exchange.trim().toUpperCase() : "";

  // Known ETF exchange mappings for Google Finance
  const ETF_EXCHANGES: Record<string, string> = {
    "INDA": "NYSEARCA",
    "VIXM": "NYSEARCA",
    "SPY": "NYSEARCA",
    "VOO": "NYSEARCA",
    "IVV": "NYSEARCA",
    "IWM": "NYSEARCA",
    "QQQ": "NASDAQ",
    "SCHD": "NYSEARCA",
    "SCHG": "NYSEARCA",
    "VUG": "NYSEARCA",
    "VTI": "NYSEARCA",
    "XBI": "NYSEARCA",
    "SMH": "NASDAQ",
    "CIBR": "NASDAQ",
    "EEM": "NYSEARCA",
    "TLT": "NASDAQ",
    "JEPQ": "NASDAQ",
    "JEPI": "NYSEARCA",
    "DIA": "NYSEARCA",
    "SPLG": "NYSEARCA",
    "GDX": "NYSEARCA",
    "ICLN": "NASDAQ",
    "IDRV": "NYSEARCA",
    "TAN": "NYSEARCA",
    "XLF": "NYSEARCA",
    "XRT": "NYSEARCA",
    "VYM": "NYSEARCA",
    "ERX": "NYSEARCA",
    "GUSH": "NYSEARCA",
    "SOXL": "NYSEARCA",
    "SPXL": "NYSEARCA",
    "UPRO": "NYSEARCA",
    "SPXU": "NYSEARCA",
    "DFEN": "NYSEARCA",
    "NRGU": "NYSEARCA",
    "YOLO": "NYSEARCA",
    "MJ": "NYSEARCA",
    "IBB": "NASDAQ",
    "QDTE": "NASDAQ",
  };

  if (!ex && ETF_EXCHANGES[sym]) {
    ex = ETF_EXCHANGES[sym];
  }

  // If symbol is an ETF and exchange is not specified, default to NYSEARCA on Google Finance
  if (!ex && KNOWN_ETF_SYMBOLS.has(sym)) {
    ex = "NYSEARCA";
  }

  // If exchange is generic NGM/NMS/NAS, map to NASDAQ; ARCA/PCX to NYSEARCA; NYQ to NYSE
  if (ex === "NGM" || ex === "NMS" || ex === "NAS") ex = "NASDAQ";
  if (ex === "ARCA" || ex === "PCX") ex = "NYSEARCA";
  if (ex === "NYQ") ex = "NYSE";

  // Google Finance URL format: https://www.google.com/finance/quote/SYMBOL:EXCHANGE
  if (ex) {
    return `https://www.google.com/finance/quote/${encodeURIComponent(sym)}:${encodeURIComponent(ex)}`;
  }

  return `https://www.google.com/finance/quote/${encodeURIComponent(sym)}`;
}



