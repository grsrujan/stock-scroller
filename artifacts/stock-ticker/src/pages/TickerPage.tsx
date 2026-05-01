import { useEffect, useRef, useState } from "react";
import { MarketHeader } from "@/components/MarketHeader";
import { Ticker } from "@/components/Ticker";
import { ControlBar } from "@/components/ControlBar";
import { SearchOverlay } from "@/components/SearchOverlay";
import { SectorFilter } from "@/components/SectorFilter";
import { CustomStocksModal } from "@/components/CustomStocksModal";

const LS_KEY = "custom-stocks";

function readNumberParam(name: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(name);
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function loadCustomSymbols(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function TickerPage() {
  const [screens, setScreens] = useState<number>(() =>
    readNumberParam("screens", 1, 1, 6),
  );
  const [speed, setSpeed] = useState<number>(() => readNumberParam("speed", 20, 5, 80));
  const [paused, setPaused] = useState<boolean>(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightSymbol, setHighlightSymbol] = useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = useState<Set<string>>(new Set());
  const [customSymbols, setCustomSymbols] = useState<string[]>(loadCustomSymbols);
  const [customModalOpen, setCustomModalOpen] = useState(false);

  const saveCustomSymbols = (syms: string[]) => {
    setCustomSymbols(syms);
    localStorage.setItem(LS_KEY, JSON.stringify(syms));
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("screens", String(screens));
    url.searchParams.set("speed", String(speed));
    window.history.replaceState({}, "", url.toString());
  }, [screens, speed]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (searchOpen || customModalOpen) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        setSpeed((s) => Math.min(80, s + 5));
      } else if (e.key === "-" || e.key === "_") {
        setSpeed((s) => Math.max(5, s - 5));
      } else if (e.key === "Escape" && highlightSymbol) {
        setHighlightSymbol(null);
        setPaused(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, customModalOpen, highlightSymbol]);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  return (
    <div ref={wrapRef} className="ticker-page">
      <div className="grid-bg" aria-hidden="true" />
      <div className="glow-top" aria-hidden="true" />

      <MarketHeader screen={1} screens={screens} />

      <SectorFilter
        active={sectorFilter}
        onChange={setSectorFilter}
        hasCustom={customSymbols.length > 0}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(sym) => {
          setSearchOpen(false);
          setHighlightSymbol(sym);
          setPaused(true);
        }}
      />

      <CustomStocksModal
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        symbols={customSymbols}
        onSave={saveCustomSymbols}
      />

      <main className="ticker-main">
        {screens > 1 ? (
          <div
            className="tile-grid"
            style={{ gridTemplateColumns: `repeat(${screens}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: screens }, (_, i) => i + 1).map((n) => (
              <div key={n} className="tile-col">
                <div className="tile-label">SCREEN {n}</div>
                <div className="tile-track">
                  <Ticker
                    screens={screens}
                    screen={n}
                    speed={speed}
                    paused={paused}
                    highlightSymbol={highlightSymbol}
                    sectorFilter={sectorFilter.size > 0 ? sectorFilter : null}
                    customSymbols={customSymbols}
                  />
                  <div className="fade-top" aria-hidden="true" />
                  <div className="fade-bottom" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Ticker
              screens={1}
              screen={1}
              speed={speed}
              paused={paused}
              highlightSymbol={highlightSymbol}
              sectorFilter={sectorFilter.size > 0 ? sectorFilter : null}
              customSymbols={customSymbols}
            />
            <div className="fade-top" aria-hidden="true" />
            <div className="fade-bottom" aria-hidden="true" />
          </>
        )}
      </main>

      <ControlBar
        paused={paused}
        onTogglePause={() => setPaused(!paused)}
        speed={speed}
        onSpeedChange={setSpeed}
        screens={screens}
        onScreensChange={setScreens}
        onFullscreen={toggleFullscreen}
        onSearch={() => setSearchOpen(true)}
        onCustomStocks={() => setCustomModalOpen(true)}
      />

    </div>
  );
}
