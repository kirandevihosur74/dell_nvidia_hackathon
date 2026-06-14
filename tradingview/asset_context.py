"""
asset_context.py
================

Build structured, model-ready context for an asset across **technical**,
**fundamental**, and **macroeconomic** intents — designed to feed a local LLM
(e.g. Nemotron served via Ollama) so it answers from grounded data instead of
hallucinating specifics.

Two public pieces:

    FredClient            -- thin REST client for FRED economic series
    build_asset_context() -- returns a JSON-serializable dict per symbol

Design notes
------------
* Every intent is computed in isolation; one failing block never kills the rest.
* The result always reports `intents_fulfilled` vs `intents_unavailable` plus
  human-readable `notes`, so the prompt can instruct the model: "you have no
  inflation data — decline rather than guess."
* yfinance calls go through a single Chrome-impersonating curl_cffi session to
  dodge Yahoo's 429s (same approach as app.py).
* No new hard dependency: FRED is hit with plain `requests`. A FRED API key
  (free) is read from $FRED_API_KEY; without it, the FRED-backed macro intents
  are gracefully marked unavailable.

Standalone smoke test:
    python asset_context.py AAPL
"""

import os
import math
import time
from datetime import datetime

import numpy as np
import pandas as pd
import requests
import yfinance as yf

# curl_cffi lets us impersonate Chrome's TLS fingerprint to dodge Yahoo 429s.
# It's the preferred path, but the module stays usable without it (falls back to
# a plain requests session, which yfinance also accepts).
try:
    from curl_cffi import requests as curl_requests
    _HAS_CURL_CFFI = True
except ImportError:
    curl_requests = None
    _HAS_CURL_CFFI = False

# yfinance's cookie/crumb handshake needs the monkey-patch to work with a
# curl_cffi session. app.py applies it too; guard so a double-import is a no-op.
_PATCH_APPLIED = False
try:
    import yfinance_cookie_patch
    yfinance_cookie_patch.patch_yfdata_cookie_basic()
    _PATCH_APPLIED = True
except Exception:
    pass


# --------------------------------------------------------------------------- #
# Intent registry (mirrors the question -> data-field schema)
# --------------------------------------------------------------------------- #
TECHNICAL_INTENTS = ["trend", "momentum", "volatility", "levels", "volume"]
FUNDAMENTAL_INTENTS = [
    "valuation", "profitability", "growth",
    "financial_health", "dividend", "analyst", "earnings_event",
]
MACRO_INTENTS = [
    "market_sensitivity", "rates", "inflation",
    "growth_cycle", "risk_regime", "sector_rotation",
]
ALL_INTENTS = TECHNICAL_INTENTS + FUNDAMENTAL_INTENTS + MACRO_INTENTS

# Which top-level result block each intent lives under (for reclassification)
_CATEGORY_OF = {
    **{i: "technical" for i in TECHNICAL_INTENTS},
    **{i: "fundamental" for i in FUNDAMENTAL_INTENTS},
    **{i: "macro" for i in MACRO_INTENTS},
}

# Human-readable topic per intent (used in the prompt's have/have-not clause)
INTENT_TOPIC = {
    "trend": "price trend / moving averages",
    "momentum": "momentum (RSI, MACD)",
    "volatility": "volatility (ATR, Bollinger, drawdown)",
    "levels": "support/resistance & 52-week levels",
    "volume": "trading volume",
    "valuation": "valuation multiples (P/E, EV/EBITDA, etc.)",
    "profitability": "profitability & margins",
    "growth": "revenue/earnings growth",
    "financial_health": "balance-sheet health (debt, cash, liquidity)",
    "dividend": "dividends",
    "analyst": "analyst ratings & price targets",
    "earnings_event": "upcoming earnings dates",
    "market_sensitivity": "market beta & index correlation",
    "rates": "interest rates & the yield curve",
    "inflation": "inflation (CPI, breakevens)",
    "growth_cycle": "macro growth & employment",
    "risk_regime": "risk regime (VIX, dollar, commodities)",
    "sector_rotation": "sector rotation",
}

