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

const TRADING_PORT = "5001";

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

const TRADING_BASE = resolveTradingBase();

async function getApiBaseUrl(): Promise<string> {
  return TRADING_BASE;
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
  const res = await fetch(`${base}/api/market_data/${encodeURIComponent(sym)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error || `Market data unavailable for ${sym}`);
  }
  return data as MarketData;
}

export async function fetchSymbols(): Promise<string[]> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/symbols`);
  if (!res.ok) throw new Error(`Symbols unavailable (${res.status})`);
  const list = (await res.json()) as string[];
  // backend file includes section headers like "*STOCKS*" — keep tickers only
  return list.filter((s) => s && !s.startsWith("*"));
}

export function formatPrice(p: number): string {
  return `$${p.toFixed(2)}`;
}

export function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}
