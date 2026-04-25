import { useEffect, useState } from "react";

function useClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function isMarketOpen(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutesUTC = d.getUTCHours() * 60 + d.getUTCMinutes();
  // 13:30 UTC – 20:00 UTC ≈ NYSE 9:30am–4:00pm ET
  return minutesUTC >= 13 * 60 + 30 && minutesUTC < 20 * 60;
}

export function MarketHeader({
  screen,
  screens,
}: {
  screen: number;
  screens: number;
}) {
  const now = useClock();
  const open = isMarketOpen(now);

  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="market-header">
      <div className="brand">
        <div className="brand-mark">
          <span className="brand-dot" />
          <span className="brand-name">PULSE</span>
          <span className="brand-sub">MARKET TAPE</span>
        </div>
        <div className="brand-meta">
          <span className={`status ${open ? "status-open" : "status-closed"}`}>
            <span className="status-dot" />
            {open ? "MARKETS OPEN" : "AFTER HOURS"}
          </span>
          {screens > 1 && (
            <span className="screen-pill">
              SCREEN {screen} / {screens}
            </span>
          )}
        </div>
      </div>
      <div className="clock">
        <div className="time">{time}</div>
        <div className="date">{date}</div>
      </div>
    </header>
  );
}
