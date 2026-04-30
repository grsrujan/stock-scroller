import { Pause, Play, Maximize2, Gauge, Search, Plus, List, Activity } from "lucide-react";
import { Link } from "wouter";

type Props = {
  paused: boolean;
  onTogglePause: () => void;
  speed: number;
  onSpeedChange: (n: number) => void;
  screens: number;
  onScreensChange: (n: number) => void;
  onFullscreen: () => void;
  onSearch: () => void;
  onCustomStocks: () => void;
};

export function ControlBar({
  paused,
  onTogglePause,
  speed,
  onSpeedChange,
  screens,
  onScreensChange,
  onFullscreen,
  onSearch,
  onCustomStocks,
}: Props) {
  return (
    <div className="control-bar">
      <div className="nav-group">
        <Link href="/watchlist">
          <button className="ctrl-btn" title="Watchlist">
            <List className="ic" />
          </button>
        </Link>
        <Link href="/heatmap">
          <button className="ctrl-btn" title="Market Heatmap">
            <Activity className="ic" />
          </button>
        </Link>
      </div>

      <div className="v-divider" />

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
      </div>

      <button className="ctrl-btn" onClick={onFullscreen} aria-label="Fullscreen">
        <Maximize2 className="ic" />
      </button>
    </div>
  );
}
