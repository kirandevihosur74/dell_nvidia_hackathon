import * as SecureStore from "expo-secure-store";
import type { GatewayConfig, GatewayMessage, GatewayAgent } from "@/types/gateway";
import { getDeviceIdentity, buildSignatureMessage, signMessage } from "../deviceIdentity";
import type { GatewayProvider, ConnectContext } from "./types";

export const openClawProvider: GatewayProvider = {
  type: "openclaw",
  displayName: "OpenClaw",
  defaultPort: 18789,
  storageKey: "openclaw_gateways",
  deviceName: "ClawMobile.app",

  async buildConnectParams(config: GatewayConfig, ctx: ConnectContext): Promise<Record<string, unknown>> {
    const token = ctx.storedToken || ctx.password || undefined;
    let auth: Record<string, unknown> | undefined;
    if (token) {
      auth = { token, password: token };
    }

    const clientId = "openclaw-control-ui";
    const clientMode = "webchat";
    const role = "operator";
    const scopes = ["operator.read", "operator.admin", "operator.approvals", "operator.pairing"];

    // Build device identity with Ed25519 signature
    let device: Record<string, unknown> | undefined;
    try {
      const identity = await getDeviceIdentity();
      const signedAt = Date.now();
      const nonce = ctx.connectNonce ?? "";

      const message = buildSignatureMessage({
        deviceId: identity.deviceId,
        clientId,
        clientMode,
        role,
        scopes,
        signedAtMs: signedAt,
        token: token || null,
        nonce,
      });

      const signature = await signMessage(identity.privateKey, message);

      device = {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt,
        nonce,
      };
    } catch {
      // Device identity failed — continue without it
    }

    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: "1.0.0",
        platform: "ios",
        mode: clientMode,
        instanceId: ctx.instanceId,
      },
      role,
      scopes,
      device,
      caps: ["tool-events"],
      auth,
    };
  },

  async handleConnectResult(result: Record<string, unknown> | undefined, config: GatewayConfig): Promise<void> {
    if (result?.auth && typeof result.auth === "object") {
      const authResult = result.auth as Record<string, unknown>;
      if (authResult.deviceToken) {
        await SecureStore.setItemAsync(`gateway_token_${config.id}`, authResult.deviceToken as string).catch(() => {});
      }
    }
  },

  mapEvent(event: string, payload?: Record<string, unknown>): GatewayMessage | null {
    switch (event) {
      case "chat": {
        const state = payload?.state as string;
        if (state === "delta") {
          return { type: "chat_token", payload };
        } else if (state === "final") {
          return { type: "chat_done", payload };
        } else if (state === "error") {
          return { type: "chat_error", payload };
        } else if (state === "aborted") {
          return { type: "chat_done", payload: { ...payload, aborted: true } };
        }
        return null;
      }
      case "agent":
        return { type: "chat_tool_call", payload };
      default:
        return null;
    }
  },

  buildChatSend(sessionKey: string, text: string, idempotencyKey: string, imageData?: string, profile?: { id: string; displayName: string }) {
    const params: Record<string, unknown> = { sessionKey, deliver: false, idempotencyKey };
    if (imageData) {
      // Multimodal content blocks — gateway tools.media.image must be enabled
      params.message = [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageData } },
        { type: "text", text },
      ];
    } else {
      params.message = text;
    }
    if (profile) {
      params.profile = profile;
    }
    return { method: "chat.send", params };
  },

  buildChatHistory(sessionKey: string) {
    return { method: "chat.history", params: { sessionKey } };
  },

  extractText(message: unknown): string {
    if (!message || typeof message !== "object") return "";
    const msg = message as Record<string, unknown>;
    const content = msg.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((c: Record<string, unknown>) => c.type === "text")
        .map((c: Record<string, unknown>) => c.text || "")
        .join("");
    }
    return "";
  },

  agentDiscoveryMethods() {
    return ["agents.list", "node.list"];
  },

  parseAgents(result: Record<string, unknown>): GatewayAgent[] {
    const agents = (result?.agents || result?.nodes) as Record<string, unknown>[] | undefined;
    if (!Array.isArray(agents)) return [];
    return agents.map((a) => ({
      id: (a.id as string) || (a.name as string) || "",
      name: (a.name as string) || "Agent",
      description: (a.description as string) || "",
      icon: (a.icon as string) || "bot",
      capabilities: Array.isArray(a.capabilities) ? (a.capabilities as string[]) : undefined,
      model: a.model as string | undefined,
    }));
  },

  buildPairingResponse(code: string) {
    return {
      method: "device.pair.respond",
      params: { code, deviceName: "ClawMobile.app" },
    };
  },
};