# Keyword router: map a free-text question to the intents it needs.
_INTENT_KEYWORDS = {
    "trend": ["trend", "moving average", "sma", "50-day", "200-day", "bullish",
              "bearish", "golden cross", "death cross"],
    "momentum": ["momentum", "rsi", "macd", "overbought", "oversold"],
    "volatility": ["volatility", "volatile", "atr", "bollinger", "drawdown"],
    "levels": ["support", "resistance", "52-week", "52 week", "breakout",
               "all-time high", "near its high", "near its low"],
    "volume": ["volume", "liquidity"],
    "valuation": ["valuation", "cheap", "expensive", "overvalued", "undervalued",
                  "p/e", "pe ratio", "peg", "multiple", "price to", "price-to"],
    "profitability": ["margin", "profitab", "roe", "return on", "roa"],
    "growth": ["growth", "growing", "revenue", "earnings growth", "eps", "top line"],
    "financial_health": ["debt", "balance sheet", "leverage", "solvency",
                          "free cash flow", "current ratio", "quick ratio"],
    "dividend": ["dividend", "yield", "payout"],
    "analyst": ["analyst", "rating", "price target", "recommendation", "upgrade",
                "downgrade", "consensus"],
    "earnings_event": ["earnings date", "next earnings", "when does", "report date",
                       "reporting"],
    "market_sensitivity": ["beta", "correlation", "correlated", "sensitivity"],
    "rates": ["interest rate", "rate cut", "rate hike", "rates", "fed funds",
              "fed ", "yield curve", "treasury", "10-year", "10 year"],
    "inflation": ["inflation", "cpi", "deflation", "breakeven"],
    "growth_cycle": ["gdp", "unemployment", "recession", "economy", "economic",
                     "payroll", "business cycle", "consumer sentiment"],
    "risk_regime": ["risk-on", "risk on", "risk-off", "risk off", "vix", "dollar",
                    "oil", "gold", "macro backdrop", "fear"],
    "sector_rotation": ["sector", "rotation", "industry"],
}


def route_intents(question, default=None):
    """Return the list of intents a free-text question implies.

    Falls back to `default` (or all intents) when nothing matches, so the model
    still gets broad context rather than nothing.
    """
    q = (question or "").lower()
    hits = [i for i, kws in _INTENT_KEYWORDS.items() if any(k in q for k in kws)]
    return hits or (list(default) if default else list(ALL_INTENTS))

# Macro intents that require FRED (others use yfinance / ticker.info)
_FRED_INTENTS = {"rates", "inflation", "growth_cycle"}

# Yahoo sector name -> SPDR sector ETF (for sector_rotation)
_SECTOR_ETF = {
    "Technology": "XLK", "Financial Services": "XLF", "Energy": "XLE",
    "Healthcare": "XLV", "Industrials": "XLI", "Consumer Cyclical": "XLY",
    "Consumer Defensive": "XLP", "Utilities": "XLU", "Basic Materials": "XLB",
    "Real Estate": "XLRE", "Communication Services": "XLC",
}

# --------------------------------------------------------------------------- #
# Shared session
# --------------------------------------------------------------------------- #
_session = None


def _get_session():
    global _session
    if _session is None:
        if _HAS_CURL_CFFI:
            _session = curl_requests.Session(impersonate="chrome")
        else:
            _session = requests.Session()
    return _session


# --------------------------------------------------------------------------- #
# Small numeric helpers (NaN-/inf-safe, JSON-clean)
# --------------------------------------------------------------------------- #
def _f(x, ndigits=4):
    """Coerce to a clean float (None on NaN/inf/non-numeric)."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(v) or math.isinf(v):
        return None
    return round(v, ndigits)


def _i(x):
    try:
        v = int(x)
        return v
    except (TypeError, ValueError):
        return None


def _has_data(v):
    """True if the structure contains at least one real (non-empty) leaf value."""
    if v is None:
        return False
    if isinstance(v, dict):
        return any(_has_data(x) for x in v.values())
    if isinstance(v, (list, tuple)):
        return any(_has_data(x) for x in v)
    if isinstance(v, str):
        return v != ""
    return True  # numbers / bools count as data


def _clean(obj):
    """Recursively make a structure JSON-serializable."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return _f(obj)
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if isinstance(obj, float):
        return _f(obj)
    return obj


