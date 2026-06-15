# intel_reader.py
"""
Renderer-side reader for the local news-intelligence pipeline.

The heavy ingestion/classification daemon (GDELT + RSS + SEC EDGAR -> FinBERT
-> local Llama-3.3-70B on the Dell GB10 Max) writes market-moving stories into a
`stories` table. This module is the *only* thing the report renderer imports
from that pipeline.

Storage now lives in **Postgres** (the same DB the rest of the app uses, via
pg_store) instead of a separate SQLite file — one database, no confusion. The
column contract is unchanged (see pg_store.py).

Everything degrades gracefully: if Postgres is unreachable or the table is
empty, get_top_stories() returns [] and the report falls back to its existing
web-search radar.
"""
import pg_store


def intel_available():
    """True if the stories table is reachable in Postgres."""
    return pg_store.stories_available()


def get_top_stories(limit=6, hours=12):
    """Top tradeable, processed stories from the last `hours`, ranked by
    magnitude then |sentiment|. Returns [] on any problem (graceful)."""
    return pg_store.get_top_stories(limit=limit, hours=hours)
