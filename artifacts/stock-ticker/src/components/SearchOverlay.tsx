import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { TOP_100_STOCKS } from "@/data/stocks";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
};

export function SearchOverlay({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const q = query.trim().toUpperCase();
  const results =
    q.length > 0
      ? TOP_100_STOCKS.filter(
          (s) =>
            s.symbol.includes(q) || s.name.toUpperCase().includes(q),
        ).slice(0, 10)
      : [];

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      onSelect(results[activeIdx].symbol);
    }
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-row">
          <Search size={14} className="search-ic" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search symbol or name…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKey}
          />
          <button className="search-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((s, i) => (
              <button
                key={s.symbol}
                className={`search-result ${i === activeIdx ? "active" : ""}`}
                onClick={() => onSelect(s.symbol)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="sr-symbol">{s.symbol}</span>
                <span className="sr-name">{s.name}</span>
                <span className="sr-sector">{s.sector}</span>
              </button>
            ))}
          </div>
        )}
        {q.length > 0 && results.length === 0 && (
          <div className="search-empty">No matches</div>
        )}
        <div className="search-hint">
          <kbd>/</kbd> search &nbsp; <kbd>↑↓</kbd> navigate &nbsp;{" "}
          <kbd>Enter</kbd> jump &nbsp; <kbd>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
