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

  // Improved weighting for a denser treemap look
  const getTileStyles = (s: HeatmapStock) => {
    const mcap = s.marketCap || 0;
    let width = 60;
    let height = 50;
    let fontSize = 10;

    if (mcap > 2e12) { // Apple, Microsoft, NVIDIA
      width = 160;
      height = 120;
      fontSize = 16;
    } else if (mcap > 1e12) {
      width = 130;
      height = 100;
      fontSize = 14;
    } else if (mcap > 5e11) {
      width = 100;
      height = 80;
      fontSize = 12;
    } else if (mcap > 2e11) {
      width = 80;
      height = 65;
      fontSize = 11;
    }

    return {
      backgroundColor: getColor(s.changePct),
      width: `${width}px`,
      height: `${height}px`,
      flexGrow: Math.max(1, Math.floor(mcap / 1e10)),
      fontSize: `${fontSize}px`
    };
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
            <p>Syncing market data...</p>
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
              const groupFlex = Math.max(1, Math.floor(sectorMcap / 5e11));

              return (
                <div key={name} className="sector-group" style={{ flexGrow: groupFlex }}>
                  <div className="sector-header">
                    <span className="sector-title">{name}</span>
                    <span className="sector-count">{filtered.length} STOCKS</span>
                  </div>
                  <div className="tiles-container">
                    {filtered
                      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                      .map(s => {
                        const styles = getTileStyles(s);
                        return (
                          <a 
                            key={s.symbol}
                            href={s.exchange ? `https://www.google.com/finance/beta/quote/${s.symbol}:${s.exchange}` : `https://www.google.com/finance/beta/quote/${s.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="stock-tile"
                            style={styles}
                          >
                            <span className="tile-symbol" style={{ fontSize: styles.fontSize }}>{s.symbol}</span>
                            <span className="tile-pct">{s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(1)}%</span>
                            <ExternalLink size={10} className="ext-icon" />
                          </a>
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