# --------------------------------------------------------------------------- #
# Technical indicator primitives
# --------------------------------------------------------------------------- #
def _sma(s, n):
    return s.rolling(n).mean()


def _rsi(close, n=14):
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(n).mean()
    loss = (-delta.clip(upper=0)).rolling(n).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def _macd(close, fast=12, slow=26, signal=9):
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, signal_line, macd_line - signal_line


def _atr(df, n=14):
    high, low, close = df["High"], df["Low"], df["Close"]
    prev = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev).abs(), (low - prev).abs()], axis=1
    ).max(axis=1)
    return tr.rolling(n).mean()


def _max_drawdown_pct(close):
    roll_max = close.cummax()
    dd = close / roll_max - 1.0
    return float(dd.min()) * 100 if len(dd) else None


# --------------------------------------------------------------------------- #
# FRED client
# --------------------------------------------------------------------------- #
class FredClient:
    """Minimal FRED (Federal Reserve Economic Data) REST client.

    Reads from https://api.stlouisfed.org/fred. Caches per-series responses for
    `ttl` seconds (economic series update at most daily, so an hour is fine).
    """

    BASE = "https://api.stlouisfed.org/fred/series/observations"

    def __init__(self, api_key=None, session=None, ttl=3600, timeout=15):
        self.api_key = api_key or os.getenv("FRED_API_KEY")
        self.session = session or requests.Session()
        self.ttl = ttl
        self.timeout = timeout
        self._cache = {}

    @property
    def enabled(self):
        return bool(self.api_key)

    def _observations(self, series_id, limit=12):
        """Most-recent-first observations for a series (cached)."""
        if not self.enabled:
            return []
        now = time.time()
        key = (series_id, limit)
        hit = self._cache.get(key)
        if hit and (now - hit[0]) < self.ttl:
            return hit[1]
        params = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        }
        try:
            r = self.session.get(self.BASE, params=params, timeout=self.timeout)
            r.raise_for_status()
            obs = r.json().get("observations", [])
        except Exception:
            obs = []
        self._cache[key] = (now, obs)
        return obs

    @staticmethod
    def _valid(obs):
        """Filter out FRED's missing markers ('.') and parse floats."""
        out = []
        for o in obs:
            v = o.get("value")
            if v not in (".", "", None):
                try:
                    out.append((o.get("date"), float(v)))
                except ValueError:
                    continue
        return out

    def latest(self, series_id):
        """Latest valid value: {'value', 'as_of'} or None."""
        vals = self._valid(self._observations(series_id, limit=10))
        if not vals:
            return None
        date, value = vals[0]
        return {"value": _f(value, 3), "as_of": date}

    def yoy(self, series_id):
        """Latest value plus year-over-year % change (for monthly index series)."""
        vals = self._valid(self._observations(series_id, limit=14))
        if len(vals) < 13:
            base = self.latest(series_id)
            return base  # not enough history for YoY; return level only
        date, latest = vals[0]
        year_ago = vals[12][1]
        return {
            "value": _f(latest, 3),
            "yoy_pct": _f((latest / year_ago - 1) * 100, 2) if year_ago else None,
            "as_of": date,
        }


