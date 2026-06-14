import type { GatewayMessage, GatewayAgent, GatewayConfig } from "@/types/gateway";

export type ProviderType = "openclaw" | "nanoclaw" | "nullclaw" | "zeroclaw" | "openfeng" | "nemoclaw";

export interface ConnectContext {
  instanceId: string;
  connectNonce: string | null;
  storedToken: string | null;
  password: string | undefined;
}

export interface GatewayProvider {
  readonly type: ProviderType;
  readonly displayName: string;
  readonly defaultPort: number;
  readonly storageKey: string;
  readonly deviceName: string;

  /** Build parameters for the "connect" request. */
  buildConnectParams(config: GatewayConfig, ctx: ConnectContext): Promise<Record<string, unknown>>;

  /** Handle a successful connect result (e.g. store device token). */
  handleConnectResult(result: Record<string, unknown> | undefined, config: GatewayConfig): Promise<void>;

  /** Map a gateway event to an internal GatewayMessage, or null to skip. */
  mapEvent(event: string, payload?: Record<string, unknown>): GatewayMessage | null;

  /** Build a chat.send request. Optional imageData is a base64 frame from a live stream. Profile info lets the agent identify who is talking. */
  buildChatSend(sessionKey: string, text: string, idempotencyKey: string, imageData?: string, profile?: { id: string; displayName: string }): { method: string; params: Record<string, unknown> };

  /** Build a chat.history request. */
  buildChatHistory(sessionKey: string): { method: string; params: Record<string, unknown> };

  /** Extract text from a message object. */
  extractText(message: unknown): string;

  /** Return ordered list of methods to try for agent discovery. */
  agentDiscoveryMethods(): string[];

  /** Parse agent list from discovery result. */
  parseAgents(result: Record<string, unknown>): GatewayAgent[];

  /** Build a pairing response request. */
  buildPairingResponse(code: string): { method: string; params: Record<string, unknown> };
}
