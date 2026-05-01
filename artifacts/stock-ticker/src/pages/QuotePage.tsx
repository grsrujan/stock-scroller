import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, ExternalLink, Activity, Calendar, Newspaper, TrendingUp, DollarSign, PieChart, ShieldCheck } from "lucide-react";

type QuoteData = {
  summary: any;
  news: any[];
};

export default function QuotePage() {
  const [, params] = useRoute("/quote/:symbol");
  const symbol = params?.symbol?.toUpperCase() || "";
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      try {
        const resp = await fetch(`/api/quote?symbol=${symbol}`);
        if (!resp.ok) throw new Error("Failed to fetch");
        const json = await resp.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchQuote();
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <div className="quote-page loading">
        <div className="spinner" />
        <p className="loading-text">RETRIEVING DATA FOR {symbol}...</p>
      </div>
    );
  }

  if (!data) return <div className="quote-page">Symbol Not Found</div>;

  const { summary, news } = data;
  const profile = summary.summaryProfile || {};
  const fin = summary.financialData || {};
  const stats = summary.defaultKeyStatistics || {};
  const detail = summary.summaryDetail || {};

  const formatLarge = (n: number | null) => {
    if (!n) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    return n.toLocaleString();
  };

  const formatPct = (n: number | null) => {
    if (n == null) return "—";
    return `${(n * 100).toFixed(2)}%`;
  };

  return (
    <div className="quote-page">
      <header className="quote-header">
        <Link href="/watchlist" className="back-btn">
          <ArrowLeft size={16} />
          <span>BACK TO WATCHLIST</span>
        </Link>
        <div className="quote-title">
          <h1>{symbol}</h1>
          <span className="full-name">{detail.longName || symbol}</span>
        </div>
      </header>

      <div className="quote-grid">
        {/* Profile Card */}
        <div className="quote-card profile">
          <div className="card-header">
            <ShieldCheck size={16} className="gold" />
            <h3>COMPANY PROFILE</h3>
          </div>
          <div className="profile-content">
            <p className="desc">{profile.longBusinessSummary?.slice(0, 400)}...</p>
            <div className="profile-meta">
              <div className="meta-item">
                <span className="label">SECTOR</span>
                <span className="val">{profile.sector || "—"}</span>
              </div>
              <div className="meta-item">
                <span className="label">INDUSTRY</span>
                <span className="val">{profile.industry || "—"}</span>
              </div>
              <div className="meta-item">
                <span className="label">EMPLOYEES</span>
                <span className="val">{profile.fullTimeEmployees?.toLocaleString() || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financials Card */}
        <div className="quote-card stats">
          <div className="card-header">
            <TrendingUp size={16} className="up" />
            <h3>FINANCIAL SUMMARY</h3>
          </div>
          <div className="stats-grid">
            <StatItem label="REVENUE (TTM)" val={formatLarge(fin.totalRevenue)} />
            <StatItem label="GROSS PROFIT" val={formatLarge(fin.grossProfits)} />
            <StatItem label="PROFIT MARGIN" val={formatPct(fin.profitMargins)} className={fin.profitMargins >= 0 ? "pos" : "neg"} />
            <StatItem label="OPERATING MARGIN" val={formatPct(fin.operatingMargins)} className={fin.operatingMargins >= 0 ? "pos" : "neg"} />
            <StatItem label="CASH" val={formatLarge(fin.totalCash)} />
            <StatItem label="TOTAL DEBT" val={formatLarge(fin.totalDebt)} />
            <StatItem label="CURRENT RATIO" val={fin.currentRatio?.toFixed(2) || "—"} />
            <StatItem label="DEBT / EQUITY" val={fin.debtToEquity?.toFixed(2) || "—"} />
          </div>
        </div>

        {/* Valuation Card */}
        <div className="quote-card valuation">
          <div className="card-header">
            <DollarSign size={16} className="gold" />
            <h3>VALUATION</h3>
          </div>
          <div className="stats-grid">
            <StatItem label="MARKET CAP" val={formatLarge(detail.marketCap)} />
            <StatItem label="P/E RATIO (TTM)" val={detail.trailingPE?.toFixed(2) || "—"} />
            <StatItem label="P/S RATIO (TTM)" val={detail.priceToSalesTrailing12Months?.toFixed(2) || "—"} />
            <StatItem label="P/B RATIO" val={stats.priceToBook?.toFixed(2) || "—"} />
            <StatItem label="EV / REVENUE" val={stats.enterpriseToRevenue?.toFixed(2) || "—"} />
            <StatItem label="EV / EBITDA" val={stats.enterpriseToEbitda?.toFixed(2) || "—"} />
            <StatItem label="DIV YIELD" val={formatPct(detail.dividendYield)} />
            <StatItem label="PAYOUT RATIO" val={formatPct(stats.payoutRatio)} />
          </div>
        </div>

        {/* News Card */}
        <div className="quote-card news">
          <div className="card-header">
            <Newspaper size={16} className="muted" />
            <h3>LATEST HEADLINES</h3>
          </div>
          <div className="news-list">
            {news.map((item: any, idx: number) => (
              <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="news-item">
                <div className="news-meta">
                  <span className="source">{item.publisher}</span>
                  <span className="time">{new Date(item.providerPublishTime * 1000).toLocaleDateString()}</span>
                </div>
                <h4 className="news-title">{item.title}</h4>
                <ExternalLink size={12} className="ext-icon" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, val, className = "" }: { label: string; val: string; className?: string }) {
  return (
    <div className="stat-item">
      <span className="stat-label">{label}</span>
      <span className={`stat-val ${className}`}>{val}</span>
    </div>
  );
}