# --------------------------------------------------------------------------- #
# Per-intent builders
# --------------------------------------------------------------------------- #
def _technical(intents, hist):
    out = {}
    if hist is None or hist.empty:
        return out, []
    close = hist["Close"]
    last = close.iloc[-1]
    fulfilled = []

    if "trend" in intents:
        sma50_s, sma200_s = _sma(close, 50), _sma(close, 200)
        sma50, sma200 = sma50_s.iloc[-1], sma200_s.iloc[-1]
        cross = None
        diff = (sma50_s - sma200_s).dropna()
        if len(diff) >= 10:
            first, latest = diff.iloc[-10], diff.iloc[-1]
            if first < 0 <= latest:
                cross = "golden_cross_recent"
            elif first > 0 >= latest:
                cross = "death_cross_recent"
        out["trend"] = {
            "last_close": _f(last, 2),
            "sma_50": _f(sma50, 2),
            "sma_200": _f(sma200, 2),
            "trend_vs_50d": _bull_bear(last, sma50),
            "trend_vs_200d": _bull_bear(last, sma200),
            "cross_signal": cross,
        }
        fulfilled.append("trend")

    if "momentum" in intents:
        rsi = _rsi(close).iloc[-1]
        macd_line, signal_line, macd_hist = _macd(close)

        def chg(n):
            return (last / close.iloc[-1 - n] - 1) * 100 if len(close) > n else None

        out["momentum"] = {
            "rsi_14": _f(rsi, 2),
            "rsi_signal": (
                "overbought" if rsi and rsi > 70
                else "oversold" if rsi and rsi < 30
                else "neutral"
            ),
            "macd": _f(macd_line.iloc[-1]),
            "macd_signal_line": _f(signal_line.iloc[-1]),
            "macd_hist": _f(macd_hist.iloc[-1]),
            "price_change_1d_pct": _f(chg(1), 2),
            "price_change_1w_pct": _f(chg(5), 2),
            "price_change_1m_pct": _f(chg(21), 2),
        }
        fulfilled.append("momentum")

    if "volatility" in intents:
        returns = close.pct_change().dropna()
        hv = returns.tail(30).std() * math.sqrt(252) * 100 if len(returns) >= 5 else None
        mid = _sma(close, 20).iloc[-1]
        std = close.rolling(20).std().iloc[-1]
        upper = mid + 2 * std if pd.notna(mid) and pd.notna(std) else None
        lower = mid - 2 * std if pd.notna(mid) and pd.notna(std) else None
        pctb = (
            (last - lower) / (upper - lower)
            if upper is not None and lower is not None and upper != lower
            else None
        )
        out["volatility"] = {
            "atr_14": _f(_atr(hist).iloc[-1], 2),
            "hist_vol_30d_annualized_pct": _f(hv, 2),
            "bollinger_upper": _f(upper, 2),
            "bollinger_lower": _f(lower, 2),
            "bollinger_pct_b": _f(pctb, 3),
            "max_drawdown_1y_pct": _f(_max_drawdown_pct(close), 2),
        }
        fulfilled.append("volatility")

    if "levels" in intents:
        hi, lo = hist["High"].max(), hist["Low"].min()
        out["levels"] = {
            "high_52w": _f(hi, 2),
            "low_52w": _f(lo, 2),
            "pct_from_52w_high": _f((last / hi - 1) * 100, 2) if hi else None,
            "pct_from_52w_low": _f((last / lo - 1) * 100, 2) if lo else None,
            "recent_resistance_20d": _f(hist["High"].tail(20).max(), 2),
            "recent_support_20d": _f(hist["Low"].tail(20).min(), 2),
        }
        fulfilled.append("levels")

    if "volume" in intents:
        vol_last = hist["Volume"].iloc[-1]
        vol_avg = hist["Volume"].tail(30).mean()
        out["volume"] = {
            "volume_latest": _i(vol_last),
            "volume_avg_30d": _i(vol_avg),
            "volume_ratio": _f(vol_last / vol_avg, 2) if vol_avg else None,
        }
        fulfilled.append("volume")

    return out, fulfilled


def _bull_bear(price, ref):
    if ref is None or pd.isna(ref) or pd.isna(price):
        return None
    return "bullish" if price > ref else "bearish"


