import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, getFinanceUrl, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { 
  Search, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUpDown, 
  LayoutGrid, 
  List, 
  Activity, 
  Download,
  Palette,
  Layers
} from "lucide-react";
import { Link } from "wouter";
import { SectorFilter } from "@/components/SectorFilter";

export type ColorTierKey = 
  | "near-low"
  | "lower-range"
  | "mid-range"
  | "upper-range"
  | "near-high";

export interface ColorTier {
  key: ColorTierKey;
  label: string;
  shortLabel: string;
  rank: number;
  bg: string;
  color: string;
  border: string;
}

export const COLOR_TIERS: Record<ColorTierKey, ColorTier> = {
  "near-low": {
    key: "near-low",
    label: "Near 52W Low (≤15%)",
    shortLabel: "Near 52W Low (Red)",
    rank: 1,
    bg: "rgba(255, 77, 109, 0.25)",
    color: "#ff4d6d",
    border: "rgba(255, 77, 109, 0.6)",
  },
  "lower-range": {
    key: "lower-range",
    label: "Lower 52W Range (15%-40%)",
    shortLabel: "Lower Range",
    rank: 2,
    bg: "rgba(255, 122, 198, 0.18)",
    color: "#ff7ac6",
    border: "rgba(255, 122, 198, 0.5)",
  },
  "mid-range": {
    key: "mid-range",
    label: "Mid 52W Range (40%-60%)",
    shortLabel: "Mid Range",
    rank: 3,
    bg: "rgba(255, 255, 255, 0.08)",
    color: "#a0a0a0",
    border: "rgba(255, 255, 255, 0.2)",
  },
  "upper-range": {
    key: "upper-range",
    label: "Upper 52W Range (60%-85%)",
    shortLabel: "Upper Range",
    rank: 4,
    bg: "rgba(122, 229, 173, 0.18)",
    color: "#7ae5ad",
    border: "rgba(122, 229, 173, 0.5)",
  },
  "near-high": {
    key: "near-high",
    label: "Near 52W High (≥85%)",
    shortLabel: "Near 52W High (Green)",
    rank: 5,
    bg: "rgba(43, 209, 126, 0.25)",
    color: "#2bd17e",
    border: "rgba(43, 209, 126, 0.6)",
  },
};

export function get52wRangeFrac(q: StockQuote): number | null {
  if (q.fiftyTwoLow != null && q.fiftyTwoHigh != null && q.fiftyTwoHigh > q.fiftyTwoLow) {
    return (q.price - q.fiftyTwoLow) / (q.fiftyTwoHigh - q.fiftyTwoLow);
  }
  return null;
}

export function get52wColorTier(q: StockQuote): ColorTier {
  const frac = get52wRangeFrac(q);
  if (frac == null) return COLOR_TIERS["mid-range"];
  if (frac <= 0.15) return COLOR_TIERS["near-low"];
  if (frac <= 0.40) return COLOR_TIERS["lower-range"];
  if (frac < 0.60) return COLOR_TIERS["mid-range"];
  if (frac < 0.85) return COLOR_TIERS["upper-range"];
  return COLOR_TIERS["near-high"];
}

