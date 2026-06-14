#!/usr/bin/env python3
"""
Create a mock opening_bell.db so the report renderer's News Intelligence
section can be tested WITHOUT running the FinBERT/Llama daemon.

    python intel/seed_mock.py            # writes tradingview/opening_bell.db
    INTEL_DB=/tmp/x.db python intel/seed_mock.py

The real daemon (ingestion -> FinBERT -> Llama-3.3-70B) writes the same
schema; this just hand-seeds a few rows shaped exactly like its output.
"""
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.getenv("INTEL_DB", os.path.join(HERE, "..", "opening_bell.db"))

MOCK = [
    ("nvda-china", "U.S. tightens H20 export controls to China",
     "sec_edgar", -0.78, "high", ["NVDA", "AMD", "AVGO"], "Semiconductors: negative",
     "NVDA -2-3% likely: fresh China export curbs hit H20 data-center chips",
     "Demand simply reroutes to compliant parts and domestic buildout accelerates.",
     "China is ~20% of data-center revenue; curbs compress the AI growth premium.",
     "regulatory", 0.93),
    ("fed-minutes", "FOMC minutes flag patience on cuts amid sticky services CPI",
     "fed_reserve", -0.41, "high", ["XLF", "XLU", "XLRE"], "Rate-sensitive: negative",
     "Rate-sensitive sectors pressured: minutes push back on near-term cuts",
     "A single soft CPI print reopens the September-cut debate.",
     "Higher-for-longer compresses duration-sensitive multiples.",
     "fed", 0.88),
    ("mideast-oil", "Tanker incident in the Strait of Hormuz lifts crude",
     "gdelt", 0.62, "medium", ["XOM", "CVX", "DAL", "UAL"], "Energy: positive, Airlines: negative",
     "Energy bid, airlines offered as Brent jumps ~3% on supply-risk premium",
     "De-escalation unwinds the premium within days.",
     "Sustained disruption re-rates energy and pressures transport margins.",
     "geopolitical", 0.71),
    ("orcl-earnings", "Oracle beats on cloud, raises FY guidance after the close",
     "marketwatch", 0.69, "medium", ["ORCL"], "Software: positive",
     "ORCL +4% pre-market: OCI backlog and guidance top whisper",
     "RPO acceleration signals durable AI-infra demand.",
     "Capex intensity weighs on near-term free cash flow.",
     "earnings", 0.66),
    ("retail-sales", "Weekly jobless claims tick higher ahead of the open",
     "yahoo_finance", -0.18, "low", [], "Macro: mixed",
     "Labor data soft at the margin; modest bull-steepening in rates",
     "Cooling labor supports the disinflation/cut narrative.",
     "Too-fast cooling revives growth-scare concerns.",
     "macro", 0.55),
]


def main():
    dest = os.path.abspath(DEST)
    con = sqlite3.connect(dest)
    con.execute("PRAGMA journal_mode=WAL")
    with open(os.path.join(HERE, "schema.sql")) as f:
        con.executescript(f.read())
    con.execute("DELETE FROM stories")
    for (sid, title, source, sentiment, magnitude, tickers, sector,
         one_liner, bull, bear, itype, relevance) in MOCK:
        con.execute(
            """INSERT INTO stories
               (id,title,body,source,published_at,sentiment,relevance,magnitude,
                tickers,sector_impact,one_liner,bull_case,bear_case,impact_type,
                tradeable_today,processed,created_at)
               VALUES (?,?,?,?,datetime('now'),?,?,?,?,?,?,?,?,?,1,1,datetime('now','-2 hours'))""",
            (sid, title, "", source, sentiment, relevance, magnitude,
             json.dumps(tickers), sector, one_liner, bull, bear, itype),
        )
    con.commit()
    n = con.execute("SELECT COUNT(*) FROM stories").fetchone()[0]
    con.close()
    print(f"seeded {n} stories -> {dest}")


if __name__ == "__main__":
    main()
