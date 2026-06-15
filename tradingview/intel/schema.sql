-- intel/schema.sql  (PostgreSQL)
-- The contract between the news-intelligence daemon (writer, on the Dell GB10 Max)
-- and the report renderer (read-only). Keep these column names stable; the
-- renderer (pg_store.get_top_stories / intel_reader) selects exactly these.
--
-- Storage is now PostgreSQL (the same DB the app uses) instead of a separate
-- SQLite file — one database, no confusion. The app auto-creates this table via
-- pg_store._ensure_schema(); this file documents the contract for the daemon.
--
-- Writer setup (in the daemon): connect with the app's DATABASE_URL, e.g.
--   postgresql:///tradingview     (local peer auth)
-- and INSERT/UPSERT rows with these columns. tradeable_today/processed are 1/0.

CREATE TABLE IF NOT EXISTS stories (
    id              TEXT PRIMARY KEY,      -- md5(title) or md5(name+filing_id)
    title           TEXT,
    body            TEXT,
    source          TEXT,                  -- reuters_business | gdelt | sec_edgar | ...
    published_at    TEXT,
    sentiment       DOUBLE PRECISION,      -- signed: + bullish, - bearish (FinBERT)
    relevance       DOUBLE PRECISION,      -- 0..1 financial-relevance prefilter
    magnitude       TEXT,                  -- 'high' | 'medium' | 'low'
    tickers         TEXT,                  -- JSON array, e.g. '["NVDA","AMD"]'
    sector_impact   TEXT,                  -- 'Semiconductors: negative'
    one_liner       TEXT,                  -- tradeable headline (drives the report row)
    bull_case       TEXT,                  -- one sentence
    bear_case       TEXT,                  -- one sentence
    impact_type     TEXT,                  -- geopolitical|regulatory|earnings|macro|...
    tradeable_today INTEGER DEFAULT 0,     -- 1 if it moves the tape pre-market today
    processed       INTEGER DEFAULT 0,     -- 1 after Stage 2 analysis
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- The renderer query filters on these, so index them:
CREATE INDEX IF NOT EXISTS idx_stories_feed
    ON stories (tradeable_today, processed, created_at);
