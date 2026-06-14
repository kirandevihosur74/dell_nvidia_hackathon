import { useSlackStore } from "@/stores/slackStore";
import type { SlackWorkspace, SlackBridge, SlackChannel } from "@/types/slack";

// Helper to reset store between tests
function resetStore() {
  useSlackStore.getState().reset();
}

const mockWorkspace: SlackWorkspace = {
  id: "T12345",
  name: "Test Workspace",
  domain: "testworkspace",
  connectedAt: "2026-03-20T00:00:00Z",
  status: "connected",
  botScopes: ["chat:write", "channels:read"],
  userScopes: ["channels:read"],
};

const mockWorkspace2: SlackWorkspace = {
  id: "T67890",
  name: "Other Workspace",
  domain: "otherworkspace",
  connectedAt: "2026-03-20T01:00:00Z",
  status: "connected",
  botScopes: ["chat:write"],
  userScopes: [],
};

const mockBridge: SlackBridge = {
  messengerChannelId: "ch_001",
  slackChannelId: "C12345",
  slackTeamId: "T12345",
  slackChannelName: "engineering",
  syncDirection: "bidirectional",
  syncReactions: true,
  syncThreads: true,
  syncFiles: true,
  createdAt: "2026-03-20T00:00:00Z",
};

describe("Slack Store", () => {
  beforeEach(resetStore);

  // ─── Workspace Management ──────────────────────────────────────────────

  describe("workspaces", () => {
    it("starts empty", () => {
      expect(useSlackStore.getState().workspaces).toEqual([]);
    });

    it("adds a workspace", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      expect(useSlackStore.getState().workspaces).toHaveLength(1);
      expect(useSlackStore.getState().workspaces[0].name).toBe("Test Workspace");
    });

    it("updates existing workspace on duplicate add", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().addWorkspace({ ...mockWorkspace, status: "error" });
      expect(useSlackStore.getState().workspaces).toHaveLength(1);
      expect(useSlackStore.getState().workspaces[0].status).toBe("error");
    });

    it("removes a workspace", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().addWorkspace(mockWorkspace2);
      useSlackStore.getState().removeWorkspace("T12345");
      expect(useSlackStore.getState().workspaces).toHaveLength(1);
      expect(useSlackStore.getState().workspaces[0].id).toBe("T67890");
    });

    it("clears activeWorkspaceId when removing active workspace", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().setActiveWorkspace("T12345");
      useSlackStore.getState().removeWorkspace("T12345");
      expect(useSlackStore.getState().activeWorkspaceId).toBeNull();
    });

    it("removes associated bridges when removing workspace", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().addBridge(mockBridge);
      expect(useSlackStore.getState().bridges).toHaveLength(1);

      useSlackStore.getState().removeWorkspace("T12345");
      expect(useSlackStore.getState().bridges).toHaveLength(0);
    });

    it("updates workspace fields", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().updateWorkspace("T12345", { status: "error" });
      expect(useSlackStore.getState().workspaces[0].status).toBe("error");
    });

    it("sets multiple workspaces at once", () => {
      useSlackStore.getState().setWorkspaces([mockWorkspace, mockWorkspace2]);
      expect(useSlackStore.getState().workspaces).toHaveLength(2);
    });
  });

  // ─── Channel Discovery ─────────────────────────────────────────────────

  describe("available channels", () => {
    const mockChannels: SlackChannel[] = [
      { id: "C001", name: "general", isPrivate: false, isMember: true, memberCount: 50 },
      { id: "C002", name: "engineering", isPrivate: false, isMember: true, memberCount: 20 },
    ];

    it("sets available channels", () => {
      useSlackStore.getState().setAvailableChannels(mockChannels);
      expect(useSlackStore.getState().availableChannels).toHaveLength(2);
    });

    it("appends channels without duplicates", () => {
      useSlackStore.getState().setAvailableChannels(mockChannels);
      const moreChannels: SlackChannel[] = [
        { id: "C002", name: "engineering", isPrivate: false, isMember: true, memberCount: 20 }, // duplicate
        { id: "C003", name: "design", isPrivate: false, isMember: true, memberCount: 10 },
      ];
      useSlackStore.getState().appendAvailableChannels(moreChannels);
      expect(useSlackStore.getState().availableChannels).toHaveLength(3);
    });

    it("clears available channels and cursor", () => {
      useSlackStore.getState().setAvailableChannels(mockChannels);
      useSlackStore.getState().setChannelCursor("next_cursor");
      useSlackStore.getState().clearAvailableChannels();
      expect(useSlackStore.getState().availableChannels).toHaveLength(0);
      expect(useSlackStore.getState().channelCursor).toBeNull();
    });
  });

  // ─── Bridges ───────────────────────────────────────────────────────────

  describe("bridges", () => {
    it("adds a bridge", () => {
      useSlackStore.getState().addBridge(mockBridge);
      expect(useSlackStore.getState().bridges).toHaveLength(1);
    });

    it("prevents duplicate bridges", () => {
      useSlackStore.getState().addBridge(mockBridge);
      useSlackStore.getState().addBridge(mockBridge);
      expect(useSlackStore.getState().bridges).toHaveLength(1);
    });

    it("removes a bridge by messengerChannelId", () => {
      useSlackStore.getState().addBridge(mockBridge);
      useSlackStore.getState().removeBridge("ch_001");
      expect(useSlackStore.getState().bridges).toHaveLength(0);
    });

    it("sets all bridges at once", () => {
      const bridge2: SlackBridge = { ...mockBridge, messengerChannelId: "ch_002", slackChannelId: "C67890" };
      useSlackStore.getState().setBridges([mockBridge, bridge2]);
      expect(useSlackStore.getState().bridges).toHaveLength(2);
    });
  });

  // ─── Helpers ───────────────────────────────────────────────────────────

  describe("helpers", () => {
    it("getWorkspaceById returns correct workspace", () => {
      useSlackStore.getState().setWorkspaces([mockWorkspace, mockWorkspace2]);
      expect(useSlackStore.getState().getWorkspaceById("T12345")?.name).toBe("Test Workspace");
      expect(useSlackStore.getState().getWorkspaceById("TXXXXX")).toBeUndefined();
    });

    it("getBridgeForChannel returns correct bridge", () => {
      useSlackStore.getState().addBridge(mockBridge);
      expect(useSlackStore.getState().getBridgeForChannel("ch_001")?.slackChannelName).toBe("engineering");
      expect(useSlackStore.getState().getBridgeForChannel("ch_999")).toBeUndefined();
    });

    it("isBridged checks by slackChannelId", () => {
      useSlackStore.getState().addBridge(mockBridge);
      expect(useSlackStore.getState().isBridged("C12345")).toBe(true);
      expect(useSlackStore.getState().isBridged("C99999")).toBe(false);
    });
  });

  // ─── OAuth State ───────────────────────────────────────────────────────

  describe("oauth state", () => {
    it("tracks OAuth in progress", () => {
      expect(useSlackStore.getState().isOAuthInProgress).toBe(false);
      useSlackStore.getState().setOAuthInProgress(true);
      expect(useSlackStore.getState().isOAuthInProgress).toBe(true);
    });

    it("tracks OAuth errors", () => {
      useSlackStore.getState().setOAuthError("Token exchange failed");
      expect(useSlackStore.getState().oauthError).toBe("Token exchange failed");
      useSlackStore.getState().setOAuthError(null);
      expect(useSlackStore.getState().oauthError).toBeNull();
    });
  });

  // ─── Reset ─────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      useSlackStore.getState().addBridge(mockBridge);
      useSlackStore.getState().setOAuthInProgress(true);
      useSlackStore.getState().setOAuthError("error");
      useSlackStore.getState().setActiveWorkspace("T12345");

      useSlackStore.getState().reset();

      const state = useSlackStore.getState();
      expect(state.workspaces).toEqual([]);
      expect(state.bridges).toEqual([]);
      expect(state.isOAuthInProgress).toBe(false);
      expect(state.oauthError).toBeNull();
      expect(state.activeWorkspaceId).toBeNull();
    });
  });
});
