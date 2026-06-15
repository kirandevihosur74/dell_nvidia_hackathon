# OpenBell — Local-First AI Market Intelligence

**Dell × NVIDIA Hackathon project.**

> Institutional-grade market intelligence and an AI-agent assistant that run **on your own
> NVIDIA hardware** — live data and breaking news in, beautiful cited briefings, narrated
> explainer videos, and a real-time mobile assistant out. No cloud lock-in, no per-token bill,
> no data leaving the box.

OpenBell has two halves of one system:

1. **OpenBell** (`openbell/`) — a native iOS/Android assistant that talks to a **local OpenClaw
   Gateway** (NVIDIA **Nemotron** + PostgreSQL) for on-device-grade AI agents, live camera/screen
   multi-agent inference, meeting intelligence, and voice Q&A.
2. **The Bell briefings** (`tradingview/`) — an automated market-intelligence backend that turns
   live market data and a 24/7 news pipeline into **Opening Bell** (pre-market) and **Closing Bell**
   (post-close) research notes — delivered as email-safe HTML reports and narrated videos.

Same brand, same local-first philosophy: the **Bell** rings on-prem.

---

## Why local-first

Everything heavy is designed to run on a **Dell GB10 Max** (or any local GPU box), not a SaaS API:

- **Privacy & control** — market positions, meetings, and prompts never leave your hardware.
- **Zero marginal cost** — local Llama-3.3-70B / Nemotron / FinBERT / Higgs-Audio inference instead of per-token cloud billing.
- **Drop-in cloud fallback** — every AI call is **OpenAI-compatible**, so you can point at OpenAI today and your Dell GB10 Max tomorrow by changing two env vars.

---

## Architecture

```
                         ┌──────────────────────────────────────────────┐
   DATA / EVENTS         │             Dell GB10 Max (local)            │
 ┌───────────────┐       │  ┌────────────┐  ┌───────────────────────┐   │
 │ Yahoo Finance │──────▶│  │  Nemotron  │  │  Llama-3.3-70B (vLLM/  │   │
 │ GDELT · RSS   │       │  │  Gateway   │  │  Ollama) · FinBERT ·   │   │
 │ SEC EDGAR     │       │  │ (+Postgres)│  │  Higgs-Audio v3 (TTS)  │   │
 └───────────────┘       │  └─────┬──────┘  └───────────┬───────────┘   │
                         └────────┼─────────────────────┼───────────────┘
                                  │ WebSocket            │ OpenAI-compatible
                       ┌──────────▼─────────┐   ┌────────▼─────────────────┐
                       │   OpenBell (app)   │   │  Bell engine (Flask)     │
                       │  agents · vision · │   │  reports · analyze_assets│
                       │  meetings · voice  │   │  intel · video · Postgres│
                       └────────────────────┘   └──────────┬───────────────┘
                                                           │
                                       ┌───────────────────┼────────────────────┐
                                  email report        narrated MP4        /report routes
```

---

## Sub-project 1 — OpenBell mobile app (`openbell/`)

A native AI-agent client that connects to a **local OpenClaw Gateway** over WebSocket — "a
first-class OpenClaw channel" purpose-built to replace WhatsApp/Telegram for talking to your own
local agents.

- **OpenClaw chat** — multi-turn agent sessions, tool calls, per-gateway profiles, QR/Tailscale
  pairing, **AES-256-GCM end-to-end encryption**.
- **Live multi-agent inference** — stream camera/screen frames to the inference pipeline for
  real-time annotations and agent outputs, with token-budget tracking.
- **Meeting intelligence (Recall.ai)** — drop a bot into Zoom/Teams/Meet, capture frames +
  transcripts, and extract action items into a Kanban / task board.
- **Voice Q&A** — speech-to-text + streaming TTS overlay on inference streams.
- **Integrations** — Slack messenger sync, Asana/Nerve tasks; offline-resilient message queuing.

**Stack:** Expo 55 · React Native 0.83 · React 19 · expo-router · NativeWind (Tailwind) · Zustand ·
socket.io + native WebSocket · react-native-vision-camera · expo-audio/expo-speech · @noble/ed25519
+ expo-crypto. Pure client — the backend is the external **OpenClaw Gateway** (Nemotron + Postgres).

---

## Sub-project 2 — The Bell briefing engine (`tradingview/`)

A Flask + Jinja backend that builds **institutional-grade**, **email-safe**, **source-cited**
market briefings from live data, and renders them as both HTML and narrated video.

