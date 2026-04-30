import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { Search, LayoutGrid } from "lucide-react";
import { Link } from "wouter";
import { SectorFilter } from "@/components/SectorFilter";

type HeatmapStock = StockQuote & { name: string; sectors: string[] };

export default function HeatmapPage() {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());

  const symbols = useMemo(() => {
    const builtIn = TOP_100_STOCKS.map((s) => s.symbol);
    return Array.from(new Set(builtIn));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbols]);

  const groupedSectors = useMemo(() => {
    const map = new Map<string, HeatmapStock[]>();
    const stockInfo = new Map<string, { name: string; sectors: string[] }>();
    TOP_100_STOCKS.forEach(s => stockInfo.set(s.symbol, { name: s.name, sectors: s.sectors }));

    quotes.forEach(q => {
      const info = stockInfo.get(q.symbol);
      if (info) {
        // Filter by Sector Tags
        if (selectedSectors.size > 0) {
          const hasMatch = info.sectors.some(s => selectedSectors.has(s));
          if (!hasMatch) return;
        }

        // Group by primary sector (first in list)
        const primary = info.sectors[0] || "Other";
        if (!map.has(primary)) map.set(primary, []);
        map.get(primary)!.push({ ...q, ...info });
      }
    });

    // Sort sectors by total market cap
    return Array.from(map.entries()).sort((a, b) => {
      const sumA = a[1].reduce((acc, s) => acc + (s.marketCap || 0), 0);
      const sumB = b[1].reduce((acc, s) => acc + (s.marketCap || 0), 0);
      return sumB - sumA;
    });
  }, [quotes, selectedSectors]);

  const getColor = (pct: number) => {
    if (pct >= 3) return "#00c805"; // Bright Green
    if (pct >= 1) return "#008a04"; // Med Green
    if (pct > 0) return "#004d02";  // Dark Green
    if (pct === 0) return "#1a1a1a"; // Neutral
    if (pct >= -1) return "#4d0000"; // Dark Red
    if (pct >= -3) return "#8a0000"; // Med Red
    return "#ff2e2e"; // Bright Red
  };

  const getWeight = (cap: number | null) => {
    if (!cap) return 1;
    // Log scale for weights to keep boxes readable
    return Math.max(1, Math.log10(cap / 1e6) * 10);
  };

  return (
    <div className="heatmap-page">
      <header className="watchlist-header">
        <div className="watchlist-brand">
          <Link href="/" className="back-link">
            <LayoutGrid size={18} />
            <span>SCROLLER</span>
          </Link>
          <div className="v-divider" />
          <h1>MARKET SENTIMENT</h1>
        </div>
        <div className="watchlist-search">
          <Search size={16} className="muted" />
          <input
            type="text"
            placeholder="Search sectors or stocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <SectorFilter 
        active={selectedSectors} 
        onChange={setSelectedSectors} 
        hasCustom={false}
      />

      <div className="heatmap-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Generating Heatmap for {symbols.length} stocks...</p>
          </div>
        ) : (
          <div className="sectors-grid">
            {groupedSectors.map(([name, stocks]) => {
              const filtered = stocks.filter(s => 
                s.symbol.includes(search.toUpperCase()) || 
                s.name.toUpperCase().includes(search.toUpperCase()) ||
                name.toUpperCase().includes(search.toUpperCase())
              );
              if (filtered.length === 0) return null;

              return (
                <div key={name} className="sector-group">
                  <div className="sector-header">
                    <span className="sector-title">{name}</span>
                    <span className="sector-count">{filtered.length} STOCKS</span>
                  </div>
                  <div className="tiles-container">
                    {filtered
                      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                      .map(s => (
                        <div 
                          key={s.symbol}
                          className="stock-tile"
                          style={{
                            backgroundColor: getColor(s.changePct),
                            flexGrow: getWeight(s.marketCap),
                            minWidth: s.marketCap && s.marketCap > 1e11 ? '80px' : '40px',
                            minHeight: s.marketCap && s.marketCap > 1e11 ? '60px' : '40px',
                          }}
                        >
                          <span className="tile-symbol">{s.symbol}</span>
                          <span className="tile-pct">{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