def _fundamental(intents, ticker, info):
    out = {}
    fulfilled = []
    info = info or {}

    if "valuation" in intents:
        out["valuation"] = {
            "trailing_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio") or info.get("trailingPegRatio"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "price_to_book": info.get("priceToBook"),
            "ev_to_revenue": info.get("enterpriseToRevenue"),
            "ev_to_ebitda": info.get("enterpriseToEbitda"),
            "market_cap": info.get("marketCap"),
        }
        fulfilled.append("valuation")

    if "profitability" in intents:
        out["profitability"] = {
            "gross_margins": info.get("grossMargins"),
            "operating_margins": info.get("operatingMargins"),
            "profit_margins": info.get("profitMargins"),
            "ebitda_margins": info.get("ebitdaMargins"),
            "return_on_equity": info.get("returnOnEquity"),
            "return_on_assets": info.get("returnOnAssets"),
        }
        fulfilled.append("profitability")

    if "growth" in intents:
        growth = {
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "earnings_quarterly_growth": info.get("earningsQuarterlyGrowth"),
        }
        # multi-year revenue trend from the income statement (most recent first)
        try:
            stmt = ticker.income_stmt
            if stmt is not None and not stmt.empty and "Total Revenue" in stmt.index:
                rev = stmt.loc["Total Revenue"].dropna()
                growth["revenue_trend"] = [_f(v) for v in rev.values[:4]]
            if stmt is not None and not stmt.empty and "Net Income" in stmt.index:
                ni = stmt.loc["Net Income"].dropna()
                growth["net_income_trend"] = [_f(v) for v in ni.values[:4]]
        except Exception:
            pass
        out["growth"] = growth
        fulfilled.append("growth")

    if "financial_health" in intents:
        out["financial_health"] = {
            "debt_to_equity": info.get("debtToEquity"),
            "total_debt": info.get("totalDebt"),
            "total_cash": info.get("totalCash"),
            "current_ratio": info.get("currentRatio"),
            "quick_ratio": info.get("quickRatio"),
            "free_cashflow": info.get("freeCashflow"),
            "operating_cashflow": info.get("operatingCashflow"),
        }
        fulfilled.append("financial_health")

    if "dividend" in intents:
        out["dividend"] = {
            "dividend_rate": info.get("dividendRate"),
            "dividend_yield": info.get("dividendYield"),
            "payout_ratio": info.get("payoutRatio"),
            "five_year_avg_yield": info.get("fiveYearAvgDividendYield"),
            "ex_dividend_date": info.get("exDividendDate"),
        }
        fulfilled.append("dividend")

    if "analyst" in intents:
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        target = info.get("targetMeanPrice")
        analyst = {
            "recommendation_mean": info.get("recommendationMean"),
            "recommendation_key": info.get("recommendationKey"),
            "target_mean_price": target,
            "target_high_price": info.get("targetHighPrice"),
            "target_low_price": info.get("targetLowPrice"),
            "number_of_analysts": info.get("numberOfAnalystOpinions"),
            "upside_pct": _f((target / price - 1) * 100, 2) if target and price else None,
        }
        # recent rating changes live in upgrades_downgrades in yfinance >=0.2
        try:
            ud = ticker.upgrades_downgrades
            if ud is not None and not ud.empty:
                recent = []
                for date, row in ud.head(3).iterrows():
                    recent.append({
                        "date": date.isoformat() if hasattr(date, "isoformat") else str(date),
                        "firm": row.get("Firm"),
                        "to_grade": row.get("ToGrade"),
                        "from_grade": row.get("FromGrade"),
                        "action": row.get("Action"),
                    })
                analyst["recent_rating_changes"] = recent
        except Exception:
            pass
        out["analyst"] = analyst
        fulfilled.append("analyst")

    if "earnings_event" in intents:
        event = {}
        try:
            cal = ticker.calendar
            if isinstance(cal, dict):
                ed = cal.get("Earnings Date")
                if ed:
                    event["next_earnings_date"] = [
                        d.isoformat() if hasattr(d, "isoformat") else str(d)
                        for d in (ed if isinstance(ed, list) else [ed])
                    ]
        except Exception:
            pass
        out["earnings_event"] = event
        fulfilled.append("earnings_event")

    # clean None-only nested dicts? keep them; explicit None signals "looked, absent"
    return out, fulfilled


