#!/usr/bin/env python3
"""
Closing Bell -> narrated explainer video.

Pipeline:  briefing data  ->  narration script  ->  OpenAI TTS (tts-1)
           ->  Manim render (closing_bell_scene.py)  ->  muxed MP4.

Decoupled from Flask: pass --mock to render the bundled sample data with no
keys/network (audio is skipped automatically when OPENAI_API_KEY is absent).

Examples:
    python make_video.py --mock --no-audio          # fastest visual check
    python make_video.py --mock                      # + TTS narration (needs key)
    python make_video.py --closing                   # live data (needs yfinance)
    python make_video.py --closing -q h --voice onyx
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(parents=True, exist_ok=True)


def video_sources(ctx):
    """Numbered sources for the on-screen citation card (source + domain)."""
    out = []
    for s in ctx.get("sources", []):
        ref = ""
        try:
            ref = urlparse(s.get("url", "")).netloc.replace("www.", "")
        except Exception:
            ref = ""
        out.append({"n": s.get("n"), "source": s.get("source", ""), "ref": ref})
    return out[:7]

MOCK = {
    "title": "THE CLOSING BELL",
    "date": "Friday, June 14, 2026",
    "stamp": "Friday, June 14, 2026 · 4:05 PM ET",
    "time": "4:05 PM ET",
    "headline": "After the Bell",
    "indices": [
        {"name": "S&P 500", "value": "6,945", "change_pct": 0.62},
        {"name": "Nasdaq", "value": "22,150", "change_pct": 0.91},
        {"name": "Dow Jones", "value": "44,210", "change_pct": 0.28},
        {"name": "Russell 2000", "value": "2,310", "change_pct": -0.41},
    ],
    "sectors": [
        {"name": "Technology", "change_pct": 1.21}, {"name": "Communication Svcs", "change_pct": 1.02},
        {"name": "Cons. Discretionary", "change_pct": 0.83}, {"name": "Financials", "change_pct": 0.44},
        {"name": "Industrials", "change_pct": 0.31}, {"name": "Health Care", "change_pct": 0.12},
        {"name": "Materials", "change_pct": -0.14}, {"name": "Cons. Staples", "change_pct": -0.22},
        {"name": "Real Estate", "change_pct": -0.35}, {"name": "Utilities", "change_pct": -0.51},
        {"name": "Energy", "change_pct": -1.62},
    ],
    "gainers": [{"symbol": "NVDA", "change_pct": 3.81}, {"symbol": "AVGO", "change_pct": 2.94},
                {"symbol": "AMD", "change_pct": 2.41}, {"symbol": "TSLA", "change_pct": 2.05}],
    "losers": [{"symbol": "CVX", "change_pct": -2.63}, {"symbol": "XOM", "change_pct": -2.18},
               {"symbol": "PG", "change_pct": -1.42}, {"symbol": "KO", "change_pct": -1.08}],
    "tone": "Risk tone constructive — a falling VIX and firm breadth point to risk-on positioning into the close.",
    "breadth": {"adv": 18, "decl": 12},
    "sources": [
        {"n": 1, "source": "Yahoo Finance", "ref": "finance.yahoo.com"},
        {"n": 2, "source": "CNBC", "ref": "cnbc.com"},
        {"n": 3, "source": "MarketWatch", "ref": "marketwatch.com"},
    ],
}

MOCK_OPENING = {
    "title": "THE OPENING BELL", "date": "Friday, June 14, 2026",
    "stamp": "Friday, June 14, 2026 · 8:15 AM ET", "time": "8:15 AM ET",
    "headline": "Before the Bell",
    "regime": {"label": "Risk-On", "color": "#16A34A",
               "drivers": ["VIX contango", "low VIX", "futures higher"]},
    "question": "Does this morning's CPI confirm the disinflation trend the Fed needs to cut in September?",
    "levels": {"implied_open": "6,974", "implied_pct": "+0.34%", "vix_term": "Contango (calm)",
               "vix_ratio": "0.87", "pivot": "6,947", "r1": "6,965", "s1": "6,931",
               "dma200": "6,420", "rsi": "61"},
    "news_top": "NVDA down 2 to 3 percent likely on fresh China export curbs",
    "scoreboard_title": "U.S. Stock Futures",
    "indices": [
        {"name": "S&P 500 Futures", "value": "6,958", "change_pct": 0.34},
        {"name": "Nasdaq 100 Futures", "value": "25,120", "change_pct": 0.51},
        {"name": "Dow Futures", "value": "44,380", "change_pct": 0.18},
        {"name": "Russell Futures", "value": "2,318", "change_pct": 0.12},
    ],
    "bars_title": "Overnight & Global Markets",
    "sectors": [
        {"name": "Nikkei 225", "change_pct": 1.10}, {"name": "Hang Seng", "change_pct": 0.65},
        {"name": "FTSE 100", "change_pct": 0.22}, {"name": "DAX", "change_pct": -0.18},
        {"name": "Euro Stoxx 50", "change_pct": -0.30},
    ],
    "movers_title": "Pre-Market Movers",
    "gainers": [{"symbol": "ORCL", "change_pct": 4.20}, {"symbol": "ADBE", "change_pct": 3.10},
                {"symbol": "NVDA", "change_pct": 1.80}, {"symbol": "AMD", "change_pct": 1.20}],
    "losers": [{"symbol": "BA", "change_pct": -2.10}, {"symbol": "NKE", "change_pct": -1.60},
               {"symbol": "INTC", "change_pct": -1.20}, {"symbol": "PFE", "change_pct": -0.80}],
    "radar_title": "On the Radar Today",
    "radar": [
        {"text": "8:30a ET — CPI (May), consensus +0.2% m/m"},
        {"text": "8:30a ET — Initial jobless claims"},
        {"text": "2:00p ET — Fed speakers; Powell remarks"},
        {"text": "After close — earnings: ORCL, ADBE"},
        {"text": "Before open — earnings: KR"},
    ],
    "tone": "Pre-market setup risk-on — firm futures and a strong Asia session set a constructive tone into the open; CPI at 8:30 is the swing factor.",
    "breadth": {"adv": 4, "decl": 4},
    "sources": [
        {"n": 1, "source": "Yahoo Finance", "ref": "finance.yahoo.com"},
        {"n": 2, "source": "SEC EDGAR", "ref": "sec.gov"},
        {"n": 3, "source": "Federal Reserve", "ref": "federalreserve.gov"},
        {"n": 4, "source": "GDELT", "ref": "gdeltproject.org"},
    ],
}


def from_live_opening():
    """Build clean video data from the live opening-bell engine context."""
    sys.path.insert(0, str(HERE.parent))
    import report_engine as E
    ctx = E.build_opening_bell_context()
    fut = []
    for f in ctx["futures"]:
        if f.get("ok"):
            v = f.get("price") or 0
            fut.append({"name": f["name"].replace(" Futures", " Fut."),
                        "value": f"{v:,.0f}" if v > 1000 else f"{v:,.2f}",
                        "change_pct": round(f.get("change_pct") or 0, 2)})
    tm = ctx.get("trading_map") or {}
    reg = ctx.get("regime")
    io, vt, lvl = tm.get("implied_open"), tm.get("vix_term"), tm.get("levels")
    levels = None
    if io or vt or lvl:
        levels = {}
        if io:
            levels["implied_open"] = f"{io['implied_open']:,.0f}"
            levels["implied_pct"] = f"{io['es_pct']:+.2f}%"
        if vt:
            levels["vix_term"] = vt["state"]; levels["vix_ratio"] = vt["ratio"]
        if lvl:
            levels.update({"pivot": f"{lvl['pivot']:,.0f}", "r1": f"{lvl['r1']:,.0f}",
                           "s1": f"{lvl['s1']:,.0f}",
                           "dma200": f"{lvl['dma200']:,.0f}" if lvl.get("dma200") else "",
                           "rsi": f"{lvl['rsi']:.0f}" if lvl.get("rsi") else ""})
    news = ctx.get("news_intel") or []
    news_top = re.sub(r"[*_\[\]#]", "", news[0]["one_liner"]) if news else None
    return {
        "title": "THE OPENING BELL", "date": ctx["date_str"],
        "stamp": ctx["generated_at"], "time": ctx["time_str"], "headline": "Before the Bell",
        "regime": ({"label": reg["label"], "color": reg["color"], "drivers": reg["drivers"][:3]} if reg else None),
        "question": re.sub(r"[*_\[\]#]", "", ctx.get("question_text", "")).strip() or None,
        "levels": levels, "news_top": news_top,
        "scoreboard_title": "U.S. Stock Futures", "indices": fut,
        "bars_title": "Overnight & Global Markets",
        "sectors": [{"name": o["name"], "change_pct": round(o["change_pct"], 2)} for o in ctx["overnight"]],
        "movers_title": "Pre-Market Movers",
        "gainers": [{"symbol": g["symbol"], "change_pct": round(g["change_pct"], 2)} for g in ctx["gainers"]],
        "losers": [{"symbol": g["symbol"], "change_pct": round(g["change_pct"], 2)} for g in ctx["losers"]],
        "radar_title": "On the Radar Today",
        "radar": [{"text": re.sub(r"[*_#]", "", r["text"])} for r in ctx.get("radar", [])],
        "tone": ("Risk-on setup into the open." if (fut and fut[0]["change_pct"] >= 0)
                 else "Cautious setup into the open."),
        "breadth": ctx["breadth"], "sources": video_sources(ctx),
    }


def from_live():
    """Build clean video data from the live closing-bell engine context."""
    sys.path.insert(0, str(HERE.parent))
    import report_engine as E
    ctx = E.build_closing_bell_context()
    idx = []
    for i in ctx["indices"]:
        if i.get("ok"):
            v = i.get("price") or 0
            idx.append({"name": i["name"],
                        "value": f"{v:,.0f}" if v > 1000 else f"{v:,.2f}",
                        "change_pct": round(i.get("change_pct") or 0, 2)})
    tone = "Risk tone " + ("constructive" if (ctx.get("best_sector") and idx and idx[0]["change_pct"] >= 0) else "cautious") + \
           f" — {ctx['breadth']['adv']} advancers versus {ctx['breadth']['decl']} decliners across the tracked universe."
    return {
        "title": "THE CLOSING BELL", "date": ctx["date_str"],
        "stamp": ctx["generated_at"], "time": ctx["time_str"], "headline": "After the Bell",
        "indices": idx,
        "sectors": [{"name": s["name"], "change_pct": round(s["change_pct"], 2)} for s in ctx["sectors"]],
        "gainers": [{"symbol": g["symbol"], "change_pct": round(g["change_pct"], 2)} for g in ctx["gainers"]],
        "losers": [{"symbol": g["symbol"], "change_pct": round(g["change_pct"], 2)} for g in ctx["losers"]],
        "tone": tone, "breadth": ctx["breadth"], "sources": video_sources(ctx),
    }


def build_script(d):
    """Compose a ~150-190 word narration grounded in the data."""
    def updown(p):
        return "gained" if p >= 0 else "fell"

    when = f", as of the {d['time']} close" if d.get("time") else ""
    parts = [f"Welcome to the Closing Bell for {d.get('date','today')}{when}."]
    idx = d.get("indices", [])
    if idx:
        spx = idx[0]
        parts.append(f"U.S. stocks finished the session {'higher' if spx['change_pct'] >= 0 else 'lower'}. "
                     f"The {spx['name']} {updown(spx['change_pct'])} {abs(spx['change_pct']):.1f} percent to {spx['value']}.")
        if len(idx) > 1:
            rest = ", ".join(f"the {i['name']} {updown(i['change_pct'])} {abs(i['change_pct']):.1f} percent" for i in idx[1:3])
            parts.append(f"Elsewhere, {rest}.")
    b = d.get("breadth")
    if b:
        parts.append(f"Market breadth came in at {b.get('adv',0)} advancers to {b.get('decl',0)} decliners.")
    secs = sorted(d.get("sectors", []), key=lambda s: s["change_pct"], reverse=True)
    if secs:
        lead, lag = secs[0], secs[-1]
        parts.append(f"{lead['name']} led the sectors, up {abs(lead['change_pct']):.1f} percent, "
                     f"while {lag['name']} lagged, down {abs(lag['change_pct']):.1f} percent.")
    g = d.get("gainers", [])
    l = d.get("losers", [])
    if g:
        parts.append(f"Among notable movers, {g[0]['symbol']} jumped {abs(g[0]['change_pct']):.1f} percent.")
    if l:
        parts.append(f"On the downside, {l[0]['symbol']} dropped {abs(l[0]['change_pct']):.1f} percent.")
    tone = re.sub(r"[*_\[\]\(\)#]", "", d.get("tone", "")).strip()
    if tone:
        parts.append(tone if tone.endswith(".") else tone + ".")
    names = list(dict.fromkeys(s.get("source", "") for s in (d.get("sources") or []) if s.get("source")))[:4]
    if names:
        parts.append("Sources: " + ", ".join(names) + ".")
    parts.append("That's your market wrap. Remember, this is for information only, and not investment advice.")
    return " ".join(parts)


def build_script_opening(d):
    """Forward-looking ~150-190 word pre-market narration."""
    def updown(p):
        return "are pointing higher" if p >= 0 else "are pointing lower"

    when = f", as of {d['time']}" if d.get("time") else ""
    parts = [f"Good morning. Here's what to watch before the opening bell on {d.get('date','today')}{when}."]
    reg = d.get("regime")
    if reg:
        parts.append(f"The cross-asset regime reads {reg['label'].lower()}.")
    if d.get("question"):
        parts.append(f"The question that decides today's tape: {d['question']}")
    if d.get("news_top"):
        parts.append(f"The top story this morning: {d['news_top']}.")
    fut = d.get("indices", [])
    if fut:
        s = fut[0]
        parts.append(f"U.S. stock futures {updown(s['change_pct'])}. "
                     f"{s['name']} {'gained' if s['change_pct'] >= 0 else 'fell'} {abs(s['change_pct']):.1f} percent.")
        if len(fut) > 1:
            parts.append("Nasdaq and Dow futures " + ("are firmer as well" if fut[1]['change_pct'] >= 0 else "are softer") + ".")
    secs = sorted(d.get("sectors", []), key=lambda s: s["change_pct"], reverse=True)
    if secs:
        lead, lag = secs[0], secs[-1]
        parts.append(f"Overseas, {lead['name']} {'rose' if lead['change_pct'] >= 0 else 'fell'} "
                     f"{abs(lead['change_pct']):.1f} percent overnight, while {lag['name']} "
                     f"{'gained' if lag['change_pct'] >= 0 else 'lost'} {abs(lag['change_pct']):.1f} percent.")
    g = d.get("gainers", [])
    if g:
        parts.append(f"In pre-market trade, {g[0]['symbol']} is up {abs(g[0]['change_pct']):.1f} percent.")
    radar = d.get("radar", [])
    if radar:
        first = "; ".join(r["text"] for r in radar[:2])
        parts.append(f"On the radar today: {first}.")
    tone = re.sub(r"[*_\[\]\(\)#]", "", d.get("tone", "")).strip()
    if tone:
        parts.append(tone if tone.endswith(".") else tone + ".")
    names = list(dict.fromkeys(s.get("source", "") for s in (d.get("sources") or []) if s.get("source")))[:4]
    if names:
        parts.append("Sources: " + ", ".join(names) + ".")
    parts.append("That's your pre-market setup. This is for information only, and not investment advice.")
    return " ".join(parts)


def tts(script, voice):
    """
    Synthesize narration via any OpenAI-compatible /v1/audio/speech endpoint.

    Defaults to OpenAI (tts-1). Point at a self-hosted Higgs Audio v3 on the
    Dell GB10 Max — or the Boson API — with NO code change, just env vars:
        TTS_BASE_URL=http://<gb10-host>:8000/v1   # sgl-omni serve ...
        TTS_MODEL=higgs-audio-v3-tts
        TTS_API_KEY=...        # or BOSON_API_KEY for api.boson.ai
        TTS_VOICE=<preset or cloned voice>
    """
    base_url = os.getenv("TTS_BASE_URL")  # None -> OpenAI default endpoint
    api_key = (os.getenv("TTS_API_KEY") or os.getenv("BOSON_API_KEY")
               or os.getenv("OPENAI_API_KEY"))
    model = os.getenv("TTS_MODEL", os.getenv("REPORT_TTS_MODEL", "tts-1"))
    voice = os.getenv("TTS_VOICE", voice)
    if not base_url and not api_key:
        print("  (no TTS endpoint/key — skipping narration; set TTS_BASE_URL or OPENAI_API_KEY)")
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key or "local", base_url=base_url or None)
        dest = OUT / "narration.mp3"
        with client.audio.speech.with_streaming_response.create(
                model=model, voice=voice, input=script) as resp:
            resp.stream_to_file(dest)
        print(f"  narration ({model} via {base_url or 'OpenAI'}) -> {dest}")
        return dest
    except Exception as e:  # noqa: BLE001
        print(f"  TTS failed ({e}); rendering silent.")
        return None


def audio_duration(path):
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True)
        return float(out.strip())
    except Exception:
        return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mock", action="store_true", help="use bundled sample data")
    ap.add_argument("--closing", action="store_true", help="closing-bell report (default)")
    ap.add_argument("--opening", action="store_true", help="opening-bell (pre-market) report")
    ap.add_argument("--no-audio", action="store_true", help="render silent (skip TTS)")
    ap.add_argument("--voice", default="onyx", help="TTS voice")
    ap.add_argument("-q", "--quality", default="m", choices=["l", "m", "h"], help="l/m/h render quality")
    args = ap.parse_args()

    opening = args.opening
    name = "opening_bell" if opening else "closing_bell"
    if args.mock:
        data = MOCK_OPENING if opening else MOCK
    else:
        data = from_live_opening() if opening else from_live()
    print(f"1/4  {name} data ready:", len(data.get("indices", [])), "scoreboard,",
          len(data.get("sectors", [])), "bars,", len(data.get("radar", [])), "radar")

    script = build_script_opening(data) if opening else build_script(data)
    (OUT / "script.txt").write_text(script)
    print(f"2/4  script ({len(script.split())} words) -> {OUT/'script.txt'}")

    audio = None if args.no_audio else tts(script, args.voice)
    target = audio_duration(audio) + 1.0 if audio else 0.0

    data_path = OUT / "scene_data.json"
    data_path.write_text(json.dumps(data))

    env = dict(os.environ, MANIM_DATA=str(data_path))
    if audio:
        env["MANIM_AUDIO"] = str(audio)
    if target:
        env["MANIM_TARGET_DURATION"] = str(target)

    media = OUT / "media"
    outfile = f"{name}.mp4"
    cmd = ["manim", f"-q{args.quality}", "--media_dir", str(media),
           "-o", outfile, str(HERE / "closing_bell_scene.py"), "ClosingBellVideo"]
    print("3/4  rendering:", " ".join(cmd))
    subprocess.run(cmd, env=env, check=True)

    # Pick the NEWEST match — media/ may hold stale renders at other resolutions.
    found = sorted(media.glob(f"videos/**/{outfile}"), key=lambda p: p.stat().st_mtime)
    if not found:
        print("ERROR: rendered file not found under", media); sys.exit(1)
    final = OUT / outfile
    shutil.copyfile(found[-1], final)
    print(f"4/4  DONE -> {final}")
    if target:
        print(f"     ~{target-1:.0f}s narrated")


if __name__ == "__main__":
    main()
