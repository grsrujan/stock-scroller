import { useState, useMemo, useEffect } from "react";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";
import { TOP_100_STOCKS } from "@/data/stocks";
import { Search, LayoutGrid, List, ExternalLink, Activity } from "lucide-react";
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
        if (selectedSectors.size > 0) {
          const hasMatch = info.sectors.some(s => selectedSectors.has(s));
          if (!hasMatch) return;
        }

        const primary = info.sectors[0] || "Other";
        if (!map.has(primary)) map.set(primary, []);
        map.get(primary)!.push({ ...q, ...info });
      }
    });

    return Array.from(map.entries()).sort((a, b) => {
      const sumA = a[1].reduce((acc, s) => acc + (s.marketCap || 0), 0);
      const sumB = b[1].reduce((acc, s) => acc + (s.marketCap || 0), 0);
      return sumB - sumA;
    });
  }, [quotes, selectedSectors]);

  const getColor = (pct: number) => {
    if (pct >= 3) return "#00c805";
    if (pct >= 1) return "#008a04";
    if (pct > 0) return "#004d02";
    if (pct === 0) return "#1a1a1a";
    if (pct >= -1) return "#4d0000";
    if (pct >= -3) return "#8a0000";
    return "#ff2e2e";
  };

  const getTileMetrics = (s: HeatmapStock) => {
    const mcap = s.marketCap || 0;
    let width = 70;
    let height = 60;
    let fontSize = 11;

    if (mcap > 2e12) {
      width = 170; height = 140; fontSize = 18;
    } else if (mcap > 1e12) {
      width = 140; height = 110; fontSize = 15;
    } else if (mcap > 5e11) {
      width = 110; height = 90; fontSize = 13;
    } else if (mcap > 2e11) {
      width = 90; height = 75; fontSize = 12;
    }

    return { width, height, fontSize };
  };

  const formatPrice = (p: number) => p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatMcap = (n: number) => {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    return `${(n / 1e6).toFixed(1)}M`;
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
          <Link href="/watchlist" className="back-link">
            <List size={18} />
            <span>WATCHLIST</span>
          </Link>
          <div className="v-divider" />
          <Link href="/heatmap" className="back-link active">
            <Activity size={18} />
            <span>HEATMAP</span>
          </Link>
        </div>
        <div className="watchlist-search">
          <Search size={16} className="muted" />
          <input
            type="text"
            placeholder="Search symbols or sectors..."
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
            <p>Scanning markets...</p>
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

              const sectorMcap = filtered.reduce((acc, s) => acc + (s.marketCap || 0), 0);
              const sectorAvg = filtered.reduce((acc, s) => acc + s.changePct, 0) / filtered.length;
              const groupFlex = Math.max(1, Math.floor(sectorMcap / 5e11));

              return (
                <div key={name} className="sector-group" style={{ flexGrow: groupFlex }}>
                  <div className="sector-header">
                    <div className="sector-meta">
                      <span className="sector-title">{name}</span>
                      <span className={`sector-avg ${sectorAvg >= 0 ? 'pos' : 'neg'}`}>
                        {sectorAvg >= 0 ? '+' : ''}{sectorAvg.toFixed(2)}%
                      </span>
                    </div>
                    <span className="sector-count">{filtered.length} STOCKS</span>
                  </div>
                  <div className="tiles-container">
                    {filtered
                      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                      .map(s => {
                        const dims = getTileMetrics(s);
                        const showPrice = dims.height >= 50;
                        const showCap = dims.height >= 70;

                        return (
                          <div 
                            key={s.symbol}
                            className={`stock-tile ${search && s.symbol.includes(search.toUpperCase()) ? 'search-match' : ''}`}
                            style={{
                              backgroundColor: getColor(s.changePct),
                              width: `${dims.width}px`,
                              height: `${dims.height}px`,
                              flexGrow: Math.max(1, Math.floor((s.marketCap || 0) / 1e10))
                            }}
                          >
                            <a 
                              href={s.exchange ? `https://www.google.com/finance/beta/quote/${s.symbol}:${s.exchange}` : `https://www.google.com/finance/beta/quote/${s.symbol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="symbol-link"
                              style={{ fontSize: dims.fontSize }}
                            >
                              <span className="tile-symbol">{s.symbol}</span>
                            </a>
                            <div className="tile-metrics">
                              <span className="tile-pct">{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(1)}%</span>
                              {showPrice && <span className="tile-price">${formatPrice(s.price)}</span>}
                              {showCap && s.marketCap && <span className="tile-mcap">{formatMcap(s.marketCap)}</span>}
                            </div>
                          </div>
                        );
                      })}
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
