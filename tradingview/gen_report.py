#!/usr/bin/env python3
"""
Generate a written report (HTML) from LIVE market data, no Flask needed.

    python gen_report.py opening    # Opening Bell (default)
    python gen_report.py closing    # Closing Bell

Loads .env for any keys (OpenAI optional — falls back gracefully), builds the
report context via report_engine, renders the email template with Jinja, writes
the HTML to /tmp, and prints a quick data summary.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
sys.path.insert(0, str(HERE))

# load .env (simple KEY=VALUE) so any configured keys are picked up
envf = HERE / ".env"
if envf.exists():
    for line in envf.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import report_engine as E
from jinja2 import Environment, FileSystemLoader, select_autoescape

kind = (sys.argv[1] if len(sys.argv) > 1 else "opening").lower()
template = "opening_bell_email.html" if kind == "opening" else "closing_bell_email.html"
build = E.build_opening_bell_context if kind == "opening" else E.build_closing_bell_context

print(f"Fetching LIVE market data for the {kind} bell (this calls yfinance)...")
ctx = build()

env = Environment(loader=FileSystemLoader("templates"), autoescape=select_autoescape(["html"]))
html = env.get_template(template).render(**ctx)
out = f"/tmp/{kind}_bell_live.html"
Path(out).write_text(html)

print("\n=== " + ctx["subject"] + " ===")
print("generated:", ctx["generated_at"])
if kind == "opening":
    for f in ctx["futures"]:
        if f.get("ok"):
            print(f"  {f['name']}: {E.fmt_pct(f.get('change_pct'))}")
    reg = ctx.get("regime")
    print("  regime:", reg["label"] if reg else "n/a", "—", ", ".join(reg["drivers"]) if reg else "")
    tm = ctx.get("trading_map") or {}
    if tm.get("levels"):
        lv = tm["levels"]
        print(f"  S&P prior close {E.fmt_num(lv['prior_close'],0)} | 200-DMA {E.fmt_num(lv['dma200'],0)} | RSI {E.fmt_num(lv['rsi'],0)}")
    if tm.get("vix_term"):
        print(f"  VIX term: {tm['vix_term']['state']} (ratio {tm['vix_term']['ratio']})")
    print(f"  news intel rows: {len(ctx.get('news_intel') or [])}")
else:
    for i in ctx["indices"]:
        if i.get("ok"):
            print(f"  {i['name']}: {E.fmt_pct(i.get('change_pct'))}")

kb = round(len(html.encode("utf-8")) / 1024, 1)
print(f"\nwrote {kb} KB -> {out}")
