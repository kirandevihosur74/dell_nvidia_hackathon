import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GatewayConfig, GatewayMessage, PairingChallenge } from "@/types/gateway";
import { gatewayClient } from "./gatewayClient";
import { getProvider } from "./providers/registry";
import type { ProviderType } from "./providers/types";

const GATEWAYS_STORAGE_KEY = "openclaw_gateways";
const GATEWAYS_KEYCHAIN_KEY = "openclaw_gateways_backup";

type PairingHandler = (challenge: PairingChallenge) => void;

class PairingService {
  private handlers = new Set<PairingHandler>();
  private unsubMessage: (() => void) | null = null;

  /** Start listening for pairing challenges. */
  start(): void {
    this.stop();
    this.unsubMessage = gatewayClient.onMessage(this.handleMessage);
  }

  stop(): void {
    this.unsubMessage?.();
    this.unsubMessage = null;
  }

  /** Subscribe to pairing challenge events. */
  onChallenge(handler: PairingHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Submit a pairing code entered by the user. */
  submitPairingCode(code: string): void {
    const config = gatewayClient.getConfig();
    const provider = getProvider(config?.providerType || "openclaw");
    const req = provider.buildPairingResponse(code);
    gatewayClient.request(req.method, req.params).catch(() => {
      // Pairing failure will be surfaced via events
    });
  }

  // --- Gateway Config Persistence ---

  /** Load all saved gateway configs. Tries AsyncStorage first, then Keychain (survives reinstall). */
  async loadGateways(): Promise<GatewayConfig[]> {
    try {
      let json = await AsyncStorage.getItem(GATEWAYS_STORAGE_KEY);

      // If AsyncStorage is empty (e.g. after reinstall), restore from Keychain
      if (!json) {
        json = await SecureStore.getItemAsync(GATEWAYS_KEYCHAIN_KEY);
        if (json) {
          // Re-populate AsyncStorage from Keychain backup
          await AsyncStorage.setItem(GATEWAYS_STORAGE_KEY, json);
        }
      }

      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  /** Persist gateways to both AsyncStorage and Keychain. */
  private async persistGateways(gateways: GatewayConfig[]): Promise<void> {
    const json = JSON.stringify(gateways);
    await AsyncStorage.setItem(GATEWAYS_STORAGE_KEY, json);
    await SecureStore.setItemAsync(GATEWAYS_KEYCHAIN_KEY, json).catch(() => {});
  }

  /** Save a gateway config. Updates if exists, appends if new. */
  async saveGateway(config: GatewayConfig): Promise<void> {
    const gateways = await this.loadGateways();
    const index = gateways.findIndex((g) => g.id === config.id);
    if (index >= 0) {
      gateways[index] = config;
    } else {
      gateways.push(config);
    }
    await this.persistGateways(gateways);
  }

  /** Remove a gateway config and its stored credentials. */
  async removeGateway(id: string): Promise<void> {
    const gateways = await this.loadGateways();
    const filtered = gateways.filter((g) => g.id !== id);
    await this.persistGateways(filtered);
    await SecureStore.deleteItemAsync(`gateway_token_${id}`).catch(() => {});
  }

  /** Mark a gateway as paired after successful authentication. */
  async markPaired(gatewayId: string): Promise<void> {
    const gateways = await this.loadGateways();
    const gateway = gateways.find((g) => g.id === gatewayId);
    if (gateway) {
      gateway.isPaired = true;
      gateway.lastConnected = new Date().toISOString();
      await this.persistGateways(gateways);
    }
  }

  /** Generate a new gateway config with a unique ID. */
  createGatewayConfig(
    name: string,
    host: string,
    port?: number,
    authMethod: GatewayConfig["authMethod"] = "pairing",
    providerType?: ProviderType,
  ): GatewayConfig {
    const provider = getProvider(providerType || "openclaw");
    return {
      id: `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      host,
      port: port ?? provider.defaultPort,
      authMethod,
      providerType: providerType || undefined,
      isPaired: false,
    };
  }

  // --- Internal ---

  private handleMessage = (msg: GatewayMessage): void => {
    if (msg.type === "auth_challenge") {
      const payload = msg.payload as { code?: string; expiresAt?: string; direction?: string } | undefined;
      if (payload?.code) {
        const challenge: PairingChallenge = {
          code: payload.code,
          expiresAt: payload.expiresAt || "",
          direction: (payload.direction as "display" | "enter") || "enter",
        };
        for (const handler of this.handlers) {
          try {
            handler(challenge);
          } catch {
            // ignore
          }
        }
      }
    }

    if (msg.type === "auth_result") {
      const payload = msg.payload as { success?: boolean } | undefined;
      if (payload?.success) {
        const config = gatewayClient.getConfig();
        if (config) {
          this.markPaired(config.id);
        }
      }
    }
  };
}

export const pairingService = new PairingService();
