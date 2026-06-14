-- intel/schema.sql
-- The contract between the news-intelligence daemon (writer, on the DGX Spark)
-- and the report renderer (read-only). Keep these columns stable; the renderer
-- (intel_reader.get_top_stories) selects exactly these names.
--
-- Writer setup (in the daemon):
--   PRAGMA journal_mode=WAL;   -- so the renderer can read while we write
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS stories (
    id              TEXT PRIMARY KEY,      -- md5(title) or md5(name+filing_id)
    title           TEXT,
    body            TEXT,
    source          TEXT,                  -- reuters_business | gdelt | sec_edgar | ...
    published_at    TEXT,
    sentiment       REAL,                  -- signed: + bullish, - bearish (FinBERT)
    relevance       REAL,                  -- 0..1 financial-relevance prefilter
    magnitude       TEXT,                  -- 'high' | 'medium' | 'low'  (>2% / 0.5-2% / <0.5%)
    tickers         TEXT,                  -- JSON array, e.g. '["NVDA","AMD"]'
    sector_impact   TEXT,                  -- 'Semiconductors: negative'
    one_liner       TEXT,                  -- tradeable headline (drives the report row)
    bull_case       TEXT,                  -- one sentence
    bear_case       TEXT,                  -- one sentence
    impact_type     TEXT,                  -- geopolitical|regulatory|earnings|macro|...
    tradeable_today INTEGER DEFAULT 0,     -- 1 if it moves the tape pre-market today
    processed       INTEGER DEFAULT 0,     -- 1 after Stage 2 analysis
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- The renderer query filters on these, so index them:
CREATE INDEX IF NOT EXISTS idx_stories_feed
    ON stories (tradeable_today, processed, created_at);
