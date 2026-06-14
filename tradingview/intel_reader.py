# intel_reader.py
"""
Renderer-side reader for the local news-intelligence pipeline.

The heavy ingestion/classification daemon (GDELT + RSS + SEC EDGAR -> FinBERT
-> local Llama-3.3-70B on the DGX Spark) writes market-moving stories into a
SQLite `stories` table. This module is the *only* thing the report renderer
imports from that pipeline — it uses **stdlib sqlite3 only** (no torch /
transformers / ollama) and opens the DB **read-only**, so rendering an email
never blocks the writer and never pulls in heavy deps.

The SQLite schema is the contract between the daemon and the renderer
(see intel/schema.sql). Everything degrades gracefully: if the DB is absent,
empty, or malformed, get_top_stories() returns [] and the report falls back to
its existing web-search radar.
"""
import json
import os
import sqlite3


def db_path(path=None):
    return path or os.getenv(
        "INTEL_DB", os.path.join(os.path.dirname(__file__), "opening_bell.db"))


def intel_available(path=None):
    p = db_path(path)
    if not os.path.exists(p):
        return False
    try:
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        try:
            row = con.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='stories'"
            ).fetchone()
            return row is not None
        finally:
            con.close()
    except Exception:
        return False


def get_top_stories(limit=6, hours=12, path=None):
    """Top tradeable, processed stories from the last `hours`, ranked by
    magnitude then |sentiment|. Returns [] on any problem (graceful)."""
    p = db_path(path)
    if not intel_available(p):
        return []
    try:
        con = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        try:
            rows = con.execute(
                """
                SELECT title, source, one_liner, tickers, magnitude, sector_impact,
                       bull_case, bear_case, sentiment, impact_type, published_at
                FROM stories
                WHERE tradeable_today = 1 AND processed = 1
                  AND created_at >= datetime('now', ?)
                ORDER BY CASE magnitude
                            WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                         ABS(COALESCE(sentiment, 0)) DESC
                LIMIT ?
                """,
                (f"-{int(hours)} hours", int(limit)),
            ).fetchall()
        finally:
            con.close()
    except Exception:
        return []

    out = []
    for r in rows:
        try:
            tickers = json.loads(r["tickers"]) if r["tickers"] else []
        except Exception:
            tickers = []
        sent = r["sentiment"] or 0.0
        out.append({
            "title": r["title"],
            "source": (r["source"] or "").replace("_", " ").title(),
            "one_liner": r["one_liner"] or r["title"],
            "tickers": tickers[:5],
            "magnitude": (r["magnitude"] or "low").lower(),
            "sector_impact": r["sector_impact"] or "",
            "bull": r["bull_case"] or "",
            "bear": r["bear_case"] or "",
            "sentiment": sent,
            "bullish": sent >= 0,
            "impact_type": (r["impact_type"] or "").replace("_", " "),
        })
    return out
