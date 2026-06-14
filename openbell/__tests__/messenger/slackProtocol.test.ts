import * as proto from "@/services/messenger/slackProtocol";

describe("Slack Protocol Builders", () => {
  describe("slackOAuthStart", () => {
    it("builds correct method and params", () => {
      const result = proto.slackOAuthStart("clawmobile://slack/callback");
      expect(result.method).toBe("messenger.slack.oauth.start");
      expect(result.params.redirectUri).toBe("clawmobile://slack/callback");
    });
  });

  describe("slackOAuthComplete", () => {
    it("includes code and state", () => {
      const result = proto.slackOAuthComplete("xoxb-code", "csrf-state-123");
      expect(result.method).toBe("messenger.slack.oauth.complete");
      expect(result.params.code).toBe("xoxb-code");
      expect(result.params.state).toBe("csrf-state-123");
    });
  });

  describe("slackWorkspaceList", () => {
    it("builds with empty params", () => {
      const result = proto.slackWorkspaceList();
      expect(result.method).toBe("messenger.slack.workspace.list");
      expect(result.params).toEqual({});
    });
  });

  describe("slackWorkspaceDisconnect", () => {
    it("includes teamId", () => {
      const result = proto.slackWorkspaceDisconnect("T12345");
      expect(result.params.teamId).toBe("T12345");
    });
  });

  describe("slackChannelList", () => {
    it("builds without cursor", () => {
      const result = proto.slackChannelList("T12345");
      expect(result.method).toBe("messenger.slack.channel.list");
      expect(result.params.teamId).toBe("T12345");
      expect(result.params.cursor).toBeUndefined();
    });

    it("builds with cursor for pagination", () => {
      const result = proto.slackChannelList("T12345", "dXNlcjpVMDYx");
      expect(result.params.cursor).toBe("dXNlcjpVMDYx");
    });
  });

  describe("slackBridgeCreate", () => {
    it("builds with required params", () => {
      const result = proto.slackBridgeCreate("C12345", "T12345");
      expect(result.method).toBe("messenger.slack.bridge.create");
      expect(result.params.slackChannelId).toBe("C12345");
      expect(result.params.slackTeamId).toBe("T12345");
    });

    it("includes sync options when provided", () => {
      const result = proto.slackBridgeCreate("C12345", "T12345", {
        syncDirection: "bidirectional",
        syncReactions: true,
        syncThreads: false,
        syncFiles: true,
      });
      expect(result.params.syncDirection).toBe("bidirectional");
      expect(result.params.syncReactions).toBe(true);
      expect(result.params.syncThreads).toBe(false);
      expect(result.params.syncFiles).toBe(true);
    });
  });

  describe("slackBridgeRemove", () => {
    it("includes messengerChannelId", () => {
      const result = proto.slackBridgeRemove("ch_123");
      expect(result.params.messengerChannelId).toBe("ch_123");
    });
  });

  describe("slackBridgeList", () => {
    it("builds with empty params", () => {
      const result = proto.slackBridgeList();
      expect(result.method).toBe("messenger.slack.bridge.list");
    });
  });

  describe("slackSyncHistory", () => {
    it("uses default limit", () => {
      const result = proto.slackSyncHistory("ch_123");
      expect(result.params.limit).toBe(100);
    });

    it("accepts custom limit", () => {
      const result = proto.slackSyncHistory("ch_123", 50);
      expect(result.params.limit).toBe(50);
    });
  });

  describe("slackUserList", () => {
    it("includes teamId", () => {
      const result = proto.slackUserList("T12345");
      expect(result.params.teamId).toBe("T12345");
    });
  });
});
