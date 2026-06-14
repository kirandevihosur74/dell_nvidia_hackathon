import AsyncStorage from "@react-native-async-storage/async-storage";

const TAILSCALE_STATE_KEY = "tailscale_state";

export type TailscaleStatus = "not_installed" | "logged_out" | "connecting" | "connected";

export interface TailscaleNode {
  hostname: string;
  ipv4: string;
  ipv6?: string;
  online: boolean;
  os?: string;
}

export interface TailscaleState {
  status: TailscaleStatus;
  selfHostname?: string;
  selfIp?: string;
  nodes: TailscaleNode[];
  loginUrl?: string;
}

/**
 * Tailscale integration service.
 *
 * In production, this would use the Tailscale iOS/Android SDK via a custom
 * Expo native module. For now, it provides the service interface and can
 * discover gateways on the Tailscale network via manual configuration or
 * the Tailscale local API (when available).
 *
 * Integration path:
 * 1. User installs Tailscale app on their phone
 * 2. Phone joins the same tailnet as the Gateway machine
 * 3. App discovers Gateway via Tailscale DNS (e.g., my-mac.tail12345.ts.net)
 * 4. Authentication is implicit (Tailscale identity)
 */
class TailscaleService {
  private state: TailscaleState = {
    status: "not_installed",
    nodes: [],
  };

  private statusHandlers = new Set<(state: TailscaleState) => void>();

  /** Subscribe to Tailscale state changes. */
  onStateChange(handler: (state: TailscaleState) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.state);
    return () => this.statusHandlers.delete(handler);
  }

  getState(): TailscaleState {
    return this.state;
  }

  /**
   * Check Tailscale connectivity.
   * Tries the Tailscale local API to get status.
   */
  async checkStatus(): Promise<TailscaleState> {
    try {
      // Try local Tailscale API (available when Tailscale is running)
      const response = await fetch("http://127.0.0.1:41112/localapi/v0/status", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        this.state = {
          status: "connected",
          selfHostname: data.Self?.HostName,
          selfIp: data.Self?.TailscaleIPs?.[0],
          nodes: this.parseNodes(data.Peer || {}),
        };
      } else {
        this.state = { status: "logged_out", nodes: [] };
      }
    } catch {
      // Tailscale local API not available
      this.state = { status: "not_installed", nodes: [] };
    }

    this.notifyHandlers();
    await this.persistState();
    return this.state;
  }

  /**
   * Discover OpenClaw Gateways on the Tailscale network.
   * Looks for nodes that might be running the Gateway (by checking port 18789).
   */
  async discoverGateways(): Promise<TailscaleNode[]> {
    if (this.state.status !== "connected") return [];

    const gateways: TailscaleNode[] = [];

    for (const node of this.state.nodes) {
      if (!node.online) continue;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`http://${node.ipv4}:18789`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok || response.status === 426) {
          // 426 = Upgrade Required (WebSocket endpoint responds to HTTP)
          gateways.push(node);
        }
      } catch {
        // Node not running gateway, skip
      }
    }

    return gateways;
  }

  /**
   * Get the Tailscale hostname for a given IP (for display in UI).
   */
  getHostnameForIp(ip: string): string | undefined {
    const node = this.state.nodes.find((n) => n.ipv4 === ip || n.ipv6 === ip);
    return node?.hostname;
  }

  /**
   * Get the Tailscale identity header value for authentication.
   * When connecting via Tailscale, the Gateway can verify the client's identity.
   */
  getTailscaleIdentity(): string | undefined {
    if (this.state.status !== "connected") return undefined;
    return this.state.selfHostname || this.state.selfIp;
  }

  // --- Internal ---

  private parseNodes(peers: Record<string, unknown>): TailscaleNode[] {
    return Object.values(peers).map((peer: unknown) => {
      const p = peer as Record<string, unknown>;
      return {
        hostname: (p.HostName as string) || "unknown",
        ipv4: ((p.TailscaleIPs as string[]) || [])[0] || "",
        ipv6: ((p.TailscaleIPs as string[]) || [])[1],
        online: (p.Online as boolean) || false,
        os: p.OS as string | undefined,
      };
    });
  }

  private notifyHandlers(): void {
    for (const handler of this.statusHandlers) {
      try {
        handler(this.state);
      } catch {
        // ignore
      }
    }
  }

  private async persistState(): Promise<void> {
    await AsyncStorage.setItem(TAILSCALE_STATE_KEY, JSON.stringify(this.state));
  }
}

export const tailscaleService = new TailscaleService();