def _macro(intents, ticker, info, hist, session, fred, notes):
    out = {}
    fulfilled = []
    unavailable = []
    info = info or {}

    if "market_sensitivity" in intents:
        ms = {"beta": info.get("beta")}
        if hist is not None and not hist.empty:
            stock_ret = hist["Close"].pct_change().dropna().tail(63)
            corrs = {}
            for name, idx in {"sp500": "^GSPC", "nasdaq": "^IXIC", "dow": "^DJI"}.items():
                try:
                    ih = (
                        yf.Ticker(idx, session=session)
                        .history(period="3mo")["Close"]
                        .pct_change()
                        .dropna()
                    )
                    common = stock_ret.index.intersection(ih.index)
                    if len(common) > 5:
                        corrs[name] = _f(stock_ret.loc[common].corr(ih.loc[common]), 2)
                except Exception:
                    continue
            ms["index_correlations_3mo"] = corrs
        out["market_sensitivity"] = ms
        fulfilled.append("market_sensitivity")

    if "risk_regime" in intents:
        regime = {}
        for name, sym in {
            "vix": "^VIX", "dollar_index": "DX-Y.NYB",
            "crude_oil": "CL=F", "gold": "GC=F",
        }.items():
            snap = _latest_close(session, sym)
            if snap:
                regime[name] = snap
        out["risk_regime"] = regime
        fulfilled.append("risk_regime") if regime else unavailable.append("risk_regime")

    if "sector_rotation" in intents:
        sector = info.get("sector")
        etf = _SECTOR_ETF.get(sector)
        if etf:
            etf_perf = _period_return(session, etf, "3mo")
            spy_perf = _period_return(session, "SPY", "3mo")
            out["sector_rotation"] = {
                "sector": sector,
                "sector_etf": etf,
                "sector_etf_3mo_return_pct": etf_perf,
                "spy_3mo_return_pct": spy_perf,
                "relative_strength_pct": (
                    _f(etf_perf - spy_perf, 2)
                    if etf_perf is not None and spy_perf is not None else None
                ),
            }
            fulfilled.append("sector_rotation")
        else:
            unavailable.append("sector_rotation")
            notes.append(f"sector_rotation: no sector ETF mapping for sector={sector!r}")

    # ---- FRED-backed economic intents ----
    fred_requested = [i for i in intents if i in _FRED_INTENTS]
    if fred_requested and not (fred and fred.enabled):
        unavailable.extend(fred_requested)
        notes.append(
            "rates/inflation/growth_cycle unavailable: no FRED_API_KEY set "
            "(get a free key at https://fredaccount.stlouisfed.org/apikeys). "
            "Do NOT answer interest-rate / inflation / GDP questions without it."
        )
    elif fred_requested:
        if "rates" in intents:
            out["rates"] = {
                "fed_funds_rate": fred.latest("FEDFUNDS"),
                "treasury_10y": fred.latest("DGS10"),
                "treasury_2y": fred.latest("DGS2"),
                "yield_curve_10y_2y": fred.latest("T10Y2Y"),
            }
            fulfilled.append("rates")
        if "inflation" in intents:
            out["inflation"] = {
                "cpi_yoy": fred.yoy("CPIAUCSL"),
                "core_cpi_yoy": fred.yoy("CPILFESL"),
                "breakeven_inflation_10y": fred.latest("T10YIE"),
            }
            fulfilled.append("inflation")
        if "growth_cycle" in intents:
            out["growth_cycle"] = {
                "unemployment_rate": fred.latest("UNRATE"),
                "nonfarm_payrolls": fred.latest("PAYEMS"),
                "industrial_production_yoy": fred.yoy("INDPRO"),
                "real_gdp": fred.latest("GDPC1"),
                "consumer_sentiment": fred.latest("UMCSENT"),
            }
            fulfilled.append("growth_cycle")

    return out, fulfilled, unavailable


def _latest_close(session, symbol, period="5d"):
    try:
        h = yf.Ticker(symbol, session=session).history(period=period)
        if h.empty:
            return None
        last = h["Close"].iloc[-1]
        first = h["Close"].iloc[0]
        return {
            "latest": _f(last, 2),
            "change_pct": _f((last / first - 1) * 100, 2) if first else None,
        }
    except Exception:
        return None


