import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GatewaySession } from "@/types/gateway";
import { gatewayClient } from "./gatewayClient";
import { saveSecure, getSecure } from "@/utils/secureStore";

const STORAGE_KEY = "openclaw_sessions";
const KEYCHAIN_KEY = "openclaw_sessions_backup";

type SessionUpdateHandler = (sessions: GatewaySession[]) => void;

/**
 * Manages sessions for the Gateway.
 * In the Gateway protocol, sessions are identified by sessionKey strings (e.g. "main").
 * This manager tracks known session keys and provides helpers.
 * Sessions are persisted to AsyncStorage so subagent sessions survive app restarts.
 *
 * Profile support: sessions are scoped to (gatewayId, profileId). Non-default profiles
 * use namespaced session keys (e.g. "profile_abc:main") to avoid collisions on the gateway.
 */
class SessionManager {
  private sessions: GatewaySession[] = [];
  private activeSessionId: string | null = null;
  private activeProfileId: string | null = null;
  private activeGatewayId: string | null = null;
  private handlers = new Set<SessionUpdateHandler>();

  /** Set the active gateway. Refilters sessions and ensures a main session exists. */
  setActiveGateway(gatewayId: string | null): void {
    this.activeGatewayId = gatewayId;
    // Ensure a main session exists for this gateway+profile combo
    const mainKey = this.namespaceKey("main");
    const existing = this.sessions.find(
      (s) => s.id === mainKey && this.matchesProfile(s) && this.matchesGateway(s)
    );
    if (!existing && gatewayId) {
      this.sessions = [...this.sessions, {
        id: mainKey,
        gatewayId,
        profileId: this.activeProfileId || undefined,
        name: "Main",
        verbose: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    }
    this.activeSessionId = mainKey;
    this.notify();
  }

  getActiveGatewayId(): string | null {
    return this.activeGatewayId;
  }

  /** Set the active profile. Refilters sessions and switches to that profile's main session. */
  setActiveProfile(profileId: string | null): void {
    this.activeProfileId = profileId;
    // Switch to the profile's main session
    const mainKey = this.namespaceKey("main");
    const existing = this.sessions.find(
      (s) => s.id === mainKey && this.matchesProfile(s) && this.matchesGateway(s)
    );
    if (!existing) {
      // Create main session for this profile
      this.sessions = [...this.sessions, {
        id: mainKey,
        gatewayId: this.activeGatewayId || "",
        profileId: profileId || undefined,
        name: "Main",
        verbose: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
    }
    this.activeSessionId = mainKey;
    this.notify();
  }

  start(): void {
    // Set default session
    if (!this.activeSessionId) {
      const mainKey = this.namespaceKey("main");
      this.activeSessionId = mainKey;
      this.sessions = [{
        id: mainKey,
        gatewayId: this.activeGatewayId || "",
        profileId: this.activeProfileId || undefined,
        name: "Main",
        verbose: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
      this.notify();
    }
  }

  /** Default subagent sessions to seed on first launch / after reinstall. */
  private static DEFAULT_SUBAGENTS: Array<{ id: string; name: string }> = [
    { id: "product-manager", name: "Product Manager" },
    { id: "customer-success-manager", name: "Customer Success Manager" },
    { id: "legal-advisor", name: "Legal Advisor" },
    { id: "sales-engineer", name: "Sales Engineer" },
  ];

  /** Load persisted sessions, trying AsyncStorage first then Keychain (survives reinstall).
   *  If neither has data, seeds with default subagents. */
  async loadFromStorage(): Promise<void> {
    try {
      let raw = await AsyncStorage.getItem(STORAGE_KEY);

      // If AsyncStorage is empty (e.g. after reinstall), restore from Keychain
      if (!raw) {
        raw = await getSecure(KEYCHAIN_KEY);
      }

      const mainSession = this.sessions.find(s => s.id === "main") || {
        id: "main",
        gatewayId: this.activeGatewayId || "",
        name: "Main",
        verbose: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (raw) {
        const stored: GatewaySession[] = JSON.parse(raw);
        const subagentSessions = stored.filter(s => s.agentId);
        this.sessions = [mainSession, ...subagentSessions];
      } else {
        // No persisted data — seed with default subagents
        const now = new Date().toISOString();
        const defaultSessions: GatewaySession[] = SessionManager.DEFAULT_SUBAGENTS.map(a => ({
          id: a.id,
          gatewayId: this.activeGatewayId || "",
          name: a.name,
          agentId: a.id,
          verbose: false,
          createdAt: now,
          updatedAt: now,
        }));
        this.sessions = [mainSession, ...defaultSessions];
      }

      this.notify();
      this.persist();
    } catch {
      // ignore — start fresh
    }
  }

  private syncTimer: ReturnType<typeof setInterval> | null = null;

  /** Regex matching gateway subagent session keys.
   *  Supports both formats: agent:main:subagent:<id> and webchat:g-agent-main-subagent-<id> */
  private static SUBAGENT_KEY_RE = /subagent[:\-]/;

  /** Read-only name lookup for gateway subagent sessions.
   *  Indexed by both the gateway key AND extracted UUID for cross-format matching.
   *  Used by the banner and session tab bar to resolve keys to display names. */
  private gatewaySubagentNames = new Map<string, string>();

  /** For each label, the most recently updated gateway session key.
   *  Used to deduplicate the tab bar when multiple sessions share the same name. */
  private latestByLabel = new Map<string, string>();

  /** Extract UUID from any subagent session key format.
   *  "agent:main:subagent:0146da98-..." → "0146da98-..."
   *  "webchat:g-agent-main-subagent-0146da98-..." → "0146da98-..." */
  private static extractSubagentUUID(key: string): string | null {
    // agent:main:subagent:<uuid>
    const colonMatch = key.match(/subagent:([0-9a-f]{8}-[0-9a-f-]+)$/i);
    if (colonMatch) return colonMatch[1];
    // webchat:g-agent-main-subagent-<uuid>
    const hyphenMatch = key.match(/subagent-([0-9a-f]{8}-[0-9a-f-]+)$/i);
    if (hyphenMatch) return hyphenMatch[1];
    return null;
  }

  /** Returns true if this session key is the most recent for its label.
   *  Used by the tab bar to deduplicate multiple sessions with the same name. */
  isLatestForLabel(sessionKey: string): boolean {
    const name = this.getGatewaySubagentName(sessionKey);
    if (!name) return true; // unknown sessions pass through
    const latestKey = this.latestByLabel.get(name);
    if (!latestKey) return true;
    // Match by exact key or UUID
    if (latestKey === sessionKey) return true;
    const sessionUUID = SessionManager.extractSubagentUUID(sessionKey);
    const latestUUID = SessionManager.extractSubagentUUID(latestKey);
    return !!(sessionUUID && latestUUID && sessionUUID === latestUUID);
  }

  /** Resolve a gateway subagent session key to a display name, or null if unknown.
   *  Matches by exact key first, then by extracted UUID. */
  getGatewaySubagentName(sessionKey: string): string | null {
    // Exact match
    const exact = this.gatewaySubagentNames.get(sessionKey);
    if (exact) return exact;
    // UUID match — the client may use a different key format than the gateway
    const uuid = SessionManager.extractSubagentUUID(sessionKey);
    if (uuid) return this.gatewaySubagentNames.get(uuid) || null;
    return null;
  }

  /** Fetch the gateway's session list and build a name lookup for subagent sessions.
   *  Does not modify the session tab bar — read-only for banner display. */
  async syncGatewaySessions(): Promise<void> {
    if (!this.activeGatewayId) return;
    try {
      const result = await gatewayClient.request("sessions.list", { limit: 1000 }) as Record<string, unknown> | undefined;
      const remoteSessions = (result?.sessions || []) as Array<Record<string, unknown>>;

      this.gatewaySubagentNames.clear();
      this.latestByLabel.clear();

      // First pass: collect all subagent sessions with their labels and timestamps
      const subagentEntries: { key: string; label: string; updatedAt: number }[] = [];
      for (const rs of remoteSessions) {
        const key = (rs.sessionKey || rs.key) as string | undefined;
        if (!key || !SessionManager.SUBAGENT_KEY_RE.test(key)) continue;

        const rawLabel = (rs.label || rs.displayName || rs.name) as string | undefined;
        if (!rawLabel) continue;

        const cleanLabel = rawLabel.replace(/^Subagent:\s*/i, "").trim();
        const updatedAt = (rs.updatedAt as number) || 0;

        // Index name lookup by full key AND UUID
        this.gatewaySubagentNames.set(key, cleanLabel);
        const uuid = SessionManager.extractSubagentUUID(key);
        if (uuid) this.gatewaySubagentNames.set(uuid, cleanLabel);

        subagentEntries.push({ key, label: cleanLabel, updatedAt });
      }

      // Second pass: for each label, keep only the most recently updated key
      for (const entry of subagentEntries) {
        const existing = this.latestByLabel.get(entry.label);
        if (!existing) {
          this.latestByLabel.set(entry.label, entry.key);
        } else {
          const existingEntry = subagentEntries.find(e => e.key === existing);
          if (existingEntry && entry.updatedAt > existingEntry.updatedAt) {
            this.latestByLabel.set(entry.label, entry.key);
          }
        }
      }

      // Notify listeners so the UI re-renders with resolved names
      this.notify();
    } catch {
      // Gateway unreachable — keep existing lookup
    }
  }

  /** Start periodic sync with the gateway (every 30s). Call after connecting. */
  startSync(): void {
    this.stopSync();
    // Initial sync
    this.syncGatewaySessions();
    // Periodic refresh
    this.syncTimer = setInterval(() => this.syncGatewaySessions(), 30000);
  }

  /** Stop periodic sync. */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  stop(): void {
    this.stopSync();
    this.sessions = [];
    this.activeSessionId = null;
  }

  onUpdate(handler: SessionUpdateHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Get sessions for the active gateway + profile. */
  getSessions(): GatewaySession[] {
    return this.sessions.filter((s) => this.matchesProfile(s) && this.matchesGateway(s));
  }

  /** Get all sessions regardless of profile (for internal use/persistence). */
  getAllSessions(): GatewaySession[] {
    return this.sessions;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    this.notify();
  }

  /** Create a new session, optionally with a subagent system prompt. */
  createSession(name?: string, _model?: string, opts?: { agentId?: string; systemPrompt?: string }): void {
    const rawKey = name || `session_${Date.now()}`;
    const key = this.namespaceKey(rawKey);
    const session: GatewaySession = {
      id: key,
      gatewayId: this.activeGatewayId || "",
      profileId: this.activeProfileId || undefined,
      agentId: opts?.agentId,
      name: name || rawKey,
      verbose: false,
      systemPrompt: opts?.systemPrompt,
      systemPromptSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions = [...this.sessions, session];
    this.activeSessionId = key;
    this.notify();
    this.persist();
  }

  /** Mark a session's system prompt as sent. */
  markSystemPromptSent(sessionKey: string): void {
    this.sessions = this.sessions.map(s =>
      s.id === sessionKey ? { ...s, systemPromptSent: true } : s
    );
    this.notify();
    this.persist();
  }

  /** Get a session by ID. */
  getSession(sessionKey: string): GatewaySession | undefined {
    return this.sessions.find(s => s.id === sessionKey);
  }

  /** Remove a session. Switches to "main" if the deleted session was active. */
  deleteSession(sessionKey: string): void {
    this.sessions = this.sessions.filter(s => s.id !== sessionKey);
    if (this.activeSessionId === sessionKey) {
      this.activeSessionId = "main";
    }
    this.notify();
    this.persist();
  }

  /** Reset a session's history on the Gateway. */
  async resetSession(sessionKey: string): Promise<void> {
    try {
      await gatewayClient.request("sessions.reset", { key: sessionKey });
    } catch {
      // ignore
    }
  }

  private notify(): void {
    for (const handler of this.handlers) {
      try { handler(this.sessions); } catch { /* ignore */ }
    }
  }

  private persist(): void {
    // Only persist subagent sessions — "main" is always recreated on start()
    const toStore = this.sessions.filter(s => s.agentId);
    const json = JSON.stringify(toStore);
    // Write to both AsyncStorage (fast, cleared on uninstall) and Keychain (survives reinstall)
    AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
    saveSecure(KEYCHAIN_KEY, json).catch(() => {});
  }

  /** Check if a session belongs to the active profile. */
  private matchesProfile(session: GatewaySession): boolean {
    const activeId = this.activeProfileId;
    // No active profile or "default" profile → match sessions with no profileId or "default"
    if (!activeId || activeId === "default") {
      return !session.profileId || session.profileId === "default";
    }
    return session.profileId === activeId;
  }

  /** Check if a session belongs to the active gateway. */
  private matchesGateway(session: GatewaySession): boolean {
    const gwId = this.activeGatewayId;
    // No active gateway → match sessions with no gatewayId or empty string
    if (!gwId) return !session.gatewayId;
    // Match sessions for this gateway, or legacy sessions with empty gatewayId
    return session.gatewayId === gwId || !session.gatewayId;
  }

  /** Namespace a session key for the active profile. Default profile uses un-namespaced keys. */
  private namespaceKey(key: string): string {
    const activeId = this.activeProfileId;
    if (!activeId || activeId === "default") return key;
    return `${activeId}:${key}`;
  }
}

export const sessionManager = new SessionManager();