const COLOR_TIER_KEYS: ColorTierKey[] = [
  "near-low",
  "lower-range",
  "mid-range",
  "upper-range",
  "near-high",
];

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
  const [sortKey, setSortKey] = useState<keyof StockQuote | "fiftyTwoRange">("marketCap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [selectedColors, setSelectedColors] = useState<Set<ColorTierKey>>(new Set());
  const [groupByColor, setGroupByColor] = useState(false);

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

    // Filter by 52w Range Color
    if (selectedColors.size > 0) {
      list = list.filter((s) => {
        const tier = get52wColorTier(s);
        return selectedColors.has(tier.key);
      });
    }

    // Sort
    return list.sort((a, b) => {
      if (sortKey === "fiftyTwoRange") {
        const fracA = get52wRangeFrac(a);
        const fracB = get52wRangeFrac(b);
        if (fracA === fracB) return 0;
        if (fracA === null || fracA === undefined) return 1;
        if (fracB === null || fracB === undefined) return -1;
        const res = fracA > fracB ? 1 : -1;
        return sortOrder === "asc" ? res : -res;
      }

      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const res = av > bv ? 1 : -1;
      return sortOrder === "asc" ? res : -res;
    });
  }, [quotes, search, sortKey, sortOrder, stockMap, selectedSectors, selectedColors]);

  const colorGroups = useMemo(() => {
    if (!groupByColor) return null;

    const map = new Map<ColorTierKey, StockQuote[]>();
    const tierOrder = sortOrder === "asc" 
      ? COLOR_TIER_KEYS 
      : [...COLOR_TIER_KEYS].reverse();

    tierOrder.forEach(key => map.set(key, []));

    sorted.forEach(q => {
      const tier = get52wColorTier(q);
      map.get(tier.key)?.push(q);
    });

    return Array.from(map.entries())
      .map(([key, items]) => ({
        tier: COLOR_TIERS[key],
        items,
      }))
      .filter(g => g.items.length > 0);
  }, [sorted, groupByColor, sortOrder]);

  const hasCustom = useMemo(() => {
    const raw = localStorage.getItem("custom-stocks");
    if (!raw) return false;
    try { return JSON.parse(raw).length > 0; } catch { return false; }
  }, []);

  const downloadCSV = () => {
    const headers = ["Symbol", "Name", "52W Range Color Tier", "Price", "Change %", "Div Yield %", "Market Cap", "P/E Ratio", "P/B Ratio", "Float Cap"];
    const rows = sorted.map(q => {
      const info = stockMap.get(q.symbol.toUpperCase());
      const tier = get52wColorTier(q);
      return [
        q.symbol,
        `"${info?.name || "Stock"}"`,
        `"${tier.label}"`,
        q.price.toFixed(2),
        q.changePct.toFixed(2),
        q.dividendYieldPct || 0,
        q.marketCap || 0,
        q.peRatio || "",
        q.pbRatio || "",
        q.floatCap || 0
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `alpha-scan-watchlist-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColorFilter = (key: ColorTierKey) => {
    const next = new Set(selectedColors);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedColors(next);
  };

  const handleSort = (key: keyof StockQuote | "fiftyTwoRange") => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const renderRow = (q: StockQuote) => {
    const rangeFrac = get52wRangeFrac(q);
    const nearLow = rangeFrac != null && rangeFrac <= 0.1;
    const nearHigh = rangeFrac != null && rangeFrac >= 0.9;

    return (
      <tr key={q.symbol} className={`${nearLow ? "near-low" : ""} ${nearHigh ? "near-high" : ""}`}>
        <td className="sym-cell">
          {(() => {
            const info = stockMap.get(q.symbol.toUpperCase());
            const financeUrl = getFinanceUrl(q.symbol, q.exchange);
            
            return (
              <div className="sym-info">
                <a 
                  href={financeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="watchlist-sym-link"
                >
                  <span className="sym-ticker">{q.symbol}</span>
                </a>
                <span className="sym-name">{info?.name || "Stock"}</span>
              </div>
            );
          })()}
        </td>
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
        <td className="price-cell">${formatVal(q.price)}</td>
        <td className={`change-cell ${q.changePct >= 0 ? "pos" : "neg"}`}>
          {formatPercent(q.changePct)}
        </td>
        <td>{formatVal(q.dividendYieldPct)}%</td>
        <td>{formatMarketCap(q.marketCap)}</td>
        <td>{formatMarketCap(q.floatCap)}</td>
        <td>{formatMarketCap(q.revenue)}</td>
        <td>{formatMarketCap(q.profit)}</td>
        <td>{formatVal(q.pbRatio)}</td>
        <td>{formatVal(q.peRatio)}</td>
        <td>{formatVal(q.psRatio)}</td>
      </tr>
    );
  };

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
        <div className="watchlist-actions">
          <button 
            className={`group-color-btn ${groupByColor ? "active" : ""}`}
            onClick={() => setGroupByColor(!groupByColor)}
            title="Group watchlist items by 52-week High/Low range color coding"
          >
            <Layers size={16} />
            <span>{groupByColor ? "GROUPED BY 52W COLOR" : "GROUP BY 52W COLOR"}</span>
          </button>
          <div className="watchlist-search">
            <Search size={16} className="muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="export-btn" onClick={downloadCSV} title="Export to CSV">
            <Download size={18} />
            <span>EXPORT</span>
          </button>
        </div>
      </header>

      <div className="filter-controls-container">
        <SectorFilter 
          active={selectedSectors} 
          onChange={setSelectedSectors} 
          hasCustom={hasCustom}
        />

        <div className="color-filter-bar">
          <div className="color-filter-label">
            <Palette size={13} />
            <span>52W COLOR RANGE:</span>
          </div>
          <button
            className={`color-chip ${selectedColors.size === 0 ? "active" : ""}`}
            onClick={() => setSelectedColors(new Set())}
          >
            ALL
          </button>
          {COLOR_TIER_KEYS.map((key) => {
            const tier = COLOR_TIERS[key];
            const active = selectedColors.has(key);
            return (
              <button
                key={key}
                className={`color-chip ${active ? "active" : ""}`}
                style={{
                  borderColor: active ? tier.color : undefined,
                  color: active ? tier.color : undefined,
                  backgroundColor: active ? tier.bg : undefined,
                }}
                onClick={() => toggleColorFilter(key)}
              >
                <span className="color-chip-dot" style={{ backgroundColor: tier.color }} />
                {tier.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

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
                <th className="sortable" onClick={() => handleSort("symbol")}>
                  <div className="th-content">
                    <span>Symbol</span>
                    {sortKey === "symbol" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("fiftyTwoRange")}>
                  <div className="th-content">
                    <Palette size={13} className="header-icon" />
                    <span>52w Range</span>
                    {sortKey === "fiftyTwoRange" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("price")}>
                  <div className="th-content">
                    <span>Price</span>
                    {sortKey === "price" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("changePct")}>
                  <div className="th-content">
                    <span>% Change</span>
                    {sortKey === "changePct" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("dividendYieldPct")}>
                  <div className="th-content">
                    <span>Div %</span>
                    {sortKey === "dividendYieldPct" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("marketCap")}>
                  <div className="th-content">
                    <span>Market Cap</span>
                    {sortKey === "marketCap" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("floatCap")}>
                  <div className="th-content">
                    <span>Float Cap</span>
                    {sortKey === "floatCap" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("revenue")}>
                  <div className="th-content">
                    <span>Revenue</span>
                    {sortKey === "revenue" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("profit")}>
                  <div className="th-content">
                    <span>Net Income</span>
                    {sortKey === "profit" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("pbRatio")}>
                  <div className="th-content">
                    <span>P/B</span>
                    {sortKey === "pbRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("peRatio")}>
                  <div className="th-content">
                    <span>P/E</span>
                    {sortKey === "peRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
                <th className="sortable" onClick={() => handleSort("psRatio")}>
                  <div className="th-content">
                    <span>P/S</span>
                    {sortKey === "psRatio" ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="muted-sort" />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {groupByColor && colorGroups ? (
                colorGroups.map((group) => {
                  const avgFrac = group.items.reduce((sum, item) => sum + (get52wRangeFrac(item) ?? 0.5), 0) / group.items.length;
                  return (
                    <tr key={group.tier.key} className="color-group-section">
                      <td colSpan={12} className="color-group-header-td">
                        <div className="color-group-header">
                          <span 
                            className="color-tier-badge group-header-badge" 
                            style={{ backgroundColor: group.tier.bg, color: group.tier.color, borderColor: group.tier.border }}
                          >
                            <span className="color-tier-dot" style={{ backgroundColor: group.tier.color }} />
                            {group.tier.label}
                          </span>
                          <span className="color-group-meta">
                            <span>{group.items.length} STOCKS</span>
                            <span className="v-divider mini" />
                            <span>AVG 52W RANGE: {(avgFrac * 100).toFixed(0)}%</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ).concat(
                    group.items.map(renderRow) as any
                  );
                })
              ) : (
                sorted.map(renderRow)
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


