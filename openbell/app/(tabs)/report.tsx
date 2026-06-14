import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronDown,
  ChevronRight,
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
  Check,
  Plus,
  X,
  Clock,
  FileBarChart,
  Eye,
  Database,
  Sunrise,
  Sunset,
  Copy,
  Play,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { fetchMarketData, formatPrice, formatChange } from "@/services/marketData";
import { useReportConfigStore } from "@/stores/reportConfigStore";

/* ---------------- palette (self-contained, matches the design spec) ---------------- */
const C = {
  primary: "#5B4FE6",
  primaryDark: "#4A3FD0",
  ink: "#15162B",
  inkSoft: "#5A5C72",
  inkFaint: "#9698AD",
  line: "#ECEDF4",
  card: "#FFFFFF",
  surface: "#F6F7FB",
  green: "#16A06A",
  greenBg: "#E6F7EF",
  danger: "#E5484D",
};

const TECH = { c: "#5B4FE6", bg: "#ECEAFB" };
const FUND = { c: "#0E9384", bg: "#E3F6F2" };
const MACRO = { c: "#D97706", bg: "#FDF0DD" };

type ReportId = "open" | "close";
type ReportDef = {
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
const REPORTS: Record<ReportId, ReportDef> = {
  open: { id: "open", name: "Opening Bell", blurb: "Before the open", time: "6:30 AM", freq: "Weekdays", tz: "America/New_York", icon: Sunrise, c: "#D97706", bg: "#FDF0DD", band: ["#7C2D12", "#F59E0B"], fires: "before the open" },
  close: { id: "close", name: "Closing Bell", blurb: "After the close", time: "4:15 PM", freq: "Weekdays", tz: "America/New_York", icon: Sunset, c: "#5B4FE6", bg: "#ECEAFB", band: ["#1F2544", "#5B4FE6"], fires: "after the close" },
};

type Metric = { id: string; label: string };
const M = (id: string, label: string): Metric => ({ id, label });

type Module = {
  id: string;
  label: string;
  icon: LucideIcon;
  q: string;
  src: string;
  metrics: Metric[];
};
type Group = {
  id: string;
  label: string;
  sub: string;
  accent: { c: string; bg: string };
  modules: Module[];
};

const GROUPS: Group[] = [
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
const SEED_OPEN = new Set<string>(["trend.ma_200", "trend.golden_cross", "levels.high_52w", "levels.pct_high", "levels.support", "earnings.nextDate", "earnings.beatMiss", "analyst.target", "analyst.upgrades", "valuation.forwardPE", "rates.spread", "rates.tnx", "regime.vix", "regime.dxy"]);
/* Closing Bell leans end-of-day: the session's momentum, volume confirmation, close vs levels, realized vol */
const SEED_CLOSE = new Set<string>(["trend.ma_50", "momentum.rsi_14", "momentum.macd", "momentum.pc_1d", "volume.vol_latest", "volume.vol_avg30", "volume.vol_spike", "levels.resistance", "levels.pct_high", "volatility.atr_14", "volatility.drawdown", "sensitivity.beta", "regime.vix"]);

/* macro modules are market-wide — same for every symbol — so they render once */
const SHARED_MODULES = new Set(["rates", "inflation", "cycle", "regime"]);

type Verdict = { verdict: string; tone: "good" | "warn" | "neutral"; stats: [string, string][] };

const SAMPLE: Record<string, Record<string, Verdict>> = {
  AAPL: {
    trend: { verdict: "Bullish", tone: "good", stats: [["MA 200", "$198.4"], ["200d trend", "↑ +12%"], ["Golden cross", "18d ago"]] },
    momentum: { verdict: "Cooling", tone: "warn", stats: [["RSI 14", "62"], ["MACD", "Bull, flattening"], ["Δ 1d", "+0.8%"]] },
    levels: { verdict: "Near highs", tone: "good", stats: [["52w high", "$237.2"], ["% from high", "−3.1%"], ["Support", "$221"]] },
    volume: { verdict: "Above avg", tone: "neutral", stats: [["Latest", "78.2M"], ["Avg 30d", "61.4M"], ["Spike", "+27%"]] },
    volatility: { verdict: "Calm", tone: "good", stats: [["ATR 14", "$4.20"], ["Drawdown", "−8.3%"]] },
    valuation: { verdict: "Rich", tone: "warn", stats: [["Fwd P/E", "27.8"]] },
    analyst: { verdict: "Buy", tone: "good", stats: [["Target", "$255"], ["Up/downgrades", "2 up"]] },
    earnings: { verdict: "In 12 days", tone: "neutral", stats: [["Next date", "Jul 31"], ["Last", "Beat +4%"]] },
    sensitivity: { verdict: "High beta", tone: "warn", stats: [["Beta", "1.24"]] },
  },
  MSFT: {
    trend: { verdict: "Bullish", tone: "good", stats: [["MA 200", "$418.9"], ["200d trend", "↑ +9%"], ["Golden cross", "63d ago"]] },
    momentum: { verdict: "Neutral", tone: "neutral", stats: [["RSI 14", "48"], ["MACD", "Flat"], ["Δ 1d", "−0.4%"]] },
    levels: { verdict: "Mid-range", tone: "neutral", stats: [["52w high", "$497.1"], ["% from high", "−6.4%"], ["Support", "$441"]] },
    volume: { verdict: "Light", tone: "neutral", stats: [["Latest", "19.1M"], ["Avg 30d", "23.8M"], ["Spike", "−20%"]] },
    volatility: { verdict: "Calm", tone: "good", stats: [["ATR 14", "$7.10"], ["Drawdown", "−10.1%"]] },
    valuation: { verdict: "Stretched", tone: "warn", stats: [["Fwd P/E", "30.5"]] },
    analyst: { verdict: "Strong buy", tone: "good", stats: [["Target", "$510"], ["Up/downgrades", "3 up"]] },
    earnings: { verdict: "In 26 days", tone: "neutral", stats: [["Next date", "Aug 14"], ["Last", "Beat +7%"]] },
    sensitivity: { verdict: "Market-like", tone: "neutral", stats: [["Beta", "0.93"]] },
  },
};

const MACRO_SAMPLE: Record<string, Verdict> = {
  rates: { verdict: "Curve normalizing", tone: "neutral", stats: [["10Y–2Y", "+18bps"], ["TNX trend", "↓"]] },
  inflation: { verdict: "Easing", tone: "good", stats: [["Core CPI", "3.1%"], ["10y breakeven", "2.3%"]] },
  cycle: { verdict: "Late-cycle", tone: "warn", stats: [["Unemp.", "4.1%"], ["GDP", "+2.4%"]] },
  regime: { verdict: "Risk-on", tone: "good", stats: [["VIX", "13.4"], ["Dollar", "Soft"]] },
};

const TONE = {
  good: { c: C.green, bg: C.greenBg },
  warn: { c: "#C98A12", bg: "#FBF1DC" },
  neutral: { c: C.inkSoft, bg: C.surface },
};

type Symbol = { sym: string; price: string; chg: string; up: boolean };
const SEED_SYMBOLS: Symbol[] = [
  { sym: "AAPL", price: "$229.87", chg: "+0.8%", up: true },
  { sym: "MSFT", price: "$465.20", chg: "−0.4%", up: false },
];

const key = (mod: string, met: string) => `${mod}.${met}`;

/* ---------------- shared small components ---------------- */
function Toggle({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: on ? 0 : 2,
        borderColor: C.line,
        backgroundColor: on ? C.green : "#fff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {on && <Check size={16} color="#fff" strokeWidth={3} />}
    </View>
  );
}

/* ---------------- Report selector ---------------- */
function ReportSelector({
  active,
  setActive,
  counts,
}: {
  active: ReportId;
  setActive: (id: ReportId) => void;
  counts: Record<ReportId, number>;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 9, marginBottom: 12 }}>
      {(Object.values(REPORTS) as ReportDef[]).map((r) => {
        const on = active === r.id;
        const Icon = r.icon;
        return (
          <TouchableOpacity
            key={r.id}
            activeOpacity={0.8}
            onPress={() => setActive(r.id)}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1.5, borderColor: on ? r.c : C.line, backgroundColor: on ? r.bg : "#fff" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <Icon size={17} color={r.c} strokeWidth={2.3} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: C.ink }}>{r.name}</Text>
            </View>
            <Text style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: "600" }}>{r.time} · {counts[r.id]} metrics</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ---------------- Build screen ---------------- */
function BuildScreen({
  report,
  selected,
  setSelected,
  freq,
  onFreqChange,
  onCopyFrom,
  otherName,
  symbols,
  onRemoveSymbol,
  onAddPress,
  onRunNow,
  running,
}: {
  report: ReportDef;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  freq: string;
  onFreqChange: (f: string) => void;
  onCopyFrom: () => void;
  otherName: string;
  symbols: Symbol[];
  onRemoveSymbol: (sym: string) => void;
  onAddPress: () => void;
  onRunNow: () => void;
  running: boolean;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["technical"]));
  const [openMods, setOpenMods] = useState<Set<string>>(new Set());

  const modMetrics = (m: Module) => m.metrics.map((x) => key(m.id, x.id));
  const modState = (m: Module): "none" | "some" | "full" => {
    const ks = modMetrics(m);
    const on = ks.filter((k) => selected.has(k)).length;
    return on === 0 ? "none" : on === ks.length ? "full" : "some";
  };
  const groupCount = (g: Group) =>
    g.modules.reduce((a, m) => a + m.metrics.filter((x) => selected.has(key(m.id, x.id))).length, 0);

  const toggleModule = (m: Module) => {
    const ks = modMetrics(m);
    const next = new Set(selected);
    if (modState(m) === "full") ks.forEach((k) => next.delete(k));
    else ks.forEach((k) => next.add(k));
    setSelected(next);
  };
  const toggleMetric = (mod: string, met: string) => {
    const k = key(mod, met);
    const next = new Set(selected);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelected(next);
  };

  const total = selected.size;
  const moduleCount = GROUPS.reduce((a, g) => a + g.modules.filter((m) => modState(m) !== "none").length, 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* watchlist — shared across both reports */}
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 15, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: C.inkSoft }}>WATCHLIST</Text>
            <View style={{ backgroundColor: C.surface, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 }}>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: C.inkFaint }}>shared across both reports</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {symbols.map((s) => (
              <TouchableOpacity
                key={s.sym}
                onPress={() => onRemoveSymbol(s.sym)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.ink, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 }}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13.5 }}>{s.sym}</Text>
                <X size={13} strokeWidth={2.6} color="#fff" style={{ opacity: 0.6 }} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={onAddPress}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderColor: C.line, borderStyle: "dashed", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 }}
            >
              <Plus size={14} strokeWidth={2.6} color={C.inkFaint} />
              <Text style={{ color: C.inkFaint, fontWeight: "700", fontSize: 13.5 }}>Add ticker</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* module selection — per report */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 4, marginBottom: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.inkSoft, flex: 1 }}>{report.name.toUpperCase()} · WHAT TO ANALYZE</Text>
          <TouchableOpacity onPress={onCopyFrom} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Copy size={12} strokeWidth={2.4} color={report.c} />
            <Text style={{ color: report.c, fontSize: 11.5, fontWeight: "700" }}>Copy from {otherName}</Text>
          </TouchableOpacity>
        </View>
        {GROUPS.map((g) => {
          const open = openGroups.has(g.id);
          const gc = groupCount(g);
          return (
            <View key={g.id} style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  const n = new Set(openGroups);
                  n.has(g.id) ? n.delete(g.id) : n.add(g.id);
                  setOpenGroups(n);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: g.accent.bg, alignItems: "center", justifyContent: "center" }}>
                  <FileBarChart size={18} color={g.accent.c} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "800", color: C.ink }}>{g.label}</Text>
                  <Text style={{ fontSize: 12, color: C.inkFaint, fontWeight: "500" }}>{g.sub}</Text>
                </View>
                {gc > 0 && (
                  <View style={{ backgroundColor: g.accent.bg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 }}>
                    <Text style={{ color: g.accent.c, fontWeight: "800", fontSize: 12 }}>{gc}</Text>
                  </View>
                )}
                <ChevronDown size={18} color={C.inkFaint} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
              </TouchableOpacity>

              {open && (
                <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
                  {g.modules.map((m) => {
                    const st = modState(m);
                    const mOpen = openMods.has(m.id);
                    const Icon = m.icon;
                    const onCount = m.metrics.filter((x) => selected.has(key(m.id, x.id))).length;
                    return (
                      <View
                        key={m.id}
                        style={{
                          borderRadius: 12,
                          backgroundColor: st !== "none" ? g.accent.bg + "66" : C.surface,
                          marginBottom: 7,
                          borderWidth: 1,
                          borderColor: st !== "none" ? g.accent.c + "33" : "transparent",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, paddingHorizontal: 12 }}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                              const n = new Set(openMods);
                              n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                              setOpenMods(n);
                            }}
                            style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}
                          >
                            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                              <Icon size={16} color={g.accent.c} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={{ fontSize: 14, fontWeight: "700", color: C.ink }}>{m.label}</Text>
                                <Text style={{ fontSize: 10.5, color: C.inkFaint, fontWeight: "600" }}>
                                  {st === "some" ? `${onCount}/${m.metrics.length}` : `${m.metrics.length}`}
                                </Text>
                                <ChevronRight size={13} color={C.inkFaint} style={{ transform: [{ rotate: mOpen ? "90deg" : "0deg" }] }} />
                              </View>
                              <Text numberOfLines={1} style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: "500" }}>{m.q}</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity activeOpacity={0.7} onPress={() => toggleModule(m)} style={{ position: "relative" }}>
                            <Toggle on={st === "full"} />
                            {st === "some" && (
                              <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                                <View style={{ width: 11, height: 3, borderRadius: 2, backgroundColor: g.accent.c }} />
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                        {mOpen && (
                          <View style={{ paddingRight: 12, paddingBottom: 12, paddingLeft: 55 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                              <Database size={11} color={C.inkFaint} />
                              <Text style={{ fontSize: 10.5, color: C.inkFaint, fontWeight: "600" }}>{m.src}</Text>
                            </View>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {m.metrics.map((x) => {
                                const on = selected.has(key(m.id, x.id));
                                return (
                                  <TouchableOpacity
                                    key={x.id}
                                    activeOpacity={0.7}
                                    onPress={() => toggleMetric(m.id, x.id)}
                                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1.5, borderColor: on ? g.accent.c : C.line, backgroundColor: on ? "#fff" : "transparent" }}
                                  >
                                    {on && <Check size={11} strokeWidth={3} color={g.accent.c} />}
                                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: on ? g.accent.c : C.inkFaint }}>{x.label}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* schedule — per report (driven by report identity) */}
        <Text style={{ fontSize: 12, fontWeight: "700", color: C.inkSoft, marginHorizontal: 4, marginTop: 16, marginBottom: 10 }}>{report.name.toUpperCase()} · SCHEDULE</Text>
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 15 }}>
          <View style={{ flexDirection: "row", gap: 7, marginBottom: 13 }}>
            {["Daily", "Weekdays", "Weekly"].map((f) => {
              const on = freq === f;
              return (
                <TouchableOpacity
                  key={f}
                  activeOpacity={0.7}
                  onPress={() => onFreqChange(f)}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: on ? report.c : C.line, backgroundColor: on ? report.bg : "#fff" }}
                >
                  <Text style={{ color: on ? report.c : C.inkSoft, fontSize: 12.5, fontWeight: "700" }}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: C.inkSoft, marginBottom: 6 }}>Time</Text>
              <View style={inp}><Text style={inpText}>{report.time}</Text></View>
            </View>
            <View style={{ flex: 1.4 }}>
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: C.inkSoft, marginBottom: 6 }}>Timezone</Text>
              <View style={inp}><Text style={inpText}>{report.tz}</Text></View>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 }}>
            <Clock size={12} color={C.inkFaint} />
            <Text style={{ fontSize: 11, color: C.inkFaint, fontWeight: "500" }}>Fires {report.fires}, in market time — pushed for your approval.</Text>
          </View>
        </View>
      </ScrollView>

      {/* sticky footer */}
      <View
        style={{
          paddingTop: 13,
          paddingHorizontal: 16,
          paddingBottom: 22,
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.line,
          shadowColor: "#15162B",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: C.inkSoft, fontWeight: "600" }}>
            <Text style={{ color: C.ink, fontWeight: "700" }}>{total} metrics</Text> · {moduleCount} modules
          </Text>
          <Text style={{ fontSize: 12, color: C.inkFaint, fontWeight: "500" }}>{symbols.length} symbols</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!total || running}
            onPress={onRunNow}
            style={{ flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: total ? report.c : C.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 }}
          >
            {running ? (
              <ActivityIndicator size="small" color={total ? report.c : C.inkFaint} />
            ) : (
              <Play size={15} color={total ? report.c : C.inkFaint} fill={total ? report.c : C.inkFaint} />
            )}
            <Text style={{ color: total ? report.c : C.inkFaint, fontSize: 15, fontWeight: "700" }}>
              {running ? "Running…" : "Run now"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!total}
            style={{ flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: total ? report.c : C.line, alignItems: "center" }}
          >
            <Text style={{ color: total ? "#fff" : C.inkFaint, fontSize: 15, fontWeight: "700" }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ---------------- Preview screen ---------------- */
function SectionCardRender({ g, m, data, selected }: { g: Group; m: Module; data?: Verdict; selected: Set<string> }) {
  const tone = data ? TONE[data.tone] : TONE.neutral;
  const Icon = m.icon;
  const chosen = m.metrics.filter((x) => selected.has(key(m.id, x.id)));
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 11 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: g.accent.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={g.accent.c} strokeWidth={2.3} />
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: "800", color: C.ink, flex: 1 }}>{m.label}</Text>
        {data && (
          <View style={{ backgroundColor: tone.bg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 }}>
            <Text style={{ color: tone.c, fontWeight: "700", fontSize: 11.5 }}>{data.verdict}</Text>
          </View>
        )}
      </View>
      {data ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {data.stats.map(([k, v]) => (
            <View key={k} style={{ backgroundColor: C.surface, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, minWidth: 78 }}>
              <Text style={{ fontSize: 10.5, color: C.inkFaint, fontWeight: "600", marginBottom: 2 }}>{k}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "800", color: C.ink }}>{v}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {chosen.map((x) => (
            <View key={x.id} style={{ backgroundColor: C.surface, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 }}>
              <Text style={{ color: C.inkSoft, fontSize: 11.5, fontWeight: "600" }}>{x.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PreviewScreen({ report, selected, symbols, freq }: { report: ReportDef; selected: Set<string>; symbols: Symbol[]; freq: string }) {
  const [sym, setSym] = useState(symbols[0]?.sym);
  const cur = symbols.find((s) => s.sym === sym) || symbols[0];

  // keep selection valid if the active symbol was removed
  useEffect(() => {
    if (!symbols.find((s) => s.sym === sym)) setSym(symbols[0]?.sym);
  }, [symbols, sym]);

  if (!cur) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: C.inkFaint, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
          Add a ticker on the Build tab to preview this report.
        </Text>
      </View>
    );
  }

  const perSymbol: { g: Group; m: Module }[] = [];
  const shared: { g: Group; m: Module }[] = [];
  GROUPS.forEach((g) =>
    g.modules.forEach((m) => {
      if (!m.metrics.some((x) => selected.has(key(m.id, x.id)))) return;
      (SHARED_MODULES.has(m.id) ? shared : perSymbol).push({ g, m });
    })
  );

  const ReportIcon = report.icon;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      {/* symbol switcher */}
      {symbols.length > 1 && (
        <View style={{ flexDirection: "row", gap: 7, marginBottom: 14 }}>
          {symbols.map((s) => {
            const on = s.sym === sym;
            return (
              <TouchableOpacity
                key={s.sym}
                activeOpacity={0.8}
                onPress={() => setSym(s.sym)}
                style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : "#fff" }}
              >
                <Text style={{ color: on ? "#fff" : C.inkSoft, fontSize: 14, fontWeight: "800" }}>{s.sym}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* report-branded symbol header */}
      <LinearGradient colors={report.band} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <ReportIcon size={16} color="#fff" strokeWidth={2.4} />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff", opacity: 0.95, letterSpacing: 0.4 }}>{report.name.toUpperCase()}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>{cur.sym}</Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff", opacity: 0.9 }}>{cur.price} · {cur.chg}</Text>
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: "500", color: "#fff", opacity: 0.85 }}>{freq} · {report.time} ET · {perSymbol.length} sections</Text>
      </LinearGradient>

      {/* per-symbol sections */}
      <View style={{ gap: 11 }}>
        {perSymbol.map(({ g, m }, i) => (
          <SectionCardRender key={`${sym}-${i}`} g={g} m={m} data={(SAMPLE[sym!] || {})[m.id]} selected={selected} />
        ))}
      </View>

      {/* shared macro backdrop */}
      {shared.length > 0 && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 11 }}>
            <View style={{ height: 1, flex: 1, backgroundColor: C.line }} />
            <Text style={{ fontSize: 11.5, fontWeight: "800", color: C.inkFaint, letterSpacing: 0.5 }}>MARKET BACKDROP · SHARED</Text>
            <View style={{ height: 1, flex: 1, backgroundColor: C.line }} />
          </View>
          <View style={{ gap: 11 }}>
            {shared.map(({ g, m }, i) => (
              <SectionCardRender key={`macro-${i}`} g={g} m={m} data={MACRO_SAMPLE[m.id]} selected={selected} />
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10 }}>
            <Clock size={12} color={C.inkFaint} />
            <Text style={{ fontSize: 11, color: C.inkFaint, fontWeight: "500" }}>Same for every symbol — computed once per run.</Text>
          </View>
        </>
      )}

      <Text style={{ textAlign: "center", fontSize: 11.5, color: C.inkFaint, fontWeight: "500", marginTop: 16 }}>
        This is what lands in your {report.name} digest.
      </Text>
    </ScrollView>
  );
}

