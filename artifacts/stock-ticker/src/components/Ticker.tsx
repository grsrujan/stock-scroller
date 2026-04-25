import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TOP_100_STOCKS, type Stock } from "@/data/stocks";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";

type LiveQuote = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  prevPrice: number;
  changePct: number;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  revenue: number | null;
  profit: number | null;
  flash: "up" | "down" | "none";
  flashKey: number;
};

const SECTOR_COLORS: Record<string, string> = {
  "Technology": "#4cc9f0",
  "Communication Services": "#7b8cff",
  "Consumer Discretionary": "#ff7ac6",
  "Consumer Staples": "#9be36b",
  "Health Care": "#41e0b3",
  "Financials": "#ffd166",
  "Industrials": "#f3a261",
  "Energy": "#ff6b3d",
  "Materials": "#c39bff",
  "Real Estate": "#ff9bb3",
  "Utilities": "#6ec1e4",
};

function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? "#888888";
}

function formatPrice(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function placeholderQuotes(stocks: Stock[]): LiveQuote[] {
  return stocks.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector,
    price: s.basePrice,
    prevPrice: s.basePrice,
    changePct: 0,
    fiftyTwoHigh: null,
    fiftyTwoLow: null,
    dividendYieldPct: null,
    marketCap: null,
    revenue: null,
    profit: null,
    flash: "none",
    flashKey: 0,
  }));
}

function mergeQuotes(
  prev: LiveQuote[],
  api: StockQuote[],
  stocks: Stock[],
): LiveQuote[] {
  const apiMap = new Map(api.map((q) => [q.symbol, q]));
  const prevMap = new Map(prev.map((q) => [q.symbol, q]));
  return stocks.map((s) => {
    const p = prevMap.get(s.symbol);
    const a = apiMap.get(s.symbol);
    const prevPrice = p?.price ?? s.basePrice;
    const nextPrice = a?.price ?? prevPrice;
    const dir: "up" | "down" | "none" =
      nextPrice > prevPrice ? "up" : nextPrice < prevPrice ? "down" : "none";
    return {
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      price: nextPrice,
      prevPrice,
      changePct: a?.changePct ?? p?.changePct ?? 0,
      fiftyTwoHigh: a?.fiftyTwoHigh ?? p?.fiftyTwoHigh ?? null,
      fiftyTwoLow: a?.fiftyTwoLow ?? p?.fiftyTwoLow ?? null,
      dividendYieldPct:
        a?.dividendYieldPct ?? p?.dividendYieldPct ?? null,
      marketCap: a?.marketCap ?? p?.marketCap ?? null,
      revenue: a?.revenue ?? p?.revenue ?? null,
      profit: a?.profit ?? p?.profit ?? null,
      flash: p && dir !== "none" ? dir : "none",
      flashKey: (p?.flashKey ?? 0) + (dir !== "none" ? 1 : 0),
    };
  });
}

function formatMarketCap(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

const POLL_MS = 60_000;

type TickerProps = {
  screens: number;
  screen: number;
  speed: number;
  paused: boolean;
};

const SECTOR_ORDER = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Industrials",
  "Energy",
  "Materials",
  "Real Estate",
  "Utilities",
];

const STOCKS_BY_SECTOR: Stock[] = [...TOP_100_STOCKS].sort((a, b) => {
  const ai = SECTOR_ORDER.indexOf(a.sector);
  const bi = SECTOR_ORDER.indexOf(b.sector);
  const ax = ai === -1 ? 999 : ai;
  const bx = bi === -1 ? 999 : bi;
  if (ax !== bx) return ax - bx;
  return a.symbol.localeCompare(b.symbol);
});

