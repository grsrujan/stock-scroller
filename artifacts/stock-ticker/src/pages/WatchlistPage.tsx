import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { ArrowUp, ArrowDown, Search, LayoutGrid, ChevronsUpDown, Activity } from "lucide-react";
import { Link } from "wouter";
import { SectorFilter } from "@/components/SectorFilter";

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
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());

  const stockMap = useMemo(() => {
    const map = new Map<string, { name: string; sectors: string[] }>();
    if (Array.isArray(TOP_100_STOCKS)) {
      TOP_100_STOCKS.forEach((s) => map.set(s.symbol.toUpperCase(), { name: s.name, sectors: s.sectors }));
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
    return () => { cancelled = true; clearInterval(id); };
  }, [symbols]);

  const sorted = useMemo(() => {
    let list = [...quotes];
    
    // Filter by Search
    if (search) {
      const q = search.toUpperCase();
      list = list.filter((s) => 
        s.symbol.toUpperCase().includes(q) || 
        (stockMap.get(s.symbol)?.name || "").toUpperCase().includes(q)
      );
    }

    // Filter by Sector
    if (selectedSectors.size > 0) {
      list = list.filter((s) => {
        const sectors = stockMap.get(s.symbol)?.sectors || ["Other"];
        return sectors.some(sec => selectedSectors.has(sec));
      });
    }

    // Sort
    return list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const res = av > bv ? 1 : -1;
      return sortOrder === "asc" ? res : -res;
    });
  }, [quotes, search, sortKey, sortOrder, stockMap, selectedSectors]);

  const hasCustom = useMemo(() => {
    const raw = localStorage.getItem("custom-stocks");
    if (!raw) return false;
    try { return JSON.parse(raw).length > 0; } catch { return false; }
  }, []);

  return (
    <div className="watchlist-page">
      <header className="watchlist-header">
        <div className="watchlist-brand">
          <Link href="/" className="back-link">
            <LayoutGrid size={18} />
            <span>SCROLLER</span>
          </Link>
          <div className="v-divider" />
          <Link href="/watchlist" className="back-link active">
            <List size={18} />
            <span>WATCHLIST</span>
          </Link>
          <div className="v-divider" />
          <Link href="/heatmap" className="back-link">
            <Activity size={18} />
            <span>HEATMAP</span>
          </Link>
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

      <SectorFilter 
        active={selectedSectors} 
        onChange={setSelectedSectors} 
        hasCustom={hasCustom}
      />

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
                <th className="sortable" onClick={() => { setSortKey("symbol"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Symbol</span>
                    {sortKey === "symbol" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("price"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Price</span>
                    {sortKey === "price" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("changePct"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>% Change</span>
                    {sortKey === "changePct" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("marketCap"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Market Cap</span>
                    {sortKey === "marketCap" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("floatCap"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Float Cap</span>
                    {sortKey === "floatCap" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("revenue"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Revenue</span>
                    {sortKey === "revenue" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("profit"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Net Income</span>
                    {sortKey === "profit" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("dividendYieldPct"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>Div %</span>
                    {sortKey === "dividendYieldPct" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("pbRatio"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>P/B</span>
                    {sortKey === "pbRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("peRatio"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>P/E</span>
                    {sortKey === "peRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => { setSortKey("psRatio"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}>
                  <div className="th-content">
                    <span>P/S</span>
                    {sortKey === "psRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th>52w Range</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => {
                const rangeFrac = q.fiftyTwoLow != null && q.fiftyTwoHigh != null && q.fiftyTwoHigh > q.fiftyTwoLow
                  ? (q.price - q.fiftyTwoLow) / (q.fiftyTwoHigh - q.fiftyTwoLow)
                  : null;
                
                const nearLow = rangeFrac != null && rangeFrac <= 0.1;
                const nearHigh = rangeFrac != null && rangeFrac >= 0.9;

                return (
                  <tr key={q.symbol} className={`${nearLow ? "near-low" : ""} ${nearHigh ? "near-high" : ""}`}>
                    <td className="sym-cell">
                      <a 
                        href={`https://www.google.com/finance/quote/${q.symbol}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="watchlist-sym-link"
                      >
                        <div className="sym-info">
                          <span className="sym-ticker">{q.symbol}</span>
                          <span className="sym-name">{stockMap.get(q.symbol)?.name || "Stock"}</span>
                        </div>
                        <ExternalLink size={12} className="ext-icon" />
                      </a>
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
                    <td>
                      <div className="range-col-cell">
                        <div className="range-vals">
                          <span>{formatVal(q.fiftyTwoLow)}</span>
                          <span>{formatVal(q.fiftyTwoHigh)}</span>
                        </div>
                        <div className="range-bar mini">
                          {rangeFrac != null && (
                            <div className="range-marker" style={{ left: `${Math.min(100, Math.max(0, rangeFrac * 100))}%` }} />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
