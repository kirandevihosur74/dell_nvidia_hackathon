import * as WebBrowser from "expo-web-browser";
import { useSlackStore } from "@/stores/slackStore";
import { useMessengerStore } from "@/stores/messengerStore";
import * as slackService from "@/services/messenger/slackService";
import type { SlackWorkspace, SlackBridge } from "@/types/slack";
import type { MessengerChannel } from "@/types/messenger";
import type { GatewayMessage } from "@/types/gateway";

// Access the mock gateway client
const mockGatewayClient = (global as any).__mockGatewayClient;

function resetStores() {
  useSlackStore.getState().reset();
  useMessengerStore.getState().reset();
  jest.clearAllMocks();
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

describe("Slack Service", () => {
  beforeEach(resetStores);

  // ─── OAuth Flow ────────────────────────────────────────────────────────

  describe("connectWorkspace", () => {
    it("initiates OAuth and handles successful flow", async () => {
      // Mock Gateway returning auth URL
      mockGatewayClient.request.mockResolvedValueOnce({
        authUrl: "https://slack.com/oauth/v2/authorize?client_id=test",
        state: "csrf-token-123",
      });

      // Mock browser returning with auth code
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "clawmobile://slack/callback?code=xoxb-code&state=csrf-token-123",
      });

      // Mock Gateway completing OAuth
      mockGatewayClient.request.mockResolvedValueOnce({
        workspace: mockWorkspace,
      });

      const result = await slackService.connectWorkspace();

      expect(result.success).toBe(true);
      expect(result.workspace?.name).toBe("Test Workspace");
      expect(useSlackStore.getState().workspaces).toHaveLength(1);
      expect(useSlackStore.getState().isOAuthInProgress).toBe(false);
    });

    it("handles cancelled OAuth", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        authUrl: "https://slack.com/oauth/v2/authorize",
        state: "csrf-123",
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "cancel",
      });

      const result = await slackService.connectWorkspace();

      expect(result.success).toBe(false);
      expect(result.error).toBe("OAuth was cancelled");
      expect(useSlackStore.getState().isOAuthInProgress).toBe(false);
    });

    it("detects CSRF state mismatch", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        authUrl: "https://slack.com/oauth/v2/authorize",
        state: "csrf-original",
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "clawmobile://slack/callback?code=xoxb-code&state=csrf-TAMPERED",
      });

      const result = await slackService.connectWorkspace();

      expect(result.success).toBe(false);
      expect(result.error).toContain("state mismatch");
      expect(useSlackStore.getState().oauthError).toContain("state mismatch");
    });

    it("handles missing authorization code", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        authUrl: "https://slack.com/oauth/v2/authorize",
        state: "csrf-123",
      });

      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "clawmobile://slack/callback?error=access_denied",
      });

      const result = await slackService.connectWorkspace();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing authorization code");
    });

    it("handles Gateway request failure", async () => {
      mockGatewayClient.request.mockRejectedValueOnce(new Error("Gateway unavailable"));

      const result = await slackService.connectWorkspace();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gateway unavailable");
      expect(useSlackStore.getState().isOAuthInProgress).toBe(false);
    });
  });

  // ─── Workspace Management ──────────────────────────────────────────────

  describe("fetchWorkspaces", () => {
    it("fetches and stores workspaces", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        workspaces: [mockWorkspace],
      });

      await slackService.fetchWorkspaces();

      expect(useSlackStore.getState().workspaces).toHaveLength(1);
      expect(mockGatewayClient.request).toHaveBeenCalledWith(
        "messenger.slack.workspace.list",
        {}
      );
    });

    it("handles empty response", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({ workspaces: [] });

      await slackService.fetchWorkspaces();

      expect(useSlackStore.getState().workspaces).toHaveLength(0);
    });

    it("handles request failure gracefully", async () => {
      mockGatewayClient.request.mockRejectedValueOnce(new Error("fail"));

      await slackService.fetchWorkspaces();

      // Should not throw, just warn
      expect(useSlackStore.getState().workspaces).toHaveLength(0);
    });
  });

  describe("disconnectWorkspace", () => {
    it("disconnects and removes workspace from store", async () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);
      mockGatewayClient.request.mockResolvedValueOnce({});

      await slackService.disconnectWorkspace("T12345");

      expect(useSlackStore.getState().workspaces).toHaveLength(0);
      expect(mockGatewayClient.request).toHaveBeenCalledWith(
        "messenger.slack.workspace.disconnect",
        { teamId: "T12345" }
      );
    });
  });

  // ─── Channel Discovery ─────────────────────────────────────────────────

  describe("fetchSlackChannels", () => {
    it("fetches channels for a workspace", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        channels: [
          { id: "C001", name: "general", isPrivate: false, isMember: true, memberCount: 50 },
          { id: "C002", name: "engineering", isPrivate: false, isMember: true, memberCount: 20 },
        ],
        nextCursor: "cursor_page2",
      });

      await slackService.fetchSlackChannels("T12345");

      const state = useSlackStore.getState();
      expect(state.availableChannels).toHaveLength(2);
      expect(state.channelCursor).toBe("cursor_page2");
      expect(state.isLoadingChannels).toBe(false);
    });

    it("appends channels on loadMore", async () => {
      // Initial load
      useSlackStore.getState().setAvailableChannels([
        { id: "C001", name: "general", isPrivate: false, isMember: true, memberCount: 50 },
      ]);
      useSlackStore.getState().setChannelCursor("cursor_page2");

      mockGatewayClient.request.mockResolvedValueOnce({
        channels: [
          { id: "C002", name: "engineering", isPrivate: false, isMember: true, memberCount: 20 },
        ],
        nextCursor: null,
      });

      await slackService.fetchSlackChannels("T12345", true);

      expect(useSlackStore.getState().availableChannels).toHaveLength(2);
      expect(useSlackStore.getState().channelCursor).toBeNull();
    });
  });

  // ─── Bridging ──────────────────────────────────────────────────────────

  describe("bridgeChannel", () => {
    it("creates bridge and adds channel to messenger store", async () => {
      const mockBridge: SlackBridge = {
        messengerChannelId: "ch_slack_001",
        slackChannelId: "C12345",
        slackTeamId: "T12345",
        slackChannelName: "engineering",
        syncDirection: "bidirectional",
        syncReactions: true,
        syncThreads: true,
        syncFiles: true,
        createdAt: "2026-03-20T00:00:00Z",
      };

      const mockChannel: MessengerChannel = {
        id: "ch_slack_001",
        name: "engineering",
        type: "slack_bridge",
        slackChannelId: "C12345",
        slackTeamId: "T12345",
        createdAt: "2026-03-20T00:00:00Z",
        updatedAt: "2026-03-20T00:00:00Z",
        unreadCount: 0,
        memberCount: 20,
        pinnedMessageIds: [],
      };

      mockGatewayClient.request.mockResolvedValueOnce({
        bridge: mockBridge,
        channel: mockChannel,
      });

      const result = await slackService.bridgeChannel("C12345", "T12345", {
        syncDirection: "bidirectional",
        syncReactions: true,
        syncThreads: true,
        syncFiles: true,
      });

      expect(result).not.toBeNull();
      expect(result!.slackChannelName).toBe("engineering");
      expect(useSlackStore.getState().bridges).toHaveLength(1);
      expect(useMessengerStore.getState().channels).toHaveLength(1);
      expect(useMessengerStore.getState().channels[0].type).toBe("slack_bridge");
    });

    it("returns null on failure", async () => {
      mockGatewayClient.request.mockRejectedValueOnce(new Error("Bridge failed"));

      const result = await slackService.bridgeChannel("C12345", "T12345");

      expect(result).toBeNull();
    });
  });

  describe("unbridgeChannel", () => {
    it("removes bridge from store", async () => {
      useSlackStore.getState().addBridge({
        messengerChannelId: "ch_001",
        slackChannelId: "C12345",
        slackTeamId: "T12345",
        slackChannelName: "engineering",
        syncDirection: "bidirectional",
        syncReactions: true,
        syncThreads: true,
        syncFiles: true,
        createdAt: "2026-03-20T00:00:00Z",
      });

      mockGatewayClient.request.mockResolvedValueOnce({});

      await slackService.unbridgeChannel("ch_001");

      expect(useSlackStore.getState().bridges).toHaveLength(0);
    });
  });

  describe("fetchBridges", () => {
    it("fetches and stores bridges", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        bridges: [
          {
            messengerChannelId: "ch_001",
            slackChannelId: "C12345",
            slackTeamId: "T12345",
            slackChannelName: "engineering",
            syncDirection: "bidirectional",
            syncReactions: true,
            syncThreads: true,
            syncFiles: true,
            createdAt: "2026-03-20T00:00:00Z",
          },
        ],
      });

      await slackService.fetchBridges();

      expect(useSlackStore.getState().bridges).toHaveLength(1);
    });
  });

  // ─── Event Handling ────────────────────────────────────────────────────

  describe("event listener", () => {
    let capturedHandler: (msg: GatewayMessage) => void;

    beforeEach(() => {
      mockGatewayClient.onMessage.mockImplementation((handler: any) => {
        capturedHandler = handler;
        return jest.fn(); // unsubscribe
      });
      slackService.startSlackListener();
    });

    afterEach(() => {
      slackService.stopSlackListener();
    });

    it("handles workspace connected event", () => {
      capturedHandler({
        type: "messenger:slack:workspace:connected" as any,
        payload: { workspace: mockWorkspace },
      });

      expect(useSlackStore.getState().workspaces).toHaveLength(1);
    });

    it("handles workspace disconnected event", () => {
      useSlackStore.getState().addWorkspace(mockWorkspace);

      capturedHandler({
        type: "messenger:slack:workspace:disconnected" as any,
        payload: { teamId: "T12345" },
      });

      expect(useSlackStore.getState().workspaces).toHaveLength(0);
    });

    it("handles bridge created event", () => {
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

      const mockChannel: MessengerChannel = {
        id: "ch_001",
        name: "engineering",
        type: "slack_bridge",
        createdAt: "2026-03-20T00:00:00Z",
        updatedAt: "2026-03-20T00:00:00Z",
        unreadCount: 0,
        memberCount: 0,
        pinnedMessageIds: [],
      };

      capturedHandler({
        type: "messenger:slack:bridge:created" as any,
        payload: { bridge: mockBridge, channel: mockChannel },
      });

      expect(useSlackStore.getState().bridges).toHaveLength(1);
      expect(useMessengerStore.getState().channels).toHaveLength(1);
    });

    it("handles bridge removed event", () => {
      useSlackStore.getState().addBridge({
        messengerChannelId: "ch_001",
        slackChannelId: "C12345",
        slackTeamId: "T12345",
        slackChannelName: "engineering",
        syncDirection: "bidirectional",
        syncReactions: true,
        syncThreads: true,
        syncFiles: true,
        createdAt: "2026-03-20T00:00:00Z",
      });

      capturedHandler({
        type: "messenger:slack:bridge:removed" as any,
        payload: { messengerChannelId: "ch_001" },
      });

      expect(useSlackStore.getState().bridges).toHaveLength(0);
    });

    it("ignores non-slack events", () => {
      capturedHandler({
        type: "messenger:message:new" as any,
        payload: { message: {} },
      });

      // Should not throw or change slack state
      expect(useSlackStore.getState().workspaces).toHaveLength(0);
    });
  });

  // ─── Sync ──────────────────────────────────────────────────────────────

  describe("syncChannelHistory", () => {
    it("sends sync request to Gateway", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({});

      await slackService.syncChannelHistory("ch_001", 50);

      expect(mockGatewayClient.request).toHaveBeenCalledWith(
        "messenger.slack.sync.history",
        { messengerChannelId: "ch_001", limit: 50 }
      );
    });
  });

  // ─── Users ─────────────────────────────────────────────────────────────

  describe("fetchSlackUsers", () => {
    it("fetches and stores user mappings", async () => {
      mockGatewayClient.request.mockResolvedValueOnce({
        users: [
          { slackUserId: "U001", slackDisplayName: "Alice", isBot: false },
          { slackUserId: "U002", slackDisplayName: "SlackBot", isBot: true },
        ],
      });

      await slackService.fetchSlackUsers("T12345");

      expect(useSlackStore.getState().slackUsers).toHaveLength(2);
    });
  });
});
