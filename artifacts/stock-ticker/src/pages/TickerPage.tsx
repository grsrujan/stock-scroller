import { useEffect, useRef, useState } from "react";
import { MarketHeader } from "@/components/MarketHeader";
import { Ticker } from "@/components/Ticker";
import { ControlBar } from "@/components/ControlBar";

function readNumberParam(name: string, fallback: number, min: number, max: number): number {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(name);
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function readBoolParam(name: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const v = new URLSearchParams(window.location.search).get(name);
  if (v === null) return fallback;
  return v === "1" || v === "true";
}

export default function TickerPage() {
  const [screens, setScreens] = useState<number>(() =>
    readNumberParam("screens", 1, 1, 6),
  );
  const [screen, setScreen] = useState<number>(() =>
    readNumberParam("screen", 1, 1, 6),
  );
  const [speed, setSpeed] = useState<number>(() => readNumberParam("speed", 80, 20, 220));
  const [paused, setPaused] = useState<boolean>(false);
  const [tile, setTile] = useState<boolean>(() =>
    readBoolParam("tile", readNumberParam("screens", 1, 1, 6) > 1),
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (screen > screens) setScreen(screens);
  }, [screens, screen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("screens", String(screens));
    url.searchParams.set("screen", String(screen));
    url.searchParams.set("speed", String(speed));
    if (tile) url.searchParams.set("tile", "1");
    else url.searchParams.delete("tile");
    window.history.replaceState({}, "", url.toString());
  }, [screens, screen, speed, tile]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        setSpeed((s) => Math.min(220, s + 10));
      } else if (e.key === "-" || e.key === "_") {
        setSpeed((s) => Math.max(20, s - 10));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

      <MarketHeader screen={screen} screens={screens} />

      <ControlBar
        paused={paused}
        onTogglePause={() => setPaused(!paused)}
        speed={speed}
        onSpeedChange={setSpeed}
        screens={screens}
        screen={screen}
        onScreensChange={setScreens}
        onScreenChange={setScreen}
        onFullscreen={toggleFullscreen}
        tile={tile}
        onToggleTile={() => setTile(!tile)}
      />

      <main className="ticker-main">
        {tile && screens > 1 ? (
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
              screens={screens}
              screen={screen}
              speed={speed}
              paused={paused}
            />
            <div className="fade-top" aria-hidden="true" />
            <div className="fade-bottom" aria-hidden="true" />
          </>
        )}
      </main>

    </div>
  );
}
