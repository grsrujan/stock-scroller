import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, ExternalLink } from "lucide-react";
import { TOP_100_STOCKS, type Stock } from "@/data/stocks";
import { fetchAllQuotes, type StockQuote } from "@/lib/yahoo";

type LiveQuote = {
  symbol: string;
  name: string;
  sectors: string[];
  price: number;
  prevPrice: number;
  changePct: number;
  fiftyTwoHigh: number | null;
  fiftyTwoLow: number | null;
  dividendYieldPct: number | null;
  marketCap: number | null;
  peRatio: number | null;
  revenue: number | null;
  profit: number | null;
  flash: "up" | "down" | "none";
  flashKey: number;
};

const SECTOR_COLORS: Record<string, string> = {
  "Technology": "#4cc9f0",
  "Semiconductors": "#00f5d4",
  "Cybersecurity": "#f15bb5",
  "China": "#fee440",
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
  "ETFs": "#FFD700",
  "Custom": "#e0e0e0",
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
    sectors: s.sectors,
    price: s.basePrice,
    prevPrice: s.basePrice,
    changePct: 0,
    fiftyTwoHigh: null,
    fiftyTwoLow: null,
    dividendYieldPct: null,
    marketCap: null,
    peRatio: null,
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
      sectors: s.sectors,
      price: nextPrice,
      prevPrice,
      changePct: a?.changePct ?? p?.changePct ?? 0,
      fiftyTwoHigh: a?.fiftyTwoHigh ?? p?.fiftyTwoHigh ?? null,
      fiftyTwoLow: a?.fiftyTwoLow ?? p?.fiftyTwoLow ?? null,
      dividendYieldPct:
        a?.dividendYieldPct ?? p?.dividendYieldPct ?? null,
      marketCap: a?.marketCap ?? p?.marketCap ?? null,
      peRatio: a?.peRatio ?? p?.peRatio ?? null,
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
  highlightSymbol?: string | null;
  sectorFilter?: Set<string> | null;
  customSymbols?: string[];
};

const SECTOR_ORDER = [
  "Technology",
  "Semiconductors",
  "Cybersecurity",
  "China",
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
  "ETFs",
  "Custom",
];

export function Ticker({ screens, screen, speed, paused, highlightSymbol, sectorFilter, customSymbols }: TickerProps) {
  const allStocks = useMemo<Stock[]>(() => {
    const builtIn = [...TOP_100_STOCKS];
    if (customSymbols && customSymbols.length > 0) {
      const existing = new Set(builtIn.map((s) => s.symbol));
      for (const sym of customSymbols) {
        if (!existing.has(sym)) {
          builtIn.push({ symbol: sym, name: sym, sectors: ["Custom"], basePrice: 0 });
        }
      }
    }
    return builtIn.sort((a, b) => {
      // Use the first sector for primary sorting/grouping
      const sA = a.sectors[0] || "Other";
      const sB = b.sectors[0] || "Other";
      const ai = SECTOR_ORDER.indexOf(sA);
      const bi = SECTOR_ORDER.indexOf(sB);
      const ax = ai === -1 ? 999 : ai;
      const bx = bi === -1 ? 999 : bi;
      if (ax !== bx) return ax - bx;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [customSymbols]);

  const slice = useMemo<Stock[]>(() => {
    let list = allStocks;
    if (sectorFilter && sectorFilter.size > 0) {
      list = list.filter((s) => s.sectors.some(sec => sectorFilter.has(sec)));
    }
    if (screens <= 1) return list;
    const total = list.length;
    const per = Math.ceil(total / screens);
    const start = (screen - 1) * per;
    return list.slice(start, start + per);
  }, [screens, screen, allStocks, sectorFilter]);

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
  const tickerInnerRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [hoverPaused, setHoverPaused] = useState(false);
  const effectivePaused = paused || hoverPaused;

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

  // Jump to highlighted symbol
  useEffect(() => {
    if (!highlightSymbol) {
      const el = tickerInnerRef.current;
      if (el) {
        el.style.animation = '';
        el.style.transform = '';
        el.style.transition = '';
      }
      return;
    }
    const el = tickerInnerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const row = el.querySelector(`[data-symbol="${highlightSymbol}"]`) as HTMLElement;
    if (!row) return;

    const computed = getComputedStyle(el);
    const currentTransform = computed.transform;

    el.style.animation = 'none';
    el.style.transform = currentTransform;
    void el.offsetHeight;

    const targetY = Math.min(0, -(row.offsetTop - track.clientHeight * 0.15));
    el.style.transition = 'transform 0.5s ease-out';
    el.style.transform = `translate3d(0, ${targetY}px, 0)`;
  }, [highlightSymbol]);

  return (
    <div
      className="ticker-track"
      ref={trackRef}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
    >
      <div
        ref={tickerInnerRef}
        className="ticker-inner"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: effectivePaused ? "paused" : "running",
        }}
      >
        <div ref={innerRef}>
          {renderRows(quotes, "", highlightSymbol)}
        </div>
        <div aria-hidden="true">
          {renderRows(quotes, "dup-", highlightSymbol)}
        </div>
      </div>
    </div>
  );
}

function renderRows(quotes: LiveQuote[], keyPrefix: string, highlightSymbol?: string | null) {
  const out: ReactNode[] = [];
  let lastSector = "";
  for (const q of quotes) {
    const primarySector = q.sectors[0] || "Other";
    if (primarySector !== lastSector) {
      const sc = sectorColor(primarySector);
      out.push(
        <div
          key={`${keyPrefix}sec-${primarySector}`}
          className="sector-divider"
          style={{
            background: `linear-gradient(90deg, ${sc}33, transparent)`,
            borderLeft: `4px solid ${sc}`,
            color: sc,
          }}
        >
          {primarySector}
        </div>,
      );
      lastSector = primarySector;
    }
    out.push(
      <Row
        key={`${keyPrefix}${q.symbol}`}
        quote={q}
        highlighted={q.symbol === highlightSymbol}
      />,
    );
  }
  return out;
}

function Row({ quote, highlighted }: { quote: LiveQuote; highlighted?: boolean }) {
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

  const primarySector = quote.sectors[0] || "Other";
  const sc = sectorColor(primarySector);

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
      data-symbol={quote.symbol}
      className={`ticker-row ${bg} ${nearLow ? "near-low" : ""} ${nearHigh ? "near-high" : ""} ${highlighted ? "highlighted" : ""}`}
      style={{ borderLeft: `4px solid ${sc}` }}
    >
      <div className="row-left">
        <div className="row-head">
          <a 
            href={`https://www.google.com/finance/quote/${quote.symbol}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="symbol-link"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="symbol">{quote.symbol}</div>
            <ExternalLink size={10} className="ext-icon" />
          </a>
          {quote.sectors.map(sec => {
             const sCol = sectorColor(sec);
             return (
              <div
                key={sec}
                className="sector-pill"
                style={{ color: sCol, borderColor: `${sCol}55`, background: `${sCol}1a` }}
                title={sec}
              >
                {sec}
              </div>
             );
          })}
          {quote.dividendYieldPct != null && quote.dividendYieldPct > 0 && (
            <div className="div-pill" title="Trailing 12-mo dividend yield">
              DIV {quote.dividendYieldPct.toFixed(2)}%
            </div>
          )}
          {quote.peRatio != null && (
            <div className="pe-pill" title="Trailing P/E ratio">
              P/E {quote.peRatio.toFixed(1)}
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
