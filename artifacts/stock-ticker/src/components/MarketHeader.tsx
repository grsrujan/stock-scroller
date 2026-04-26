import { useEffect, useState } from "react";
import { Activity, Clock, Globe, LayoutGrid, List } from "lucide-react";
import { Link, useLocation } from "wouter";

type Props = {
  screen: number;
  screens: number;
};

export function MarketHeader({ screen, screens }: Props) {
  const [time, setTime] = useState(new Date());
  const [location] = useLocation();

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateStr = time.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).toUpperCase();

  return (
    <header className="market-header">
      <div className="brand">
        <Link href="/">
          <div className={`brand-link ${location === "/" ? "active" : ""}`}>
            <LayoutGrid size={14} />
            <span className="brand-name">STOCK SCROLLER</span>
          </div>
        </Link>
        <div className="v-divider" />
        <Link href="/watchlist">
          <div className={`brand-link ${location === "/watchlist" ? "active" : ""}`}>
            <List size={14} />
            <span className="brand-name">WATCHLIST</span>
          </div>
        </Link>
      </div>

      <div className="brand-meta">
        <div className="status">
          <Activity size={10} className="text-up" />
          <span>LIVE MARKET DATA</span>
        </div>
        <div className="v-line" />
        <div className="status">
          <Clock size={10} className="muted" />
          <span>{dateStr}</span>
          <span className="time">{timeStr}</span>
        </div>
        <div className="v-line" />
        <div className="status">
          <Globe size={10} className="muted" />
          <span>GLOBAL NY-LN-TK</span>
        </div>
        {screens > 1 && location === "/" && (
          <>
            <div className="v-line" />
            <div className="screen-indicator">
              SCREEN {screen} OF {screens}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
