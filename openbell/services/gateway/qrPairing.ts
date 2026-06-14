import type { GatewayConfig, ConnectionMethod } from "@/types/gateway";
import type { ProviderType } from "./providers/types";
import { getProvider } from "./providers/registry";

// ─── QR Payload Types ──────────────────────────────────────────────

/** The decoded JSON payload from the Gateway's QR code. */
export interface QRPayload {
  url: string;           // e.g. "ws://10.243.184.142:18789"
  bootstrapToken: string;
}

export interface QRParseResult {
  success: true;
  payload: QRPayload;
}

export interface QRParseError {
  success: false;
  error: string;
}

export type QRResult = QRParseResult | QRParseError;

// ─── Decode & Parse ────────────────────────────────────────────────

/**
 * Decode a QR code scan result into a structured payload.
 *
 * The Gateway encodes the payload as base64 JSON:
 *   base64({ "url": "ws://...", "bootstrapToken": "..." })
 *
 * Also handles:
 *   - Raw JSON (if someone pastes decoded data)
 *   - Deep link URLs: asana-copilot://gateway?url=...&token=...
 */
export function decodeQRPayload(data: string): QRResult {
  const trimmed = data.trim();

  // Try deep link URL first
  if (trimmed.startsWith("asana-copilot://")) {
    return parseDeepLink(trimmed);
  }

  // Try raw JSON
  if (trimmed.startsWith("{")) {
    return parseJSON(trimmed);
  }

  // Try base64-encoded JSON (the primary Gateway format)
  return parseBase64(trimmed);
}

function parseBase64(data: string): QRResult {
  try {
    // Pad base64 if needed
    let padded = data;
    const remainder = padded.length % 4;
    if (remainder === 2) padded += "==";
    else if (remainder === 3) padded += "=";

    const decoded = atob(padded);
    return parseJSON(decoded);
  } catch {
    return { success: false, error: "Invalid QR code — not a valid Gateway pairing code" };
  }
}

function parseJSON(data: string): QRResult {
  try {
    const parsed = JSON.parse(data);
    return validatePayload(parsed);
  } catch {
    return { success: false, error: "Invalid QR code — could not parse Gateway data" };
  }
}

function parseDeepLink(url: string): QRResult {
  try {
    // asana-copilot://gateway?url=ws://...&token=...
    const queryStart = url.indexOf("?");
    if (queryStart === -1) {
      return { success: false, error: "Invalid deep link — no parameters" };
    }

    const params = new URLSearchParams(url.slice(queryStart + 1));
    const wsUrl = params.get("url");
    const token = params.get("token") || params.get("bootstrapToken");

    if (!wsUrl || !token) {
      return { success: false, error: "Invalid deep link — missing url or token" };
    }

    return validatePayload({ url: wsUrl, bootstrapToken: token });
  } catch {
    return { success: false, error: "Invalid deep link format" };
  }
}

// ─── Validation ────────────────────────────────────────────────────

function validatePayload(data: unknown): QRResult {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Invalid QR code — expected JSON object" };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.url !== "string" || !obj.url) {
    return { success: false, error: "Invalid QR code — missing Gateway URL" };
  }

  if (typeof obj.bootstrapToken !== "string" || !obj.bootstrapToken) {
    return { success: false, error: "Invalid QR code — missing bootstrap token" };
  }

  // Validate WebSocket URL format
  if (!obj.url.startsWith("ws://") && !obj.url.startsWith("wss://")) {
    return { success: false, error: "Invalid QR code — URL must be a WebSocket address" };
  }

  return {
    success: true,
    payload: {
      url: obj.url,
      bootstrapToken: obj.bootstrapToken,
    },
  };
}

// ─── Convert to GatewayConfig ──────────────────────────────────────

/**
 * Extract host and port from a WebSocket URL and build a GatewayConfig.
 *
 * Example: "ws://10.243.184.142:18789" → host="10.243.184.142", port=18789
 */
export function toGatewayConfig(
  payload: QRPayload,
  providerType: ProviderType = "openclaw",
): GatewayConfig {
  const { host, port } = parseWsUrl(payload.url);
  const provider = getProvider(providerType);

  return {
    id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Gateway (${host})`,
    host,
    port: port ?? provider.defaultPort,
    authMethod: "password", // bootstrapToken flows through the password/token auth path
    providerType,
    password: payload.bootstrapToken,
    isPaired: false,
    connectionMethod: "qr" as ConnectionMethod,
    bootstrapToken: payload.bootstrapToken,
    wsUrl: payload.url,
  };
}

function parseWsUrl(url: string): { host: string; port: number | null } {
  try {
    // ws://10.243.184.142:18789 → need to extract host and port
    // URL constructor doesn't handle ws:// well in all environments,
    // so we parse manually
    const withoutProtocol = url.replace(/^wss?:\/\//, "");
    const [hostPort] = withoutProtocol.split("/");
    const lastColon = hostPort.lastIndexOf(":");

    if (lastColon === -1) {
      return { host: hostPort, port: null };
    }

    const host = hostPort.slice(0, lastColon);
    const portStr = hostPort.slice(lastColon + 1);
    const port = parseInt(portStr, 10);

    return { host, port: isNaN(port) ? null : port };
  } catch {
    return { host: url, port: null };
  }
}
