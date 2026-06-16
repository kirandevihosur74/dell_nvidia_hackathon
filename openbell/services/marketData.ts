/**
 * Lightweight client for the tradingview-yahoo-finance Flask backend.
 * Only wraps the endpoints that return structured JSON we can render:
 *   - GET /api/market_data/<symbol>  → live price / change / volume
 *   - GET /api/symbols               → configured watchlist universe
 *
 * This is a SEPARATE service from the main app backend (apiClient), so it has
 * its own base URL. The trading Flask app listens on port 5001; by default we
 * reuse the main backend's host and swap the port, falling back to localhost
 * (which the iOS simulator routes to the host Mac). Override explicitly with
 * EXPO_PUBLIC_TRADING_API_URL.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const TRADING_PORT = "5001";

// Persisted overrides driven by the Settings "Inference Backend" toggle:
//   trading_api_base_url  -> which backend (GB10 vs locally-deployed)
//   trading_llm_provider  -> which model that backend should use (local Nemotron
//                            on the GB10, or the OpenRouter-hosted mirror)
const BASE_KEY = "trading_api_base_url";
const PROVIDER_KEY = "trading_llm_provider";

export type TradingProvider = "local" | "openrouter" | "openai";

let _baseOverride: string | null = null;
let _provider: TradingProvider | null = null;
let _initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!_initPromise) {
    _initPromise = Promise.all([
      AsyncStorage.getItem(BASE_KEY),
      AsyncStorage.getItem(PROVIDER_KEY),
    ])
      .then(([base, prov]) => {
        if (base) _baseOverride = base;
        if (prov) _provider = prov as TradingProvider;
      })
      .catch(() => {});
  }
  return _initPromise;
}
ensureInit();

function resolveTradingBase(): string {
  const explicit = process.env.EXPO_PUBLIC_TRADING_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const main = process.env.EXPO_PUBLIC_API_URL;
  if (main) {
    // reuse the main backend host, swap to the trading port
    try {
      const m = main.match(/^(https?:\/\/[^/:]+)(?::\d+)?/i);
      if (m) return `${m[1]}:${TRADING_PORT}`;
    } catch {
      /* fall through */
    }
  }
  return `http://localhost:${TRADING_PORT}`;
}

async function getApiBaseUrl(): Promise<string> {
  await ensureInit();
  return _baseOverride || resolveTradingBase();
}

export async function setTradingBaseUrl(url: string): Promise<void> {
  _baseOverride = url.replace(/\/+$/, "");
  await AsyncStorage.setItem(BASE_KEY, _baseOverride);
}

export async function getTradingBaseUrl(): Promise<string> {
  return getApiBaseUrl();
}

export async function setTradingProvider(provider: TradingProvider): Promise<void> {
  _provider = provider;
  await AsyncStorage.setItem(PROVIDER_KEY, provider);
}

export async function getTradingProvider(): Promise<TradingProvider | null> {
  await ensureInit();
  return _provider;
}

// Header the Flask backend reads (see app.py @before_request) to choose the
// inference backend per request.
async function providerHeaders(): Promise<Record<string, string>> {
  await ensureInit();
  return _provider ? { "X-LLM-Provider": _provider } : {};
}

export interface MarketData {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  marketCap: number;
}

export async function fetchMarketData(symbol: string): Promise<MarketData> {
  const base = await getApiBaseUrl();
  const sym = symbol.trim().toUpperCase();
  const res = await fetch(`${base}/api/market_data/${encodeURIComponent(sym)}`, {
    headers: await providerHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Market data unavailable for ${sym}`);
  }
  return data as MarketData;
}

export async function fetchSymbols(): Promise<string[]> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/symbols`, { headers: await providerHeaders() });
  if (!res.ok) throw new Error(`Symbols unavailable (${res.status})`);
  const list = (await res.json()) as string[];
  // backend file includes section headers like "*STOCKS*" — keep tickers only
  return list.filter((s) => s && !s.startsWith("*"));
}

export interface AssetAnalysis {
  symbol: string;
  answer?: string;
  error?: string;
  intents_fulfilled?: string[];
  intents_unavailable?: string[];
}

/**
 * Run a chosen subset of symbols through the backend's grounded analysis
 * (/api/analyze_assets), which calls the selected inference backend — local
 * Nemotron on the GB10, or the OpenRouter mirror — per the active toggle.
 */
export async function analyzeAssets(
  symbols: string[],
  question: string
): Promise<{ results: AssetAnalysis[]; model: string }> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/analyze_assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await providerHeaders()) },
    body: JSON.stringify({ symbols, question }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Analysis failed (${res.status})`);
  }
  return data as { results: AssetAnalysis[]; model: string };
}

export function formatPrice(p: number): string {
  return `$${p.toFixed(2)}`;
}

export function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}
