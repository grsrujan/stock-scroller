import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { ArrowUp, ArrowDown, Search, LayoutGrid } from "lucide-react";
import { Link } from "wouter";

type SortKey = keyof StockQuote;
type SortOrder = "asc" | "desc";

function formatMarketCap(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function formatPercent(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatVal(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toFixed(2);
  return String(v);
}

export default function WatchlistPage() {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");

  const stockMap = useMemo(() => {
    const map = new Map<string, string>();
    TOP_100_STOCKS.forEach((s) => map.set(s.symbol.toUpperCase(), s.name));
    return map;
  }, []);

  const symbols = useMemo(() => {
    const builtIn = TOP_100_STOCKS.map((s) => s.symbol);
    const customRaw = localStorage.getItem("custom-stocks");
    const custom = customRaw ? JSON.parse(customRaw) : [];
    return Array.from(new Set([...builtIn, ...custom]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const data = await fetchAllQuotes(symbols);
        if (!cancelled) {
          setQuotes(data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols]);

  const sorted = useMemo(() => {
    let list = [...quotes];
    if (search) {
      const q = search.toUpperCase();
      list = list.filter((s) => s.symbol.includes(q));
    }
    return list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const res = av > bv ? 1 : -1;
      return sortOrder === "asc" ? res : -res;
    });
  }, [quotes, sortKey, sortOrder, search]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const Header = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="sortable" onClick={() => handleSort(k)}>
      <div className="th-content">
        <span>{label}</span>
        {sortKey === k && (
          sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        )}
      </div>
    </th>
  );

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
            placeholder="Search symbols..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="table-container">
        {loading ? (
          <div className="loading-state">Fetching market data...</div>
        ) : (
          <table className="watchlist-table">
            <thead>
              <tr>
                <Header label="Symbol" k="symbol" />
                <Header label="Price" k="price" />
                <Header label="% Change" k="changePct" />
                <Header label="Market Cap" k="marketCap" />
                <Header label="Float Cap" k="floatCap" />
                <Header label="Revenue" k="revenue" />
                <Header label="Net Income" k="profit" />
                <Header label="Div %" k="dividendYieldPct" />
                <Header label="P/B" k="pbRatio" />
                <Header label="P/E" k="peRatio" />
                <Header label="P/S" k="psRatio" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => (
                <tr key={q.symbol}>
                  <td className="sym-cell">
                    <div className="sym-info">
                      <span className="sym-ticker">{q.symbol}</span>
                      <span className="sym-name">{stockMap.get(q.symbol) || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="price-cell">
                    ${q.price.toFixed(2)}
                  </td>
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
