import {
  TrendingUp,
  Activity,
  Waves,
  ArrowUpDown,
  BarChart3,
  Tag,
  Percent,
  Sprout,
  Landmark,
  Coins,
  Users,
  CalendarClock,
  Link2,
  LineChart,
  Flame,
  RefreshCw,
  ShieldAlert,
  PieChart,
  Sunrise,
  Sunset,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

/**
 * Single source of truth for the Scheduled Report configuration model.
 * Shared by the Report tab (app/(tabs)/report.tsx) and the onboarding flow,
 * so onboarding selections map exactly onto the Report builder.
 */

/* group accents */
export const TECH = { c: "#5B4FE6", bg: "#ECEAFB" };
export const FUND = { c: "#0E9384", bg: "#E3F6F2" };
export const MACRO = { c: "#D97706", bg: "#FDF0DD" };

export type ReportId = "open" | "close";
export type ReportDef = {
  id: ReportId;
  name: string;
  blurb: string;
  time: string;
  freq: string;
  tz: string;
  icon: LucideIcon;
  c: string;
  bg: string;
  band: readonly [string, string];
  fires: string;
};

/* per-report identity */
export const REPORTS: Record<ReportId, ReportDef> = {
  open: { id: "open", name: "Opening Bell", blurb: "Before the open", time: "6:30 AM", freq: "Weekdays", tz: "America/New_York", icon: Sunrise, c: "#D97706", bg: "#FDF0DD", band: ["#7C2D12", "#F59E0B"], fires: "before the open" },
  close: { id: "close", name: "Closing Bell", blurb: "After the close", time: "4:15 PM", freq: "Weekdays", tz: "America/New_York", icon: Sunset, c: "#5B4FE6", bg: "#ECEAFB", band: ["#1F2544", "#5B4FE6"], fires: "after the close" },
};

export type Metric = { id: string; label: string };
const M = (id: string, label: string): Metric => ({ id, label });

export type Module = {
  id: string;
  label: string;
  icon: LucideIcon;
  q: string;
  src: string;
  metrics: Metric[];
};
export type Group = {
  id: string;
  label: string;
  sub: string;
  accent: { c: string; bg: string };
  modules: Module[];
};

export const GROUPS: Group[] = [
  {
    id: "technical",
    label: "Technical",
    sub: "Price action & chart structure",
    accent: TECH,
    modules: [
      { id: "trend", label: "Trend", icon: TrendingUp, q: "Is it bullish? Above its 200-day? Golden cross?", src: "history · 6mo", metrics: [M("ma_50", "MA 50"), M("ma_200", "MA 200"), M("trend_50d", "50d trend"), M("trend_200d", "200d trend"), M("golden_cross", "Golden cross")] },
      { id: "momentum", label: "Momentum", icon: Activity, q: "Overbought? Losing momentum?", src: "history · 6mo", metrics: [M("rsi_14", "RSI 14"), M("macd", "MACD"), M("pc_1d", "Δ 1d"), M("pc_1w", "Δ 1w"), M("pc_1m", "Δ 1m"), M("roc", "ROC")] },
      { id: "volatility", label: "Volatility", icon: Waves, q: "How volatile is it? Max drawdown this year?", src: "history · 1y", metrics: [M("atr_14", "ATR 14"), M("bbands", "Bollinger"), M("hv_30", "Hist vol 30d"), M("drawdown", "Drawdown")] },
      { id: "levels", label: "Levels", icon: ArrowUpDown, q: "Near its 52-week high? Key support?", src: "history · 1y", metrics: [M("high_52w", "52w high"), M("low_52w", "52w low"), M("support", "Support"), M("resistance", "Resistance"), M("pct_high", "% from high")] },
      { id: "volume", label: "Volume", icon: BarChart3, q: "Unusual volume? Confirming the move?", src: "history · 3mo", metrics: [M("vol_latest", "Latest"), M("vol_avg30", "Avg 30d"), M("vol_spike", "Spike")] },
    ],
  },
  {
    id: "fundamental",
    label: "Fundamental",
    sub: "Financials & analyst view",
    accent: FUND,
    modules: [
      { id: "valuation", label: "Valuation", icon: Tag, q: "Cheap vs peers? Overvalued?", src: "info", metrics: [M("trailingPE", "Trailing P/E"), M("forwardPE", "Fwd P/E"), M("peg", "PEG"), M("ps", "P/S"), M("pb", "P/B"), M("evEbitda", "EV/EBITDA"), M("evRev", "EV/Rev")] },
      { id: "profitability", label: "Profitability", icon: Percent, q: "How profitable? Margin trend?", src: "info", metrics: [M("profitMargin", "Profit margin"), M("grossMargin", "Gross margin"), M("opMargin", "Op margin"), M("roe", "ROE"), M("roa", "ROA")] },
      { id: "growth", label: "Growth", icon: Sprout, q: "Is it growing? Revenue trajectory?", src: "info + income", metrics: [M("revGrowth", "Rev growth"), M("epsGrowth", "EPS growth"), M("revSeries", "Rev series"), M("niSeries", "Net income"), M("epsTrend", "EPS trend")] },
      { id: "health", label: "Financial health", icon: Landmark, q: "Balance sheet healthy? Too much debt?", src: "info + balance", metrics: [M("de", "Debt/Equity"), M("current", "Current ratio"), M("quick", "Quick ratio"), M("fcf", "Free cashflow"), M("cash", "Total cash"), M("debt", "Total debt")] },
      { id: "dividend", label: "Dividend", icon: Coins, q: "Is the dividend safe? Yield vs history?", src: "info", metrics: [M("divYield", "Yield"), M("divRate", "Rate"), M("payout", "Payout ratio"), M("avgYield5", "5y avg yield")] },
      { id: "analyst", label: "Analyst", icon: Users, q: "What do analysts think? Price target?", src: "info + ratings", metrics: [M("recMean", "Rec. mean"), M("target", "Target price"), M("upside", "Upside %"), M("upgrades", "Up/downgrades")] },
      { id: "earnings", label: "Earnings event", icon: CalendarClock, q: "When does it report? Beat last quarter?", src: "calendar", metrics: [M("nextDate", "Next date"), M("beatMiss", "Beat / miss")] },
    ],
  },
  {
    id: "macro",
    label: "Macroeconomic",
    sub: "Rates, cycle & regime",
    accent: MACRO,
    modules: [
      { id: "sensitivity", label: "Market sensitivity", icon: Link2, q: "How sensitive is it to the market?", src: "history · 3mo", metrics: [M("beta", "Beta"), M("corrSpx", "Corr S&P"), M("corrNdx", "Corr Nasdaq"), M("corrDow", "Corr Dow")] },
      { id: "rates", label: "Rates", icon: LineChart, q: "How do rate cuts affect it? Curve inverted?", src: "FRED + ^TNX", metrics: [M("fedFunds", "Fed funds"), M("dgs10", "10Y"), M("dgs2", "2Y"), M("spread", "10Y–2Y"), M("tnx", "TNX trend")] },
      { id: "inflation", label: "Inflation", icon: Flame, q: "Is inflation a headwind?", src: "FRED", metrics: [M("cpi", "CPI"), M("coreCpi", "Core CPI"), M("breakeven", "10y breakeven")] },
      { id: "cycle", label: "Growth cycle", icon: RefreshCw, q: "Where are we in the economic cycle?", src: "FRED", metrics: [M("gdp", "GDP"), M("unrate", "Unemployment"), M("payems", "Payrolls"), M("indpro", "Ind. production"), M("umcsent", "Sentiment")] },
      { id: "regime", label: "Risk regime", icon: ShieldAlert, q: "Risk-on or risk-off? Dollar headwind?", src: "yfinance", metrics: [M("vix", "VIX"), M("dxy", "Dollar index"), M("oil", "Oil"), M("gold", "Gold")] },
      { id: "rotation", label: "Sector rotation", icon: PieChart, q: "Is its sector in or out of favor?", src: "sector ETFs", metrics: [M("sectorPerf", "Sector rel. perf"), M("vsSpy", "Sector vs SPY")] },
    ],
  },
];

/* Opening Bell leans pre-market: overnight levels, earnings before open, analyst moves, rates/regime */
export const SEED_OPEN = ["trend.ma_200", "trend.golden_cross", "levels.high_52w", "levels.pct_high", "levels.support", "earnings.nextDate", "earnings.beatMiss", "analyst.target", "analyst.upgrades", "valuation.forwardPE", "rates.spread", "rates.tnx", "regime.vix", "regime.dxy"];
/* Closing Bell leans end-of-day: the session's momentum, volume confirmation, close vs levels, realized vol */
export const SEED_CLOSE = ["trend.ma_50", "momentum.rsi_14", "momentum.macd", "momentum.pc_1d", "volume.vol_latest", "volume.vol_avg30", "volume.vol_spike", "levels.resistance", "levels.pct_high", "volatility.atr_14", "volatility.drawdown", "sensitivity.beta", "regime.vix"];

/* macro modules are market-wide — same for every symbol — so they render once */
export const SHARED_MODULES = new Set(["rates", "inflation", "cycle", "regime"]);

export const DEFAULT_SYMBOLS = ["AAPL", "MSFT"];

export const key = (mod: string, met: string) => `${mod}.${met}`;

/** All metric keys belonging to a top-level group id (e.g. "technical"). */
export function groupMetricKeys(groupId: string): string[] {
  const g = GROUPS.find((x) => x.id === groupId);
  if (!g) return [];
  return g.modules.flatMap((m) => m.metrics.map((x) => key(m.id, x.id)));
}
