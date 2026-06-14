import { StreamIOAPIConfig } from "@/constants/streamio/config";
import { useStreamIOAuthStore } from "@/stores/streamio/authStore";
import type { GatewayConfig, ConnectionMethod } from "@/types/gateway";
import { getProvider } from "./providers/registry";
import type { ProviderType } from "./providers/types";

const API_BASE = StreamIOAPIConfig.baseURL;

// ─── Types ─────────────────────────────────────────────────────────

export interface RelayGateway {
  gatewayId: string;
  name: string;
  host: string;
  port: number;
  provider: string;
  status: "online" | "offline";
  lastHeartbeat: string;
  metadata: Record<string, string>;
}

// ─── Auth Helper ───────────────────────────────────────────────────

function getAuthToken(): string | null {
  return useStreamIOAuthStore.getState().currentAuth?.authToken || null;
}

function isAuthenticated(): boolean {
  const auth = useStreamIOAuthStore.getState().currentAuth;
  return !!auth?.isAuthenticated && !!auth?.authToken;
}

// ─── API Client ────────────────────────────────────────────────────

/**
 * Fetch the user's registered gateways from api.streamio.ai.
 * Requires Kinde JWT authentication.
 */
export async function fetchMyGateways(): Promise<
  { success: true; gateways: RelayGateway[] } | { success: false; error: string }
> {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: "Not signed in" };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/gateways/mine`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    if (!response.ok) {
      return { success: false, error: "Failed to fetch gateways" };
    }

    const data = await response.json();
    return { success: true, gateways: data.gateways || [] };
  } catch {
    return { success: false, error: "Network error. Check your connection." };
  }
}

/**
 * Remove a gateway from the user's account.
 */
export async function removeGateway(gatewayId: string): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/gateways/${encodeURIComponent(gatewayId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.status === 204;
  } catch {
    return false;
  }
}

// ─── Relay WebSocket URL ───────────────────────────────────────────

/**
 * Build the WebSocket URL for the gateway relay namespace.
 */
export function getRelayWsUrl(): string {
  return StreamIOAPIConfig.wsURL + "/gateway-relay";
}

/**
 * Build the auth handshake payload for connecting to the relay.
 */
export function getRelayAuthPayload(gatewayId: string, role: "mobile" | "gateway" = "mobile") {
  const token = getAuthToken();
  return {
    token,
    role,
    gatewayId,
  };
}

// ─── Convert to GatewayConfig ──────────────────────────────────────

export function relayGatewayToConfig(
  relay: RelayGateway,
  providerType: ProviderType = "openclaw",
): GatewayConfig {
  const provider = getProvider(providerType);

  return {
    id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: relay.name,
    host: relay.host,
    port: relay.port || provider.defaultPort,
    authMethod: "pairing",
    providerType: (relay.provider as ProviderType) || providerType,
    isPaired: false,
    connectionMethod: "relay" as ConnectionMethod,
    wsUrl: `ws://${relay.host}:${relay.port}`,
  };
}

// ─── Exports for UI ────────────────────────────────────────────────

export { isAuthenticated };
