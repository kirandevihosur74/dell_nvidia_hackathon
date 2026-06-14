import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type { GatewayConfig, GatewayMessage, ConnectionStatus, GatewayFileEntry, GatewayFileWithContent, CronJob, TokenUsage, KanbanTask, KanbanProposal, KanbanStatus } from "@/types/gateway";
import { encode, decode, buildPong } from "./gatewayProtocol";
import { getDeviceIdentity, buildSignatureMessage, signMessage } from "./deviceIdentity";
import { getProvider } from "./providers/registry";
import type { GatewayProvider } from "./providers/types";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 15000;

type MessageHandler = (msg: GatewayMessage) => void;
type StatusHandler = (status: ConnectionStatus, error?: string) => void;

function generateId(): string {
  return Crypto.randomUUID();
}

/**
 * Pending request tracker for the req/res protocol.
 */
interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private config: GatewayConfig | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectCompleted = false;
  private instanceId = generateId();

  private pending = new Map<string, PendingRequest>();
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = "disconnected";

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    handler(this.status);
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus { return this.status; }
  getConfig(): GatewayConfig | null { return this.config; }

  async connect(config: GatewayConfig): Promise<void> {
    this.disconnect();
    this.config = config;
    this.intentionalClose = false;
    this.reconnectAttempt = 0;
    await this.openSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearTimers();
    this.pending.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.config = null;
    this.connectNonce = null;
    this.connectSent = false;
    this.connectCompleted = false;
    this.setStatus("disconnected");
  }

  /** Send a GatewayMessage (for internal use by hooks). */
  send(msg: GatewayMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(encode(msg));
    return true;
  }

  /** Returns true once the connect handshake has completed on this socket. */
  isConnected(): boolean {
    return this.connectCompleted && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send a request to the Gateway and wait for a response.
   * Uses the Gateway's req/res protocol: { type: "req", id, method, params }
   */
  request(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Gateway not connected"));
    }
    // Allow the "connect" method itself, but block other requests until connect completes
    if (method !== "connect" && !this.connectCompleted) {
      return Promise.reject(new Error("Gateway connect handshake not completed"));
    }

    const id = generateId();
    const msg = { type: "req", id, method, params: params || {} };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          console.warn(`[GatewayClient] Request timed out after ${timeoutMs}ms: ${method}`);
          reject(new Error(`Gateway request timed out: ${method}`));
        }
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      this.ws!.send(JSON.stringify(msg));
    });
  }

  // --- Workspace File Operations (Gateway RPC) ---

  async filesList(agentId: string): Promise<GatewayFileEntry[]> {
    const result = await this.request("agents.files.list", { agentId });
    return (result as GatewayFileEntry[]) || [];
  }

  async filesGet(agentId: string, name: string): Promise<GatewayFileWithContent> {
    const result = await this.request("agents.files.get", { agentId, name });
    return result as GatewayFileWithContent;
  }

  async filesSet(agentId: string, name: string, content: string): Promise<{ ok: boolean }> {
    const result = await this.request("agents.files.set", { agentId, name, content });
    return (result as { ok: boolean }) || { ok: true };
  }

  // --- Cron Operations (Gateway RPC) ---

  async cronsList(agentId?: string): Promise<CronJob[]> {
    const result = await this.request("crons.list", agentId ? { agentId } : {});
    return (result as CronJob[]) || [];
  }

  async cronsCreate(job: { schedule: string; command: string; agentId: string }): Promise<CronJob> {
    const result = await this.request("crons.create", job);
    return result as CronJob;
  }

  async cronsUpdate(id: string, updates: Partial<Pick<CronJob, "schedule" | "command" | "enabled">>): Promise<CronJob> {
    const result = await this.request("crons.update", { id, ...updates });
    return result as CronJob;
  }

  async cronsDelete(id: string): Promise<{ ok: boolean }> {
    const result = await this.request("crons.delete", { id });
    return (result as { ok: boolean }) || { ok: true };
  }

  async cronsRun(id: string): Promise<{ sessionId: string }> {
    const result = await this.request("crons.run", { id });
    return result as { sessionId: string };
  }

  // --- Token Usage (Gateway RPC) ---

  async tokensUsage(sessionId: string): Promise<TokenUsage> {
    const result = await this.request("tokens.usage", { sessionId });
    return result as TokenUsage;
  }

  // --- Kanban Operations (Gateway RPC) ---

  async kanbanList(status?: KanbanStatus): Promise<KanbanTask[]> {
    const result = await this.request("kanban.tasks.list", status ? { status } : {});
    return (result as KanbanTask[]) || [];
  }

  async kanbanCreate(task: { title: string; description?: string; status: KanbanStatus; agentId?: string; priority?: string }): Promise<KanbanTask> {
    const result = await this.request("kanban.tasks.create", task);
    return result as KanbanTask;
  }

  async kanbanUpdate(id: string, updates: Partial<Pick<KanbanTask, "title" | "description" | "status" | "agentId" | "priority">>): Promise<KanbanTask> {
    const result = await this.request("kanban.tasks.update", { id, ...updates });
    return result as KanbanTask;
  }

  async kanbanDelete(id: string): Promise<{ ok: boolean }> {
    const result = await this.request("kanban.tasks.delete", { id });
    return (result as { ok: boolean }) || { ok: true };
  }

  async kanbanProposalsList(): Promise<KanbanProposal[]> {
    const result = await this.request("kanban.proposals.list", {});
    return (result as KanbanProposal[]) || [];
  }

  async kanbanProposalApprove(id: string): Promise<KanbanTask> {
    const result = await this.request("kanban.proposals.approve", { id });
    return result as KanbanTask;
  }

  async kanbanProposalReject(id: string, reason?: string): Promise<{ ok: boolean }> {
    const result = await this.request("kanban.proposals.reject", { id, reason });
    return (result as { ok: boolean }) || { ok: true };
  }

  // --- Internal ---

  private async openSocket(): Promise<void> {
    if (!this.config) return;

    this.setStatus("connecting");
    this.connectNonce = null;
    this.connectSent = false;
    this.connectCompleted = false;

    // Use wsUrl directly if provided (QR scan, relay, etc.), otherwise build from host:port
    let url: string;
    if (this.config.wsUrl) {
      url = this.config.wsUrl;
    } else {
      // Use plain ws:// for local/private networks, wss:// for public hosts
      const host = this.config.host;
      const isLocal =
        host.startsWith("localhost") ||
        host.startsWith("127.") ||
        host.startsWith("10.") ||
        host.startsWith("100.") || // Tailscale CGNAT range
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      const protocol = isLocal ? "ws" : "wss";
      url = `${protocol}://${this.config.host}:${this.config.port}`;
    }

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.setStatus("error", "Failed to create WebSocket");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      // Wait for connect.challenge from gateway, then sendConnect with nonce.
      // If no challenge arrives within 3s, send connect anyway (some gateways skip it).
      this.connectTimer = setTimeout(() => { this.sendConnect(); }, 3000);
    };

    this.ws.onmessage = (event) => {
      const raw = event.data as string;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      this.handleRawMessage(parsed);
    };

    this.ws.onerror = () => {
      this.setStatus("error", "WebSocket error");
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
      this.pending.forEach((p) => p.reject(new Error("Connection closed")));
      this.pending.clear();
      if (!this.intentionalClose) {
        this.setStatus("disconnected");
        this.scheduleReconnect();
      }
    };
  }

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    // Send connect immediately — the 750ms delay caused timeouts on LAN connections
    this.connectTimer = setTimeout(() => { this.sendConnect(); }, 100);
  }

  private getProvider(): GatewayProvider {
    return getProvider(this.config?.providerType || "openclaw");
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.config) return;
    this.connectSent = true;
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }

    const provider = this.getProvider();

    const storedDeviceToken = await SecureStore.getItemAsync(`gateway_token_${this.config.id}`).catch(() => null);
    const password = this.config.password?.trim() || undefined;

    const connectParams = await provider.buildConnectParams(this.config, {
      instanceId: this.instanceId,
      connectNonce: this.connectNonce,
      storedToken: storedDeviceToken,
      password,
    });

    try {
      const result = await this.request("connect", connectParams) as Record<string, unknown> | undefined;

      // Delegate token storage to the provider
      await provider.handleConnectResult(result, this.config);

      this.connectCompleted = true;
      this.setStatus("connected");
      this.startHeartbeat();

      // Broadcast success
      this.broadcast({ type: "auth_result", payload: { success: true, ...(result || {}) } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connect failed";

      if (message.includes("pairing")) {
        this.intentionalClose = true; // stop reconnect loop — wait for user to pair
        this.setStatus("pairing");
        this.broadcast({ type: "auth_challenge", payload: { direction: "enter" } });
      } else {
        // Don't reconnect on auth/origin/identity errors — user needs to fix config
        const isAuthError = message.includes("unauthorized") || message.includes("token") || message.includes("AUTH_")
          || message.includes("origin") || message.includes("device identity") || message.includes("pairing required");
        if (isAuthError) {
          this.intentionalClose = true; // prevent reconnect loop
        }
        this.setStatus("error", message);
      }
    }
  }

  private handleRawMessage(raw: Record<string, unknown>): void {
    const type = raw.type as string;

    // --- Response to a pending request ---
    if (type === "res") {
      const id = raw.id as string;
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        if (raw.ok) {
          pending.resolve(raw.payload);
        } else {
          const error = raw.error as Record<string, unknown> | undefined;
          pending.reject(new Error(error?.message as string || error?.code as string || "Request failed"));
        }
      }
      return;
    }

    // --- Event from Gateway ---
    if (type === "event") {
      const event = raw.event as string;
      const payload = raw.payload as Record<string, unknown> | undefined;

      // Handle connect challenge — store nonce and re-send connect with it
      if (event === "connect.challenge") {
        const nonce = payload?.nonce;
        if (typeof nonce === "string") {
          this.connectNonce = nonce;
          this.connectSent = false; // Allow re-send with nonce
          if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
          this.sendConnect();
        }
        return;
      }

      // Map Gateway events to our internal message types for subscribers
      this.mapAndBroadcastEvent(event, payload);
      return;
    }

    // --- Ping/pong ---
    if (type === "ping") {
      this.ws?.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      return;
    }
    if (type === "pong") {
      this.clearHeartbeatTimeout();
      return;
    }

    // --- Fallback: legacy format ---
    const msg = raw as unknown as GatewayMessage;
    if (msg.type) {
      this.broadcast(msg);
    }
  }

  private mapAndBroadcastEvent(event: string, payload?: Record<string, unknown>): void {
    const provider = this.getProvider();
    const mapped = provider.mapEvent(event, payload);
    if (mapped) {
      this.broadcast(mapped);
    } else {
      // Broadcast unknown events as-is for subscribers to handle
      this.broadcast({ type: event as GatewayMessage["type"], payload });
    }
  }

  private broadcast(msg: GatewayMessage): void {
    for (const handler of this.messageHandlers) {
      try { handler(msg); } catch { /* ignore */ }
    }
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    // Skip if status hasn't changed (avoids cascading re-renders)
    if (this.status === status && !error) return;
    this.status = status;
    for (const handler of this.statusHandlers) {
      try { handler(status, error); } catch { /* ignore */ }
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || !this.config) return;
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => { this.openSocket(); }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        // Don't close the socket on missed pong — the gateway sends its own
        // pings and will close from its side if the connection is truly dead.
        // Aggressively closing causes disruptive reconnect cycles on simulators.
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) { clearTimeout(this.heartbeatTimeout); this.heartbeatTimeout = null; }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
  }
}

export const gatewayClient = new GatewayClient();