def _period_return(session, symbol, period):
    try:
        h = yf.Ticker(symbol, session=session).history(period=period)
        if h.empty:
            return None
        return _f((h["Close"].iloc[-1] / h["Close"].iloc[0] - 1) * 100, 2)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def build_asset_context(symbol, intents=None, fred=None, session=None,
                        history_period="1y"):
    """Assemble grounded context for `symbol` across the requested `intents`.

    Parameters
    ----------
    symbol : str
        Ticker, e.g. "AAPL".
    intents : list[str] | None
        Subset of ALL_INTENTS. None => all of them.
    fred : FredClient | None
        Provide one (reused across symbols) to enable rates/inflation/
        growth_cycle. None => those intents are reported unavailable.
    session : curl_cffi session | None
        Reused Yahoo session. None => module-level shared session.
    history_period : str
        Lookback window for technical/market-sensitivity calcs.

    Returns
    -------
    dict (JSON-serializable) with keys: symbol, as_of, intents_requested,
    intents_fulfilled, intents_unavailable, technical, fundamental, macro, notes.
    """
    symbol = symbol.upper()
    requested = list(intents) if intents else list(ALL_INTENTS)
    requested = [i for i in requested if i in ALL_INTENTS]
    session = session or _get_session()
    ticker = yf.Ticker(symbol, session=session)

    ctx = {
        "symbol": symbol,
        "as_of": datetime.now().isoformat(),
        "intents_requested": requested,
        "intents_fulfilled": [],
        "intents_unavailable": [],
        "technical": {},
        "fundamental": {},
        "macro": {},
        "notes": [],
    }

    need_history = any(
        i in requested for i in TECHNICAL_INTENTS + ["market_sensitivity"]
    )
    need_info = any(
        i in requested
        for i in FUNDAMENTAL_INTENTS + ["market_sensitivity", "sector_rotation"]
    )

    hist = None
    if need_history:
        try:
            hist = ticker.history(period=history_period)
            if hist.empty:
                ctx["notes"].append(f"No price history returned for {symbol}.")
        except Exception as e:
            ctx["notes"].append(f"Price history fetch failed: {e}")

    info = None
    if need_info:
        try:
            info = ticker.info
        except Exception as e:
            ctx["notes"].append(f"ticker.info fetch failed (fundamentals limited): {e}")
            info = {}

    # Technical
    tech_intents = [i for i in requested if i in TECHNICAL_INTENTS]
    if tech_intents:
        try:
            data, done = _technical(tech_intents, hist)
            ctx["technical"] = data
            ctx["intents_fulfilled"] += done
            ctx["intents_unavailable"] += [i for i in tech_intents if i not in done]
        except Exception as e:
            ctx["notes"].append(f"technical block failed: {e}")
            ctx["intents_unavailable"] += tech_intents

    # Fundamental
    fund_intents = [i for i in requested if i in FUNDAMENTAL_INTENTS]
    if fund_intents:
        try:
            data, done = _fundamental(fund_intents, ticker, info)
            ctx["fundamental"] = data
            ctx["intents_fulfilled"] += done
            ctx["intents_unavailable"] += [i for i in fund_intents if i not in done]
        except Exception as e:
            ctx["notes"].append(f"fundamental block failed: {e}")
            ctx["intents_unavailable"] += fund_intents

    # Macro
    macro_intents = [i for i in requested if i in MACRO_INTENTS]
    if macro_intents:
        try:
            data, done, unavail = _macro(
                macro_intents, ticker, info, hist, session, fred, ctx["notes"]
            )
            ctx["macro"] = data
            ctx["intents_fulfilled"] += done
            ctx["intents_unavailable"] += unavail
        except Exception as e:
            ctx["notes"].append(f"macro block failed: {e}")
            ctx["intents_unavailable"] += macro_intents

    # Honesty pass: an intent only counts as "fulfilled" if its block actually
    # holds data. All-null blocks (e.g. a blocked ticker.info) are demoted to
    # unavailable and dropped, so the prompt never claims data it doesn't have.
    really_fulfilled = []
    for i in ctx["intents_fulfilled"]:
        cat = _CATEGORY_OF.get(i)
        block = ctx.get(cat, {}).get(i)
        if _has_data(block):
            really_fulfilled.append(i)
        else:
            ctx["intents_unavailable"].append(i)
            ctx.get(cat, {}).pop(i, None)
    ctx["intents_fulfilled"] = really_fulfilled

    # de-dup while preserving order
    ctx["intents_fulfilled"] = list(dict.fromkeys(ctx["intents_fulfilled"]))
    ctx["intents_unavailable"] = list(dict.fromkeys(ctx["intents_unavailable"]))
    return _clean(ctx)