/* ---------------- Shell ---------------- */
export default function ScheduledReportScreen() {
  const cfg = useReportConfigStore();

  const [reports, setReports] = useState<Record<ReportId, { selected: Set<string>; freq: string }>>(() => ({
    open: { selected: new Set(cfg.configured ? cfg.selected.open : SEED_OPEN), freq: cfg.configured ? cfg.freq.open : REPORTS.open.freq },
    close: { selected: new Set(cfg.configured ? cfg.selected.close : SEED_CLOSE), freq: cfg.configured ? cfg.freq.close : REPORTS.close.freq },
  }));
  const [active, setActive] = useState<ReportId>("open");
  const [tab, setTab] = useState<"build" | "preview">("build");
  const [symbols, setSymbols] = useState<Symbol[]>(() => {
    const list = cfg.configured && cfg.symbols.length ? cfg.symbols : SEED_SYMBOLS.map((s) => s.sym);
    return list.map((sym) => SEED_SYMBOLS.find((s) => s.sym === sym) || { sym, price: "—", chg: "", up: true });
  });
  const cfgApplied = useRef(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const report = REPORTS[active];
  const other: ReportId = active === "open" ? "close" : "open";
  const setSelected = (next: Set<string>) => setReports((r) => ({ ...r, [active]: { ...r[active], selected: next } }));
  const setFreq = (f: string) => setReports((r) => ({ ...r, [active]: { ...r[active], freq: f } }));
  const copyFromOther = () => setReports((r) => ({ ...r, [active]: { ...r[active], selected: new Set(r[other].selected) } }));
  const counts: Record<ReportId, number> = { open: reports.open.selected.size, close: reports.close.selected.size };

  // refresh live prices for the current watchlist from the backend
  const refreshPrices = useCallback(async (syms: string[]) => {
    await Promise.all(
      syms.map(async (sym) => {
        try {
          const d = await fetchMarketData(sym);
          setSymbols((prev) =>
            prev.map((s) =>
              s.sym === sym
                ? { sym, price: formatPrice(d.currentPrice), chg: formatChange(d.changePercent), up: d.changePercent >= 0 }
                : s
            )
          );
        } catch {
          /* keep last-known/seed value on failure */
        }
      })
    );
  }, []);

  // initial live-price fetch for the current watchlist
  useEffect(() => {
    refreshPrices(symbols.map((s) => s.sym));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshPrices]);

  // apply onboarding-tailored config when it becomes available
  useEffect(() => {
    if (cfg.configured && !cfgApplied.current) {
      cfgApplied.current = true;
      setReports({
        open: { selected: new Set(cfg.selected.open), freq: cfg.freq.open },
        close: { selected: new Set(cfg.selected.close), freq: cfg.freq.close },
      });
      const list = cfg.symbols.length ? cfg.symbols : SEED_SYMBOLS.map((s) => s.sym);
      setSymbols(list.map((sym) => SEED_SYMBOLS.find((s) => s.sym === sym) || { sym, price: "—", chg: "", up: true }));
      refreshPrices(list);
    }
  }, [cfg.configured, cfg.selected, cfg.freq, cfg.symbols, refreshPrices]);

  const removeSymbol = (sym: string) => setSymbols((prev) => prev.filter((s) => s.sym !== sym));

  // Trigger the active report on demand: refresh live data, then show the result.
  const runNow = async () => {
    setRunning(true);
    try {
      await refreshPrices(symbols.map((s) => s.sym));
    } finally {
      setRunning(false);
      setTab("preview");
    }
  };

  const addSymbol = async () => {
    const sym = addText.trim().toUpperCase();
    if (!sym) return;
    if (symbols.some((s) => s.sym === sym)) {
      setAddError("Already in your watchlist.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const d = await fetchMarketData(sym);
      setSymbols((prev) => [...prev, { sym, price: formatPrice(d.currentPrice), chg: formatChange(d.changePercent), up: d.changePercent >= 0 }]);
      setAddText("");
      setAddOpen(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not find that ticker.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }} edges={["top"]}>
      {/* header */}
      <View style={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 13 }}>
          <FileBarChart size={19} color={C.primary} strokeWidth={2.2} />
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.ink }}>Scheduled Reports</Text>
        </View>

        {/* which report */}
        <ReportSelector active={active} setActive={setActive} counts={counts} />

        {/* build vs preview of that report */}
        <View style={{ flexDirection: "row", backgroundColor: C.surface, borderRadius: 11, padding: 3 }}>
          {([["build", "Build", FileBarChart], ["preview", "Preview", Eye]] as const).map(([id, label, Icon]) => {
            const activeTab = tab === id;
            return (
              <TouchableOpacity
                key={id}
                activeOpacity={0.8}
                onPress={() => setTab(id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 9,
                  borderRadius: 9,
                  backgroundColor: activeTab ? "#fff" : "transparent",
                  ...(activeTab
                    ? { shadowColor: "#15162B", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2 }
                    : {}),
                }}
              >
                <Icon size={15} strokeWidth={2.3} color={activeTab ? C.primary : C.inkFaint} />
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: activeTab ? C.primary : C.inkFaint }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {tab === "build" ? (
        <BuildScreen
          report={report}
          selected={reports[active].selected}
          setSelected={setSelected}
          freq={reports[active].freq}
          onFreqChange={setFreq}
          onCopyFrom={copyFromOther}
          otherName={REPORTS[other].name}
          symbols={symbols}
          onRemoveSymbol={removeSymbol}
          onAddPress={() => { setAddError(null); setAddOpen(true); }}
          onRunNow={runNow}
          running={running}
        />
      ) : (
        <PreviewScreen report={report} selected={reports[active].selected} symbols={symbols} freq={reports[active].freq} />
      )}

      {/* add ticker modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(20,22,43,0.45)", justifyContent: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: C.ink }}>Add ticker</Text>
              <TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={8}>
                <X size={18} color={C.inkFaint} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={addText}
              onChangeText={(t) => { setAddText(t); setAddError(null); }}
              placeholder="e.g. NVDA"
              placeholderTextColor={C.inkFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={addSymbol}
              returnKeyType="done"
              style={{ borderWidth: 1, borderColor: addError ? C.danger : C.line, borderRadius: 11, paddingVertical: Platform.OS === "ios" ? 12 : 8, paddingHorizontal: 13, fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: addError ? 6 : 14 }}
            />
            {addError && <Text style={{ color: C.danger, fontSize: 12, fontWeight: "600", marginBottom: 12 }}>{addError}</Text>}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={addSymbol}
              disabled={adding}
              style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: C.primary, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
            >
              {adding && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "700" }}>{adding ? "Checking…" : "Add to watchlist"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const inp = {
  paddingVertical: 11,
  paddingHorizontal: 13,
  borderRadius: 11,
  borderWidth: 1,
  borderColor: C.line,
  backgroundColor: "#fff",
} as const;
const inpText = { fontSize: 13.5, color: C.ink, fontWeight: "700" } as const;