export function Ticker({ screens, screen, speed, paused }: TickerProps) {
  const slice = useMemo<Stock[]>(() => {
    if (screens <= 1) return STOCKS_BY_SECTOR;
    const total = STOCKS_BY_SECTOR.length;
    const per = Math.ceil(total / screens);
    const start = (screen - 1) * per;
    return STOCKS_BY_SECTOR.slice(start, start + per);
  }, [screens, screen]);

  const [quotes, setQuotes] = useState<LiveQuote[]>(() => placeholderQuotes(slice));

  useEffect(() => {
    setQuotes(placeholderQuotes(slice));
  }, [slice]);

  useEffect(() => {
    let cancelled = false;
    const symbols = slice.map((s) => s.symbol);

    const tick = async () => {
      try {
        const api = await fetchAllQuotes(symbols);
        if (cancelled) return;
        setQuotes((prev) => mergeQuotes(prev, api, slice));
      } catch {
        // keep showing last known data on transient errors
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slice]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<number>(60);

  useEffect(() => {
    const measure = () => {
      const h = innerRef.current?.scrollHeight ?? 0;
      if (h > 0 && speed > 0) {
        setDuration(h / speed);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [speed, quotes.length]);

  return (
    <div className="ticker-track" ref={trackRef}>
      <div
        className="ticker-inner"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        <div ref={innerRef}>
          {renderRows(quotes, "")}
        </div>
        <div aria-hidden="true">
          {renderRows(quotes, "dup-")}
        </div>
      </div>
    </div>
  );
}

function renderRows(quotes: LiveQuote[], keyPrefix: string) {
  const out: ReactNode[] = [];
  let lastSector = "";
  for (const q of quotes) {
    if (q.sector !== lastSector) {
      const sc = sectorColor(q.sector);
      out.push(
        <div
          key={`${keyPrefix}sec-${q.sector}`}
          className="sector-divider"
          style={{
            background: `linear-gradient(90deg, ${sc}33, transparent)`,
            borderLeft: `4px solid ${sc}`,
            color: sc,
          }}
        >
          {q.sector}
        </div>,
      );
      lastSector = q.sector;
    }
    out.push(<Row key={`${keyPrefix}${q.symbol}`} quote={q} />);
  }
  return out;
}

function Row({ quote }: { quote: LiveQuote }) {
  const up = quote.changePct > 0.0001;
  const down = quote.changePct < -0.0001;
  const color = up ? "text-up" : down ? "text-down" : "text-muted-foreground";
  const bg = up ? "bg-up/8" : down ? "bg-down/8" : "bg-transparent";

  const rangePct =
    quote.fiftyTwoHigh != null &&
    quote.fiftyTwoLow != null &&
    quote.fiftyTwoHigh > quote.fiftyTwoLow
      ? Math.max(
          0,
          Math.min(
            100,
            ((quote.price - quote.fiftyTwoLow) /
              (quote.fiftyTwoHigh - quote.fiftyTwoLow)) *
              100,
          ),
        )
      : null;

  const sc = sectorColor(quote.sector);

  const rangeFrac =
    quote.fiftyTwoLow != null &&
    quote.fiftyTwoHigh != null &&
    quote.fiftyTwoHigh > quote.fiftyTwoLow
      ? (quote.price - quote.fiftyTwoLow) /
        (quote.fiftyTwoHigh - quote.fiftyTwoLow)
      : null;
  const nearLow = rangeFrac != null && rangeFrac <= 0.1;
  const nearHigh = rangeFrac != null && rangeFrac >= 0.9;

  return (
    <div
      className={`ticker-row ${bg} ${nearLow ? "near-low" : ""} ${nearHigh ? "near-high" : ""}`}
      style={{ borderLeft: `4px solid ${sc}` }}
    >
      <div className="row-left">
        <div className="row-head">
          <div className="symbol">{quote.symbol}</div>
          <div
            className="sector-pill"
            style={{ color: sc, borderColor: `${sc}55`, background: `${sc}1a` }}
            title={quote.sector}
          >
            {quote.sector}
          </div>
          {quote.dividendYieldPct != null && quote.dividendYieldPct > 0 && (
            <div className="div-pill" title="Trailing 12-mo dividend yield">
              DIV {quote.dividendYieldPct.toFixed(2)}%
            </div>
          )}
        </div>
        <div className="name">{quote.name}</div>
      </div>

      <div className="row-right">
        <div
          key={`p-${quote.flashKey}`}
          className={`price ${
            quote.flash === "up"
              ? "flash-up"
              : quote.flash === "down"
              ? "flash-down"
              : ""
          }`}
        >
          {formatPrice(quote.price)}
        </div>
        <div className="mcap-stack">
          <div className="mcap" title="Market capitalization">
            {quote.marketCap != null ? formatMarketCap(quote.marketCap) : "—"}
          </div>
          {(quote.revenue != null || quote.profit != null) && (
            <div className="finline">
              {quote.revenue != null && (
                <span className="revenue" title="Trailing 12-month revenue">
                  R&nbsp;{formatMarketCap(quote.revenue)}
                </span>
              )}
              {quote.profit != null && (
                <span
                  className={`profit ${quote.profit >= 0 ? "pos" : "neg"}`}
                  title="Trailing 12-month net income"
                >
                  I&nbsp;{formatMarketCap(quote.profit)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={`change ${color}`}>
          {up ? (
            <ArrowUpRight className="ic" />
          ) : down ? (
            <ArrowDownRight className="ic" />
          ) : (
            <Minus className="ic" />
          )}
          <span>
            {quote.changePct >= 0 ? "+" : ""}
            {quote.changePct.toFixed(2)}%
          </span>
        </div>
      </div>

      {quote.fiftyTwoHigh != null && quote.fiftyTwoLow != null && (
        <div className="range-row">
          <div className="range-end low">L {formatPrice(quote.fiftyTwoLow)}</div>
          <div className="range-bar">
            {rangePct != null && (
              <div className="range-marker" style={{ left: `${rangePct}%` }} />
            )}
          </div>
          <div className="range-end high">H {formatPrice(quote.fiftyTwoHigh)}</div>
        </div>
      )}
    </div>
  );
}