# --------------------------------------------------------------------------- #
# Prompt formatting (context dict -> chat messages for Ollama/Nemotron)
# --------------------------------------------------------------------------- #
def _humanize(key):
    return key.replace("_", " ")


def _render_block(d, indent=0):
    """Pretty-print a nested context block, skipping None/empty leaves."""
    out = []
    pad = "  " * indent
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, dict):
            inner = _render_block(v, indent + 1)
            if inner.strip():
                out.append(f"{pad}{_humanize(k)}:")
                out.append(inner)
        elif isinstance(v, (list, tuple)):
            vals = [x for x in v if x is not None]
            if vals:
                out.append(f"{pad}{_humanize(k)}: {vals}")
        else:
            out.append(f"{pad}{_humanize(k)}: {v}")
    return "\n".join(out)


def build_prompt(context, question, persona=None, max_chars=None):
    """Turn a build_asset_context() dict + a user question into chat messages.

    Returns a list of {"role", "content"} dicts ready for an OpenAI-compatible
    chat API (Ollama's /v1/chat/completions). The system message renders only
    grounded data and explicitly tells the model which topics it has NO data
    for, so a local model declines instead of fabricating.

    Parameters
    ----------
    context : dict      output of build_asset_context()
    question : str      the user's question
    persona : str|None  role line, e.g. "a technical analyst". Defaults generic.
    max_chars : int|None optional hard cap on the system message length.
    """
    symbol = context.get("symbol", "the asset")
    fulfilled = context.get("intents_fulfilled", [])
    unavailable = context.get("intents_unavailable", [])
    role = persona or "a financial markets analyst"

    lines = [
        f"You are {role}. Answer the user's question about {symbol} using ONLY "
        f"the grounded data provided below.",
        f"Data timestamp: {context.get('as_of', 'unknown')}",
        "",
    ]

    for cat in ("technical", "fundamental", "macro"):
        block = context.get(cat) or {}
        rendered = _render_block(block)
        if rendered.strip():
            lines.append(f"=== {cat.upper()} DATA ===")
            lines.append(rendered)
            lines.append("")

    if fulfilled:
        topics = ", ".join(INTENT_TOPIC.get(i, i) for i in fulfilled)
        lines.append(f"DATA YOU HAVE: {topics}.")
    if unavailable:
        topics = ", ".join(INTENT_TOPIC.get(i, i) for i in unavailable)
        lines.append(
            f"DATA YOU DO NOT HAVE: {topics}. If the question depends on any of "
            f"these, state that you don't have the data rather than estimating, "
            f"recalling from memory, or guessing."
        )

    notes = context.get("notes") or []
    if notes:
        lines.append("")
        lines.append("CONTEXT NOTES:")
        lines.extend(f"- {n}" for n in notes)

    lines.extend([
        "",
        "GUIDELINES:",
        "- Ground every figure in the data above; never invent numbers.",
        "- Briefly explain indicators/metrics for educational context.",
        "- Do not give personalized buy/sell advice or price predictions.",
        "- If data is missing or looks stale, say so explicitly.",
    ])

    system = "\n".join(lines)
    if max_chars and len(system) > max_chars:
        system = system[:max_chars].rstrip() + "\n...[truncated]"

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]


def analyze_asset(symbol, question, intents=None, fred=None, session=None,
                  persona=None, history_period="1y"):
    """Convenience: route the question to intents, build context, format prompt.

    Returns {"context": <dict>, "messages": <list>}. The caller hands `messages`
    to Ollama/Nemotron; `context` is kept for logging/inspection.
    If `intents` is None it is inferred from the question via route_intents().
    """
    chosen = intents or route_intents(question)
    context = build_asset_context(
        symbol, intents=chosen, fred=fred, session=session,
        history_period=history_period,
    )
    messages = build_prompt(context, question, persona=persona)
    return {"context": context, "messages": messages}


# --------------------------------------------------------------------------- #
# CLI smoke test
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import json
    import sys

    sym = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    fred = FredClient()  # picks up FRED_API_KEY if present
    result = build_asset_context(sym, fred=fred)
    print(json.dumps(result, indent=2, default=str))
