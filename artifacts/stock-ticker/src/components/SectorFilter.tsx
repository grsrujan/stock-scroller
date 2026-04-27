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
  "ETFs",
  "Custom",
];

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
  "ETFs": "#FFD700",
  "Custom": "#e0e0e0",
};

const SHORT: Record<string, string> = {
  "Technology": "Tech",
  "Communication Services": "Comm",
  "Consumer Discretionary": "Disc",
  "Consumer Staples": "Staple",
  "Health Care": "Health",
  "Financials": "Fin",
  "Industrials": "Indust",
  "Energy": "Energy",
  "Materials": "Mat",
  "Real Estate": "REIT",
  "Utilities": "Util",
  "ETFs": "ETF",
  "Custom": "Custom",
};

type Props = {
  active: Set<string>;
  onChange: (sectors: Set<string>) => void;
  hasCustom: boolean;
};

export function SectorFilter({ active, onChange, hasCustom }: Props) {
  const sectors = hasCustom ? SECTOR_ORDER : SECTOR_ORDER.filter((s) => s !== "Custom");
  const allActive = active.size === 0;

  const toggle = (sector: string) => {
    const next = new Set(active);
    if (next.has(sector)) {
      next.delete(sector);
    } else {
      next.add(sector);
    }
    onChange(next);
  };

  return (
    <div className="sector-filter-bar">
      <button
        className={`sector-chip ${allActive ? "active" : ""}`}
        onClick={() => onChange(new Set())}
      >
        ALL
      </button>
      {sectors.map((s) => {
        const c = SECTOR_COLORS[s] ?? "#888";
        const on = active.has(s);
        return (
          <button
            key={s}
            className={`sector-chip ${on ? "active" : ""}`}
            style={{
              borderColor: on ? c : undefined,
              color: on ? c : undefined,
              background: on ? `${c}18` : undefined,
            }}
            onClick={() => toggle(s)}
            title={s}
          >
            {SHORT[s] ?? s}
          </button>
        );
      })}
    </div>
  );
}