**Reports (server-rendered, inline-CSS HTML kept < Gmail's 102 KB clip limit):**
- **Opening Bell** — pre-market brief: rules-based **regime** read, **Question of the Day**, futures
  scoreboard, overnight/global markets, futures-**implied open**, **VIX term structure**, S&P
  technical levels (DMAs/pivots/RSI), pre-market movers, an **"On the Radar"** econ/earnings agenda,
  a **Market-Moving News** block, and numbered **sources**.
- **Closing Bell** — post-close wrap: index scoreboard, sector performance (diverging bars), movers,
  AI market tone, sources.
- **Equity Research Brief** — multi-ticker comparison with an AI verdict, per-ticker deep dives, and
  cited news.

**News intelligence (24/7 daemon on the Dell GB10 Max):**
`GDELT + RSS + SEC EDGAR` ingestion → **FinBERT** fast relevance/sentiment filter → **Llama-3.3-70B**
deep analysis (tickers, magnitude, bull/bear) → **SQLite**. The report renderer reads that table
**read-only** and injects the top stories — fully decoupled from the heavy pipeline.

**Narrated video:** **Manim** + **FFmpeg** turn the same data into an "After the Bell" explainer
(regime, Question of the Day, scoreboard, levels, movers, sources), voiced by **OpenAI-compatible
TTS** — `tts-1` or self-hosted **Higgs-Audio v3** on the Dell GB10 Max.

**Grounded asset analysis (API):** `/api/analyze_assets` answers free-form questions about a ticker
strictly from fetched data — declaring which **intents** it could and couldn't fulfil so the model
can't hallucinate beyond the evidence. It runs on **local Nemotron** via the OpenAI-compatible
router, **streams token-by-token over SSE** (`/api/analyze_assets/stream`), and every result is
persisted to **PostgreSQL** (`asset_analyses`).

**Delivery:** preview → download → **send via SMTP** (stdlib, no extra deps), plus a plain-text part
and a "view in browser" link so nothing is lost if a client clips the email.

**Stack:** Python 3.9+ · Flask 3 · Jinja2 · yfinance · pandas / pandas-ta · OpenAI SDK (gpt-4o,
`gpt-4o-mini-search-preview` web search, tts-1) routed through an **`llm_router`** that also speaks
to **Nemotron / Ollama / any OpenAI-compatible local endpoint** · Manim Community · FFmpeg ·
feedparser/httpx · transformers (FinBERT) · **PostgreSQL** (`pg_store`) · SQLite (news intel) ·
SSE streaming · smtplib.

---

## Technical stack at a glance

| Layer | What we use |
|---|---|
| **Local inference (Dell GB10 Max)** | NVIDIA Nemotron (gateway agents) · Llama-3.3-70B (vLLM/Ollama) · FinBERT · Higgs-Audio v3 (TTS) |
| **AI orchestration** | OpenAI-compatible APIs throughout · `llm_router` (cloud ↔ local swap via env) · grounded `/api/analyze_assets` on local **Nemotron**, SSE-streamed · gpt-4o + web-search model as fallback |
| **Backend / reports** | Python · Flask · Jinja2 · yfinance · pandas / pandas-ta · Manim + FFmpeg · **PostgreSQL** (psycopg2) · SQLite · SSE streaming · SMTP |
| **News pipeline** | GDELT · Yahoo/MarketWatch/BBC RSS · SEC EDGAR · feedparser · httpx |
| **Mobile** | Expo · React Native · expo-router · NativeWind · Zustand · socket.io · vision-camera · expo-audio/speech · ed25519/AES-256-GCM |
| **Mobile backend** | OpenClaw Gateway (WebSocket, Nemotron + PostgreSQL) · Stream.io inference relay · Recall.ai |

---

## Repository layout

```
openbell/      Expo/React Native app — OpenClaw client, inference, meetings, voice
tradingview/   Flask + Jinja "Bell" engine — reports, news intelligence, Manim video
  ├─ report_engine.py          report context: data, regime, trading map, narrative, SMTP
  ├─ pg_store.py               PostgreSQL store: users, subscriptions, asset analyses
  ├─ templates/                email-safe report templates (opening/closing/comparison)
  ├─ intel/ + intel_reader.py  news-intelligence SQLite contract + read-only reader
  ├─ video/                    Manim scene + make_video.py pipeline (OpenAI-compatible TTS)
  └─ gen_report.py             render a live report to HTML without Flask
```

---

## Quickstart

**Bell reports / video** — see [`tradingview/README.md`](./tradingview/README.md). In short:

```sh
cd tradingview
python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
cp .env.example .env        # add OPENAI_API_KEY + SMTP_* (and point TTS/LLM at the Dell GB10 Max)
python app.py               # then open /report, /opening-bell, /closing-bell
python gen_report.py opening   # or render a live report straight to HTML
```

**Mobile app** — `cd openbell && npm install && npx expo start` (pair to a running OpenClaw Gateway).

**Configuration** — all secrets come from a git-ignored `.env`; see
[`tradingview/.env.example`](./tradingview/.env.example) for the keys (OpenAI, Polygon,
`DATABASE_URL` for Postgres, SMTP, `REPORT_BASE_URL`, and the `TTS_BASE_URL`/`TTS_MODEL` overrides
for a self-hosted Dell GB10 Max voice). Every DB/AI dependency is lazy and guarded — the app still boots
if Postgres or a model endpoint is unreachable.

---

## Disclaimer

The Bell briefings are generated automatically for **informational purposes only** and are **not
investment advice**. Market data and AI-derived figures may be delayed, incomplete, or inaccurate.
