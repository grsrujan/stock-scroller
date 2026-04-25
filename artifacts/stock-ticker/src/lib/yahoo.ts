export type StockQuote = {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  revenue: number | null;
  profit: number | null;
};

type ApiQuote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  revenue: number | null;
  profit: number | null;
};

const CHUNK_SIZE = 50;

export async function fetchAllQuotes(symbols: string[]): Promise<StockQuote[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `${import.meta.env.BASE_URL}api/quotes?symbols=${encodeURIComponent(chunk.join(","))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { quotes: ApiQuote[] } = await res.json();
      return data.quotes;
    }),
  );

  return results.flat().map((q) => ({
    symbol: q.symbol,
    price: q.price,
    prevClose: null,
    changePct: q.changePercent,
    fiftyTwoHigh: q.fiftyTwoHigh,
    fiftyTwoLow: q.fiftyTwoLow,
    dividendYieldPct: q.dividendYieldPct,
    marketCap: q.marketCap,
    revenue: q.revenue,
    profit: q.profit,
  }));
}
