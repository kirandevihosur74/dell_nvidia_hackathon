import type { GatewayConfig, GatewayMessage, GatewayAgent } from "@/types/gateway";
import type { GatewayProvider, ConnectContext } from "./types";

/** Stub provider for OpenFeng gateways. */
export const openFengProvider: GatewayProvider = {
  type: "openfeng",
  displayName: "OpenFeng",
  defaultPort: 19300,
  storageKey: "openfeng_gateways",
  deviceName: "OpenFeng.mobile",

  async buildConnectParams(_config: GatewayConfig, ctx: ConnectContext): Promise<Record<string, unknown>> {
    const token = ctx.storedToken || ctx.password || undefined;
    return {
      protocol: 1,
      client: { id: "openfeng-mobile", instanceId: ctx.instanceId },
      auth: token ? { token } : undefined,
    };
  },

  async handleConnectResult(): Promise<void> {},

  mapEvent(event: string, payload?: Record<string, unknown>): GatewayMessage | null {
    switch (event) {
      case "chat": {
        const state = payload?.state as string;
        if (state === "delta") return { type: "chat_token", payload };
        if (state === "final") return { type: "chat_done", payload };
        if (state === "error") return { type: "chat_error", payload };
        return null;
      }
      default:
        return null;
    }
  },

  buildChatSend(sessionKey: string, text: string, idempotencyKey: string, imageData?: string) {
    const params: Record<string, unknown> = { sessionKey, idempotencyKey };
    if (imageData) {
      params.message = [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageData } },
        { type: "text", text },
      ];
    } else {
      params.message = text;
    }
    return { method: "chat.send", params };
  },

  buildChatHistory(sessionKey: string) {
    return { method: "chat.history", params: { sessionKey } };
  },

  extractText(message: unknown): string {
    if (!message || typeof message !== "object") return "";
    const msg = message as Record<string, unknown>;
    if (typeof msg.content === "string") return msg.content;
    if (typeof msg.text === "string") return msg.text;
    return "";
  },

  agentDiscoveryMethods() {
    return ["agents.list"];
  },

  parseAgents(result: Record<string, unknown>): GatewayAgent[] {
    const agents = result?.agents as Record<string, unknown>[] | undefined;
    if (!Array.isArray(agents)) return [];
    return agents.map((a) => ({
      id: (a.id as string) || "",
      name: (a.name as string) || "Agent",
      description: (a.description as string) || "",
      icon: (a.icon as string) || "bot",
    }));
  },

  buildPairingResponse(code: string) {
    return { method: "device.pair", params: { code } };
  },
};
