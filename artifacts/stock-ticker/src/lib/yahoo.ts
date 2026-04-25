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

export async function fetchAllQuotes(symbols: string[]): Promise<StockQuote[]> {
  const url = `${import.meta.env.BASE_URL}api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { quotes: ApiQuote[] } = await res.json();
  return data.quotes.map((q) => ({
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
