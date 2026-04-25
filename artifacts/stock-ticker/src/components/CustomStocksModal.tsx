import { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  symbols: string[];
  onSave: (symbols: string[]) => void;
};

export function CustomStocksModal({ open, onClose, symbols, onSave }: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const addSymbols = () => {
    const raw = input
      .toUpperCase()
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/[^A-Z0-9.]/g, ""))
      .filter((s) => s.length > 0 && s.length <= 10);
    if (raw.length === 0) return;
    const existing = new Set(symbols);
    const next = [...symbols];
    for (const s of raw) {
      if (!existing.has(s)) {
        next.push(s);
        existing.add(s);
      }
    }
    onSave(next);
    setInput("");
  };

  const remove = (sym: string) => {
    onSave(symbols.filter((s) => s !== sym));
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel custom-panel" onClick={(e) => e.stopPropagation()}>
        <div className="custom-header">
          <span className="custom-title">Custom Stocks</span>
          <button className="search-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="custom-input-row">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Add symbols (e.g. RIVN, SOFI, PLTR)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSymbols();
              if (e.key === "Escape") onClose();
            }}
          />
          <button className="custom-add-btn" onClick={addSymbols}>
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        {symbols.length > 0 ? (
          <div className="custom-list">
            {symbols.map((s) => (
              <div key={s} className="custom-item">
                <span className="custom-sym">{s}</span>
                <button className="custom-rm" onClick={() => remove(s)} title="Remove">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="search-empty">
            No custom stocks yet. Add symbols above — they'll appear in the "Custom" sector and persist in your browser.
          </div>
        )}

        <div className="search-hint">
          Stored in your browser's localStorage. Works with any valid ticker symbol.
        </div>
      </div>
    </div>
  );
}
