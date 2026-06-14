import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import type { GatewayConfig, ConnectionMethod } from "@/types/gateway";
import { getProvider } from "./providers/registry";
import type { ProviderType } from "./providers/types";

// ─── Types ─────────────────────────────────────────────────────────

export interface DiscoveredGateway {
  id: string;
  name: string;
  host: string;
  port: number;
  metadata: Record<string, string>;
}

type DiscoveryListener = (gateways: DiscoveredGateway[]) => void;

// ─── Native Module Bridge ──────────────────────────────────────────

const NativeDiscovery = NativeModules.GatewayDiscoveryModule;
const isAvailable = Platform.OS === "ios" && NativeDiscovery != null;

let emitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter | null {
  if (!isAvailable) return null;
  if (!emitter) {
    emitter = new NativeEventEmitter(NativeDiscovery);
  }
  return emitter;
}

// ─── Discovery Service ─────────────────────────────────────────────

class GatewayDiscoveryService {
  private gateways = new Map<string, DiscoveredGateway>();
  private listeners = new Set<DiscoveryListener>();
  private subscriptions: Array<{ remove: () => void }> = [];
  private isRunning = false;
  private cacheTimestamp = 0;

  /** Start browsing for OpenClaw Gateways via Bonjour. */
  start(): void {
    if (!isAvailable || this.isRunning) return;

    const eventEmitter = getEmitter();
    if (!eventEmitter) return;

    this.subscriptions.push(
      eventEmitter.addListener("onGatewayFound", (gateway: DiscoveredGateway) => {
        this.gateways.set(gateway.id, gateway);
        this.cacheTimestamp = Date.now();
        this.notifyListeners();
      }),
    );

    this.subscriptions.push(
      eventEmitter.addListener("onGatewayLost", ({ id }: { id: string }) => {
        this.gateways.delete(id);
        this.cacheTimestamp = Date.now();
        this.notifyListeners();
      }),
    );

    this.subscriptions.push(
      eventEmitter.addListener("onDiscoveryError", ({ error }: { error: string }) => {
        console.warn("[GatewayDiscovery] Error:", error);
      }),
    );

    NativeDiscovery.startDiscovery();
    this.isRunning = true;
  }

  /** Stop browsing. */
  stop(): void {
    if (!isAvailable || !this.isRunning) return;

    NativeDiscovery.stopDiscovery();
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
    this.isRunning = false;
  }

  /** Get all currently discovered gateways. */
  getGateways(): DiscoveredGateway[] {
    return Array.from(this.gateways.values());
  }

  /** Force refresh by restarting the browser. */
  refresh(): void {
    this.gateways.clear();
    this.stop();
    this.start();
  }

  /** Subscribe to gateway discovery changes. Returns unsubscribe function. */
  onUpdate(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getGateways());
    return () => this.listeners.delete(listener);
  }

  /** Whether Bonjour discovery is available on this platform. */
  get available(): boolean {
    return isAvailable;
  }

  private notifyListeners(): void {
    const gateways = this.getGateways();
    for (const listener of this.listeners) {
      try {
        listener(gateways);
      } catch {
        // ignore
      }
    }
  }
}

export const gatewayDiscovery = new GatewayDiscoveryService();

// ─── Convert to GatewayConfig ──────────────────────────────────────

export function discoveredToGatewayConfig(
  discovered: DiscoveredGateway,
  providerType: ProviderType = "openclaw",
): GatewayConfig {
  const provider = getProvider(providerType);

  return {
    id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: discovered.name || `Gateway (${discovered.host})`,
    host: discovered.host,
    port: discovered.port || provider.defaultPort,
    authMethod: "pairing", // Device public key pairing
    providerType,
    isPaired: false,
    connectionMethod: "discovery" as ConnectionMethod,
    discoveredAt: new Date().toISOString(),
  };
}
