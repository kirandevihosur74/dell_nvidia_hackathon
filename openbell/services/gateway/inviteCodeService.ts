import { StreamIOAPIConfig } from "@/constants/streamio/config";
import type { GatewayConfig, ConnectionMethod } from "@/types/gateway";
import { getProvider } from "./providers/registry";
import type { ProviderType } from "./providers/types";

const API_BASE = StreamIOAPIConfig.baseURL;

// ─── Types ─────────────────────────────────────────────────────────

export interface InviteResolveResult {
  gatewayName: string;
  url: string;
}

export interface InviteCodeError {
  code: "expired" | "rate_limited" | "network" | "unknown";
  message: string;
}

// ─── Code Normalization ────────────────────────────────────────────

/**
 * Normalize user input to the CLAW-XXXX format.
 * Handles: "claw-7x9k", "CLAW7X9K", "7X9K", " claw-7x9k ", etc.
 */
export function normalizeCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s/g, "");

  // Already in CLAW-XXXX format
  if (/^CLAW-[A-Z0-9]{4}$/.test(cleaned)) {
    return cleaned;
  }

  // Missing dash: CLAWXXXX → CLAW-XXXX
  if (/^CLAW[A-Z0-9]{4}$/.test(cleaned)) {
    return `CLAW-${cleaned.slice(4)}`;
  }

  // Just the 4-char code: XXXX → CLAW-XXXX
  if (/^[A-Z0-9]{4}$/.test(cleaned)) {
    return `CLAW-${cleaned}`;
  }

  // Return as-is (will fail validation on the server)
  return cleaned;
}

// ─── API Client ────────────────────────────────────────────────────

/**
 * Resolve an invite code to gateway connection details.
 * The invite code is purely a discovery mechanism — no auth credentials
 * are transmitted. Authentication uses the device's Ed25519 public key.
 */
export async function resolveInviteCode(
  rawCode: string,
): Promise<{ success: true; result: InviteResolveResult } | { success: false; error: InviteCodeError }> {
  const code = normalizeCode(rawCode);

  try {
    const response = await fetch(`${API_BASE}/api/v1/invite/${encodeURIComponent(code)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 404) {
      return {
        success: false,
        error: { code: "expired", message: "Code expired or invalid. Ask for a new one." },
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        error: { code: "rate_limited", message: "Too many attempts. Try again in a few minutes." },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: { code: "unknown", message: "Something went wrong. Try again." },
      };
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      return {
        success: false,
        error: { code: "unknown", message: "Invalid response from server." },
      };
    }

    return {
      success: true,
      result: {
        gatewayName: data.gatewayName,
        url: data.url,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: { code: "network", message: "Network error. Check your connection." },
    };
  }
}

// ─── Convert to GatewayConfig ──────────────────────────────────────

/**
 * Convert a resolved invite code result into a GatewayConfig.
 * No bootstrapToken — auth uses the device's Ed25519 public key.
 */
export function inviteResultToGatewayConfig(
  result: InviteResolveResult,
  providerType: ProviderType = "openclaw",
): GatewayConfig {
  const { host, port } = parseWsUrl(result.url);
  const provider = getProvider(providerType);

  return {
    id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: result.gatewayName || `Gateway (${host})`,
    host,
    port: port ?? provider.defaultPort,
    authMethod: "pairing", // Device public key pairing (no pre-shared token)
    providerType,
    isPaired: false,
    connectionMethod: "invite" as ConnectionMethod,
    wsUrl: result.url,
  };
}

function parseWsUrl(url: string): { host: string; port: number | null } {
  try {
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
