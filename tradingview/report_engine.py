# report_engine.py
"""
Server-side engine for the email-deliverable Jinja stock research report.

Everything here degrades gracefully: if yfinance, the LLM, or the network is
unavailable the report still renders with whatever could be gathered. The
output HTML is built to be *email-safe* (inline styles, table layout, no JS)
and is kept under Gmail's ~102 KB clip limit by build_report_context().

Reuses the data fields and the web-search citation pattern already proven in
app.py (get_market_data, /api/chat, get_top_news).
"""
from __future__ import annotations

import os
import re
import secrets
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from urllib.parse import quote

from markupsafe import escape, Markup

# Gmail clips HTML emails larger than ~102,400 bytes. Stay comfortably under.
CLIP_LIMIT_BYTES = 102_400
TRIM_THRESHOLD_BYTES = 95_000

NARRATIVE_MODEL = os.getenv("REPORT_MODEL", "gpt-4o")
SEARCH_MODEL = os.getenv("REPORT_SEARCH_MODEL", "gpt-4o-mini-search-preview")

MAX_TICKERS = 4


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------
def _f(v):
    """Coerce to float or return None."""
    try:
        if v is None or v == "":
            return None
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except (TypeError, ValueError):
        return None


def fmt_big(v):
    n = _f(v)
    if n is None or n == 0:
        return "—"
    sign = "-" if n < 0 else ""
    n = abs(n)
    for div, suf in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if n >= div:
            return f"{sign}${n / div:.2f}{suf}"
    return f"{sign}${n:,.0f}"


def fmt_money(v, dp=2):
    n = _f(v)
    return f"${n:,.{dp}f}" if n is not None else "—"


def fmt_pct(v, dp=2, signed=True):
    n = _f(v)
    if n is None:
        return "—"
    return f"{n:+.{dp}f}%" if signed else f"{n:.{dp}f}%"


def fmt_num(v, dp=2):
    n = _f(v)
    return f"{n:,.{dp}f}" if n is not None else "—"


def _as_percent(v):
    """yfinance returns margins/growth/yield as fractions (0.23) -> 23.0."""
    n = _f(v)
    return n * 100 if n is not None else None


