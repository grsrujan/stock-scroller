import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { ArrowUp, ArrowDown, Search, LayoutGrid } from "lucide-react";
import { Link } from "wouter";

function formatMarketCap(n: number | null): string {
  if (n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function formatPercent(n: number | null): string {
  if (n === null || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatVal(v: any): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  if (typeof v === "number") return v.toFixed(2);
  return String(v);
}

export default function WatchlistPage() {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof StockQuote>("marketCap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const stockMap = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(TOP_100_STOCKS)) {
      TOP_100_STOCKS.forEach((s) => map.set(s.symbol.toUpperCase(), s.name));
    }
    return map;
  }, []);

  const symbols = useMemo(() => {
    try {
      const builtIn = Array.isArray(TOP_100_STOCKS) ? TOP_100_STOCKS.map((s) => s.symbol) : [];
      const customRaw = localStorage.getItem("custom-stocks");
      const custom = customRaw ? JSON.parse(customRaw) : [];
      return Array.from(new Set([...builtIn, ...custom]));
    } catch (e) {
      console.error("Error parsing symbols", e);
      return Array.isArray(TOP_100_STOCKS) ? TOP_100_STOCKS.map((s) => s.symbol) : [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (symbols.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchAllQuotes(symbols);
        if (!cancelled) {
          setQuotes(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load market data.");
          setLoading(false);
        }
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols]);

  const sorted = useMemo(() => {
    let list = [...quotes];
    if (search) {
      const q = search.toUpperCase();
      list = list.filter((s) => 
        s.symbol.toUpperCase().includes(q) || 
        (stockMap.get(s.symbol) || "").toUpperCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const res = av > bv ? 1 : -1;
      return sortOrder === "asc" ? res : -res;
    });
  }, [quotes, search, sortKey, sortOrder, stockMap]);

  return (
    <div className="watchlist-page">
      <header className="watchlist-header">
        <div className="watchlist-brand">
          <Link href="/" className="back-link">
            <LayoutGrid size={18} />
            <span>SCROLLER</span>
          </Link>
          <div className="v-divider" />
          <h1>WATCHLIST</h1>
        </div>
        <div className="watchlist-search">
          <Search size={16} className="muted" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="table-container">
        {loading && quotes.length === 0 ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Syncing {symbols.length} stocks...</p>
          </div>
        ) : error ? (
          <div className="loading-state error">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
          </div>
        ) : (
          <table className="watchlist-table">
            <thead>
              <tr>
                <th onClick={() => { setSortKey("symbol"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Symbol</th>
                <th onClick={() => { setSortKey("price"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Price</th>
                <th onClick={() => { setSortKey("changePct"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>% Change</th>
                <th onClick={() => { setSortKey("marketCap"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Market Cap</th>
                <th onClick={() => { setSortKey("floatCap"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Float Cap</th>
                <th onClick={() => { setSortKey("revenue"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Revenue</th>
                <th onClick={() => { setSortKey("profit"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>Net Income</th>
                <th>Div %</th>
                <th>P/B</th>
                <th>P/E</th>
                <th>P/S</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => (
                <tr key={q.symbol}>
                  <td className="sym-cell">
                    <div className="sym-info">
                      <span className="sym-ticker">{q.symbol}</span>
                      <span className="sym-name">{stockMap.get(q.symbol) || "Stock"}</span>
                    </div>
                  </td>
                  <td className="price-cell">${formatVal(q.price)}</td>
                  <td className={`change-cell ${q.changePct >= 0 ? "pos" : "neg"}`}>
                    {formatPercent(q.changePct)}
                  </td>
                  <td>{formatMarketCap(q.marketCap)}</td>
                  <td>{formatMarketCap(q.floatCap)}</td>
                  <td>{formatMarketCap(q.revenue)}</td>
                  <td>{formatMarketCap(q.profit)}</td>
                  <td>{formatVal(q.dividendYieldPct)}%</td>
                  <td>{formatVal(q.pbRatio)}</td>
                  <td>{formatVal(q.peRatio)}</td>
                  <td>{formatVal(q.psRatio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
