import { useEffect, useState } from "react";
import { Activity, Clock, Globe } from "lucide-react";

type Props = {
  screen: number;
  screens: number;
};

export function MarketHeader({ screen, screens }: Props) {
  const [time, setTime] = useState(new Date());

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
        <div className="brand-mark">
          <div className="brand-dot" />
          <span className="brand-name">STOCK SCROLLER</span>
        </div>
        <div className="brand-sub">WATCHLIST | TOP GAINERS | TOP LOSERS</div>
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
        {screens > 1 && (
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