# ---------------------------------------------------------------------------
# Data: per-ticker snapshot
# ---------------------------------------------------------------------------
def fetch_snapshot(symbol):
    """Pull a comprehensive snapshot for one ticker. Never raises."""
    symbol = symbol.strip().upper()
    snap = {"symbol": symbol, "ok": False, "error": None}
    try:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        hist = ticker.history(period="1y")
        closes = list(hist["Close"].dropna()) if hist is not None and not hist.empty else []

        price = _f(info.get("currentPrice")) or _f(info.get("regularMarketPrice"))
        if price is None and closes:
            price = closes[-1]
        prev = _f(info.get("previousClose"))
        if prev is None and len(closes) >= 2:
            prev = closes[-2]
        change = (price - prev) if (price is not None and prev is not None) else None
        change_pct = (change / prev * 100) if (change is not None and prev) else None

        def ret_over(days):
            if len(closes) > days and closes[-days - 1]:
                return (closes[-1] / closes[-days - 1] - 1) * 100
            return None

        hi52 = _f(info.get("fiftyTwoWeekHigh")) or (max(closes) if closes else None)
        lo52 = _f(info.get("fiftyTwoWeekLow")) or (min(closes) if closes else None)
        pos52 = None
        if price is not None and hi52 is not None and lo52 is not None and hi52 > lo52:
            pos52 = max(0.0, min(100.0, (price - lo52) / (hi52 - lo52) * 100))

        # ~12 evenly sampled closes for the email-safe mini bar chart
        spark = []
        if closes:
            n = len(closes)
            step = max(1, n // 12)
            spark = [closes[i] for i in range(0, n, step)][-12:]

        target = _f(info.get("targetMeanPrice"))
        upside = (target / price - 1) * 100 if (target and price) else None

        summary = (info.get("longBusinessSummary") or "").strip()

        snap.update(
            {
                "ok": True,
                "name": info.get("shortName") or info.get("longName") or symbol,
                "sector": info.get("sector") or "—",
                "industry": info.get("industry") or "—",
                "currency": info.get("currency") or "USD",
                "summary": summary,
                "price": price,
                "change": change,
                "change_pct": change_pct,
                "prev_close": prev,
                "market_cap": _f(info.get("marketCap")),
                "pe": _f(info.get("trailingPE")),
                "forward_pe": _f(info.get("forwardPE")),
                "ps": _f(info.get("priceToSalesTrailing12Months")),
                "pb": _f(info.get("priceToBook")),
                "beta": _f(info.get("beta")),
                "profit_margin_pct": _as_percent(info.get("profitMargins")),
                "revenue_growth_pct": _as_percent(info.get("revenueGrowth")),
                "div_yield_pct": _as_percent(info.get("dividendYield")),
                "week52_high": hi52,
                "week52_low": lo52,
                "week52_pos": pos52,
                "ret_1m_pct": ret_over(21),
                "ret_6m_pct": ret_over(126),
                "ret_1y_pct": ret_over(252) if len(closes) > 252 else ret_over(len(closes) - 1) if closes else None,
                "spark": spark,
                "target_mean": target,
                "upside_pct": upside,
                "recommendation": (info.get("recommendationKey") or "—").replace("_", " ").title(),
            }
        )
    except Exception as e:  # noqa: BLE001 - never let a bad ticker kill the report
        snap["error"] = str(e)
        snap.setdefault("name", symbol)
    return snap


# ---------------------------------------------------------------------------
# Comparison table (direction-aware best-in-row)
# ---------------------------------------------------------------------------
# (label, key, formatter, better)  better in {"high","low",None}
_METRICS = [
    ("Price", "price", "money", None),
    ("Day change", "change_pct", "pct", "high"),
    ("Market cap", "market_cap", "big", "high"),
    ("P/E (TTM)", "pe", "num", "low"),
    ("Forward P/E", "forward_pe", "num", "low"),
    ("Price / Sales", "ps", "num", "low"),
    ("Profit margin", "profit_margin_pct", "pctp", "high"),
    ("Revenue growth", "revenue_growth_pct", "pct", "high"),
    ("Dividend yield", "div_yield_pct", "pctp", "high"),
    ("Beta", "beta", "num", None),
    ("1-yr return", "ret_1y_pct", "pct", "high"),
    ("Analyst target", "target_mean", "money", None),
    ("Implied upside", "upside_pct", "pct", "high"),
    ("Rating", "recommendation", "text", None),
]


def _fmt_cell(value, kind):
    if kind == "money":
        return fmt_money(value)
    if kind == "big":
        return fmt_big(value)
    if kind == "pct":
        return fmt_pct(value, signed=True)
    if kind == "pctp":
        return fmt_pct(value, signed=False)
    if kind == "num":
        return fmt_num(value)
    return str(value) if value not in (None, "") else "—"


def build_comparison(snapshots):
    rows = []
    for label, key, kind, better in _METRICS:
        cells = []
        numeric = []
        for s in snapshots:
            val = s.get(key)
            numeric.append(_f(val) if kind != "text" else None)
            cells.append({"text": _fmt_cell(val, kind), "best": False})
        # determine best index
        best_idx = None
        if better and any(v is not None for v in numeric):
            valid = [(i, v) for i, v in enumerate(numeric) if v is not None]
            if len(valid) > 1:
                best_idx = (max(valid, key=lambda t: t[1]) if better == "high"
                            else min(valid, key=lambda t: t[1]))[0]
        if best_idx is not None:
            cells[best_idx]["best"] = True
        rows.append({"label": label, "cells": cells})
    return rows


# ---------------------------------------------------------------------------
# Email-safe "charts" (tables + bgcolor, no SVG / no JS)
# ---------------------------------------------------------------------------
GREEN = "#16a34a"
RED = "#dc2626"
SLATE = "#64748b"


def compute_visuals(s):
    """Attach bar/range geometry used by the email template."""
    # Monthly mini bar chart
    spark = s.get("spark") or []
    bars = []
    if len(spark) >= 2:
        lo, hi = min(spark), max(spark)
        rng = (hi - lo) or 1
        up = spark[-1] >= spark[0]
        color = GREEN if up else RED
        for v in spark:
            h = 6 + round((v - lo) / rng * 38)  # 6..44 px
            bars.append({"h": h, "color": color})
    s["spark_bars"] = bars
    s["spark_color"] = GREEN if (len(spark) >= 2 and spark[-1] >= spark[0]) else RED

    # Performance bars (relative to this ticker's own largest move)
    perf = []
    vals = {"1M": s.get("ret_1m_pct"), "6M": s.get("ret_6m_pct"), "1Y": s.get("ret_1y_pct")}
    scale = max([abs(v) for v in vals.values() if v is not None] + [1.0])
    for label, v in vals.items():
        if v is None:
            perf.append({"label": label, "text": "—", "width": 0, "color": SLATE})
        else:
            perf.append({
                "label": label,
                "text": fmt_pct(v, signed=True),
                "width": max(2, round(abs(v) / scale * 100)),
                "color": GREEN if v >= 0 else RED,
            })
    s["perf_bars"] = perf
    return s


# ---------------------------------------------------------------------------
# Citations (web search w/ graceful fallback)
# ---------------------------------------------------------------------------
def _fallback_sources(symbol):
    return [
        {"title": f"{symbol} — quote, fundamentals & history", "url": f"https://finance.yahoo.com/quote/{symbol}", "source": "Yahoo Finance"},
        {"title": f"{symbol} SEC filings (EDGAR)", "url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker={symbol}&type=10-K", "source": "SEC EDGAR"},
        {"title": f"{symbol} news & analysis", "url": f"https://www.marketwatch.com/investing/stock/{symbol}", "source": "MarketWatch"},
    ]


def _search_news(symbol, client):
    """Reuses the get_top_news web-search + regex pattern from app.py."""
    resp = client.chat.completions.create(
        model=SEARCH_MODEL,
        web_search_options={},
        messages=[{
            "role": "user",
            "content": (
                f"List the 3 most recent and relevant news items about {symbol} for an investor. "
                f"For each provide:\n- Title\n- URL (source link)\n- Brief summary of the key insight."
            ),
        }],
    )
    content = resp.choices[0].message.content or ""
    items = []
    pattern = (r'\*\*Title:\*\*\s*"?([^"\n]+)"?[\s\S]*?\*\*URL:\*\*\s*\(?\[?[^\]]*\]?\(?'
               r'(https?://[^\s)\]]+)\)?[\s\S]*?\*\*Summary:\*\*\s*(.*?)(?=\n\d+\.|\n\*\*Title|$)')
    for title, url, summary in re.findall(pattern, content, re.DOTALL):
        items.append({"title": title.strip(), "url": url.strip(), "summary": summary.strip(), "source": "Web"})
    if not items:  # fallback: any markdown links
        for title, url in re.findall(r'\[([^\]]+)\]\((https?://[^)]+)\)', content):
            items.append({"title": title.strip(), "url": url.strip(), "summary": "", "source": "Web"})
    return items[:3]


def fetch_citations(symbols):
    """
    Returns (numbered_sources, per_symbol_news).
    numbered_sources: [{"n", "title", "url", "source", "summary"}], always non-empty.
    per_symbol_news:  {symbol: [items with "n" assigned]}
    """
    sources = []
    per_symbol = {s: [] for s in symbols}

    client = None
    if os.getenv("OPENAI_API_KEY"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        except Exception:
            client = None

    # Data provenance is always source [1].
    n = 1
    sources.append({
        "n": n, "title": "Market & fundamental data (quotes, valuation, history)",
        "url": f"https://finance.yahoo.com/quote/{symbols[0]}", "source": "Yahoo Finance", "summary": "",
    })

    for sym in symbols:
        items = []
        if client is not None:
            try:
                items = _search_news(sym, client)
            except Exception:
                items = []
        if not items:
            items = _fallback_sources(sym)[:2]
        for it in items:
            n += 1
            it = {**it, "n": n, "summary": it.get("summary", "")}
            sources.append(it)
            per_symbol[sym].append(it)
    return sources, per_symbol


# ---------------------------------------------------------------------------
# Narrative (gpt-4o, grounded in the data, cites [n])
# ---------------------------------------------------------------------------
def _data_context(snapshots):
    lines = []
    for s in snapshots:
        lines.append(
            f"{s['symbol']} ({s.get('name')}) | sector {s.get('sector')} | "
            f"price {fmt_money(s.get('price'))} ({fmt_pct(s.get('change_pct'))}) | "
            f"mktcap {fmt_big(s.get('market_cap'))} | P/E {fmt_num(s.get('pe'))} | "
            f"fwd P/E {fmt_num(s.get('forward_pe'))} | P/S {fmt_num(s.get('ps'))} | "
            f"margin {fmt_pct(s.get('profit_margin_pct'), signed=False)} | "
            f"rev growth {fmt_pct(s.get('revenue_growth_pct'))} | "
            f"yield {fmt_pct(s.get('div_yield_pct'), signed=False)} | beta {fmt_num(s.get('beta'))} | "
            f"1Y {fmt_pct(s.get('ret_1y_pct'))} | analyst target {fmt_money(s.get('target_mean'))} "
            f"({fmt_pct(s.get('upside_pct'))} upside) | rating {s.get('recommendation')}"
        )
    return "\n".join(lines)


def _split_sections(text):
    out = {"summary": "", "verdict": "", "notes": ""}
    parts = re.split(r"\[\[(SUMMARY|VERDICT|NOTES)\]\]", text)
    if len(parts) > 1:
        for i in range(1, len(parts) - 1, 2):
            key = parts[i].strip().lower()
            out[key] = parts[i + 1].strip()
    else:
        out["summary"] = text.strip()
    return out


def _fallback_narrative(snapshots):
    valid = [s for s in snapshots if s.get("ok")]
    syms = ", ".join(s["symbol"] for s in valid) or "the selected tickers"
    summary = (f"This brief compares **{syms}** using current market and fundamental data. "
               "Figures below are drawn from Yahoo Finance [1]; an AI narrative was unavailable, "
               "so this summary is generated directly from the underlying metrics.")
    verdict = "Set OPENAI_API_KEY to enable the AI verdict. Review the comparison table for relative valuation, growth and momentum."
    if valid:
        by_growth = sorted([s for s in valid if s.get("revenue_growth_pct") is not None],
                           key=lambda s: s["revenue_growth_pct"], reverse=True)
        by_value = sorted([s for s in valid if s.get("pe") is not None], key=lambda s: s["pe"])
        bits = []
        if by_growth:
            bits.append(f"fastest revenue growth: **{by_growth[0]['symbol']}** ({fmt_pct(by_growth[0]['revenue_growth_pct'])})")
        if by_value:
            bits.append(f"cheapest on P/E: **{by_value[0]['symbol']}** ({fmt_num(by_value[0]['pe'])}x)")
        if bits:
            verdict = "On the data: " + "; ".join(bits) + "."
    notes = "\n".join(
        f"- **{s['symbol']}** — {fmt_money(s.get('price'))}, {fmt_pct(s.get('ret_1y_pct'))} over 1Y, "
        f"P/E {fmt_num(s.get('pe'))}, analyst rating {s.get('recommendation')}."
        for s in valid
    )
    return {"summary": summary, "verdict": verdict, "notes": notes}


def generate_narrative(snapshots, sources, question=""):
    valid = [s for s in snapshots if s.get("ok")]
    if not os.getenv("OPENAI_API_KEY") or not valid:
        return _fallback_narrative(snapshots)

    src_lines = "\n".join(f"[{s['n']}] {s['title']} — {s['url']}" for s in sources)
    q = f"\n\nThe reader specifically asked: \"{question}\". Answer it directly in the summary." if question.strip() else ""
    sys = (
        "You are a buy-side equity research analyst writing a concise, professional research brief. "
        "Use ONLY the data provided — never invent figures. When you reference a company fact or "
        "headline, cite the numbered source like [2]. Be specific and quantitative. "
        "Output EXACTLY these three sections with these literal markers:\n"
        "[[SUMMARY]] (2-3 short paragraphs, the big picture across all tickers)\n"
        "[[VERDICT]] (a clear bottom-line: which screens most attractive and why, plus the key risk)\n"
        "[[NOTES]] (one '- **TICKER** — ...' bullet per company). Keep the whole thing under 450 words. "
        "Markdown only: **bold**, '- ' bullets, and [n] citations."
    )
    user = f"DATA:\n{_data_context(snapshots)}\n\nNUMBERED SOURCES:\n{src_lines}{q}"
    try:
        import llm_router
        resp = llm_router.chat_completion(
            model=NARRATIVE_MODEL,
            messages=[{"role": "system", "content": sys}, {"role": "user", "content": user}],
            temperature=0.5,
            max_tokens=1100,
        )
        return _split_sections(resp.choices[0].message.content or "")
    except Exception:
        return _fallback_narrative(snapshots)


# ---------------------------------------------------------------------------
# Minimal, email-safe markdown -> HTML
# ---------------------------------------------------------------------------
# Serif "research journal" styling, kept inline so it survives email clients.
_SERIF = "Georgia,'Times New Roman',Times,serif"


def render_markdown(text):
    if not text:
        return Markup("")
    blocks = re.split(r"\n\s*\n", text.strip())
    html_parts = []
    for block in blocks:
        lines = [ln.rstrip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        if all(ln.lstrip().startswith(("- ", "* ")) for ln in lines):
            items = "".join(
                f'<li style="margin:0 0 7px;font-family:{_SERIF};font-size:14px;color:#3f3f46;line-height:1.6;">'
                f'{_inline(ln.lstrip()[2:])}</li>' for ln in lines
            )
            html_parts.append(f'<ul style="margin:0 0 12px;padding-left:20px;">{items}</ul>')
        elif lines[0].startswith("## "):
            html_parts.append(
                f'<h3 style="margin:18px 0 8px;font-family:{_SERIF};font-weight:600;'
                f'font-size:19px;color:#1a1a1a;">{_inline(lines[0][3:])}</h3>'
            )
        else:
            joined = "<br>".join(_inline(ln) for ln in lines)
            html_parts.append(
                f'<p style="margin:0 0 12px;font-family:{_SERIF};font-size:14px;'
                f'line-height:1.72;color:#3f3f46;text-align:justify;">{joined}</p>'
            )
    return Markup("".join(html_parts))


def _inline(text):
    s = str(escape(text))
    s = re.sub(r"\*\*(.+?)\*\*", r'<strong style="color:#1a1a1a;font-weight:700;">\1</strong>', s)
    # [n] citation -> superscript maroon link
    s = re.sub(
        r"\[(\d+)\]",
        r'<sup><a href="#src-\1" style="color:#9b1c1c;text-decoration:none;font-weight:700;">[\1]</a></sup>',
        s,
    )
    return s


# ---------------------------------------------------------------------------
# Orchestration + cache + email
# ---------------------------------------------------------------------------
def parse_symbols(raw):
    syms, seen = [], set()
    for tok in re.split(r"[\s,]+", (raw or "").upper()):
        tok = tok.strip()
        if tok and tok not in seen:
            seen.add(tok)
            syms.append(tok)
    return syms[:MAX_TICKERS]


def build_report_context(symbols_raw, question="", recipient=""):
    symbols = parse_symbols(symbols_raw)
    snapshots = [compute_visuals(fetch_snapshot(s)) for s in symbols]
    valid = [s for s in snapshots if s.get("ok")]

    sources, per_symbol_news = fetch_citations(symbols)
    narrative = generate_narrative(snapshots, sources, question)

    base = os.getenv("REPORT_BASE_URL", "http://127.0.0.1:5000").rstrip("/")
    view_qs = "symbols=" + quote(",".join(symbols))
    if question.strip():
        view_qs += "&q=" + quote(question)
    view_url = f"{base}/report/view?{view_qs}"

    title = "Equity Research Brief"
    subject = f"{title}: {' vs '.join(symbols)}" if len(symbols) > 1 else f"{title}: {symbols[0] if symbols else ''}"

    return {
        "title": title,
        "subject": subject,
        "filename": "report_" + "_".join(symbols).lower() + ".html",
        "symbols": symbols,
        "question": question.strip(),
        "recipient": recipient.strip(),
        "snapshots": snapshots,
        "valid_count": len(valid),
        "comparison": build_comparison(snapshots) if len(valid) > 1 else None,
        "per_symbol_news": per_symbol_news,
        "sources": sources,
        "summary_html": render_markdown(narrative.get("summary", "")),
        "verdict_html": render_markdown(narrative.get("verdict", "")),
        "notes_html": render_markdown(narrative.get("notes", "")),
        "view_url": view_url,
        "generated_at": datetime.now().strftime("%B %d, %Y at %I:%M %p"),
        # formatters exposed to the template
        "fmt_money": fmt_money,
        "fmt_big": fmt_big,
        "fmt_pct": fmt_pct,
        "fmt_num": fmt_num,
    }


def plaintext_summary(ctx):
    lines = [ctx["subject"], "", f"View the full report online: {ctx['view_url']}", ""]
    for s in ctx["snapshots"]:
        if s.get("ok"):
            lines.append(f"{s['symbol']} ({s.get('name')}): {fmt_money(s.get('price'))} "
                         f"({fmt_pct(s.get('change_pct'))}), 1Y {fmt_pct(s.get('ret_1y_pct'))}")
    lines += ["", "This brief is for information only and is not investment advice."]
    return "\n".join(lines)


# In-memory cache so view -> download -> send doesn't re-run yfinance + the LLM.
_CACHE = {}
_CACHE_ORDER = []


def cache_report(html, ctx):
    token = secrets.token_urlsafe(8)
    _CACHE[token] = {
        "html": html,
        "subject": ctx["subject"],
        "filename": ctx["filename"],
        "text": plaintext_summary(ctx),
    }
    _CACHE_ORDER.append(token)
    while len(_CACHE_ORDER) > 50:
        _CACHE.pop(_CACHE_ORDER.pop(0), None)
    return token


def get_cached(token):
    return _CACHE.get(token)


def html_size_kb(html):
    return round(len(html.encode("utf-8")) / 1024, 1)


def send_email(to, subject, html, text_fallback=None):
    to = (to or "").strip()
    if not to:
        return {"ok": False, "error": "Recipient email is required."}
    host = os.getenv("SMTP_HOST")
    if not host:
        return {"ok": False, "error": "SMTP is not configured. Set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM in .env."}
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pw = os.getenv("SMTP_PASS")
    sender = os.getenv("SMTP_FROM") or user or "no-reply@localhost"
    use_tls = os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(text_fallback or "Open this message in an HTML-capable client to view the report.", "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            if use_tls:
                server.starttls()
        if user:
            server.login(user, pw)
        server.sendmail(sender, [to], msg.as_string())
        server.quit()
        return {"ok": True, "error": None}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
