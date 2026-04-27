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
  liabilityAssetsRatio: number | null;
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  currency: string | null;
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
  liabilityAssetsRatio: number | null;
  floatCap: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  currency: string | null;
};

export async function fetchAllQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (symbols.length === 0) return [];
  const CHUNK_SIZE = 40; // Smaller chunks for better stability
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  // Use allSettled to ensure some data loads even if some chunks fail
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
    } else {
      console.error("Watchlist chunk fetch error:", res.reason);
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
    liabilityAssetsRatio: q.liabilityAssetsRatio,
    floatCap: q.floatCap,
    pbRatio: q.pbRatio,
    psRatio: q.psRatio,
    currency: q.currency,
  }));
}
