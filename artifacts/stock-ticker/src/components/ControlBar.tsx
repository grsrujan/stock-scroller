import { Pause, Play, Maximize2, Gauge, Columns3, Square, Search, Plus } from "lucide-react";

type Props = {
  paused: boolean;
  onTogglePause: () => void;
  speed: number;
  onSpeedChange: (n: number) => void;
  screens: number;
  screen: number;
  onScreensChange: (n: number) => void;
  onScreenChange: (n: number) => void;
  onFullscreen: () => void;
  tile: boolean;
  onToggleTile: () => void;
  onSearch: () => void;
  onCustomStocks: () => void;
};

export function ControlBar({
  paused,
  onTogglePause,
  speed,
  onSpeedChange,
  screens,
  screen,
  onScreensChange,
  onScreenChange,
  onFullscreen,
  tile,
  onToggleTile,
  onSearch,
  onCustomStocks,
}: Props) {
  return (
    <div className="control-bar">
      <button className="ctrl-btn" onClick={onTogglePause} aria-label="Play/Pause">
        {paused ? <Play className="ic" /> : <Pause className="ic" />}
      </button>

      <button className="ctrl-btn" onClick={onSearch} aria-label="Search" title="Search (/)">
        <Search className="ic" />
      </button>

      <button className="ctrl-btn" onClick={onCustomStocks} aria-label="Custom Stocks" title="Add custom stocks">
        <Plus className="ic" />
      </button>

      <div className="ctrl-group">
        <Gauge className="ic muted" />
        <input
          type="range"
          min={5}
          max={80}
          step={5}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          aria-label="Scroll speed"
        />
        <span className="ctrl-value">{speed}px/s</span>
      </div>

      <div className="ctrl-group">
        <span className="ctrl-label">Screens</span>
        <select
          value={screens}
          onChange={(e) => onScreensChange(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {screens > 1 && !tile && (
          <>
            <span className="ctrl-label">This is</span>
            <select
              value={screen}
              onChange={(e) => onScreenChange(Number(e.target.value))}
            >
              {Array.from({ length: screens }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Screen {n}
                </option>
              ))}
            </select>
          </>
        )}
        {screens > 1 && (
          <button
            className={`ctrl-toggle ${tile ? "on" : ""}`}
            onClick={onToggleTile}
            aria-label="Toggle tile view"
            title={tile ? "Show single screen" : "Show all screens side by side"}
          >
            {tile ? <Square className="ic" /> : <Columns3 className="ic" />}
            <span>{tile ? "Single" : "Tile all"}</span>
          </button>
        )}
      </div>

      <button className="ctrl-btn" onClick={onFullscreen} aria-label="Fullscreen">
        <Maximize2 className="ic" />
      </button>
    </div>
  );
}
