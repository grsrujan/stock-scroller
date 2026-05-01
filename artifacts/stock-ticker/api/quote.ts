// @ts-nocheck
import YahooFinance from "yahoo-finance2";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const yahooFinance = new YahooFinance();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const symbol = String(req.query["symbol"] || "").trim().toUpperCase();
  if (!symbol) return res.status(400).json({ error: "No symbol" });

  try {
    // Fetch summary modules + news in parallel
    const [summary, news] = await Promise.all([
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "summaryProfile",
          "summaryDetail",
          "financialData",
          "defaultKeyStatistics",
          "calendarEvents",
          "earnings"
        ]
      }),
      yahooFinance.search(symbol, { newsCount: 5 })
    ]);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.json({
      summary,
      news: news.news || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
