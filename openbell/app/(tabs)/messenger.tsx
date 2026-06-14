import { View, Text, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useMemo, memo, useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useMessengerStore } from "@/stores/messengerStore";
import * as messengerService from "@/services/messenger/messengerService";
import * as slackService from "@/services/messenger/slackService";
import * as agentBridge from "@/services/messenger/agentBridge";
import * as messengerNotifications from "@/services/messenger/messengerNotifications";
import { useSlackStore } from "@/stores/slackStore";
import { MessengerHeader } from "@/components/messenger/MessengerHeader";
import { MessengerChannelList } from "@/components/messenger/MessengerChannelList";
import { MessengerMessageBubble } from "@/components/messenger/MessengerMessageBubble";
import { MessengerMessageActions } from "@/components/messenger/MessengerMessageActions";
import { MessengerInput } from "@/components/messenger/MessengerInput";
import { MessengerThreadPanel } from "@/components/messenger/MessengerThreadPanel";
import { MessengerTypingIndicator } from "@/components/messenger/MessengerTypingIndicator";
import { AgentStreamingIndicator } from "@/components/messenger/AgentStreamingIndicator";
import { MessengerSearch } from "@/components/messenger/MessengerSearch";
import { ReactionPicker } from "@/components/messenger/ReactionPicker";
import { SlackConnectModal } from "@/components/messenger/SlackConnectModal";
import { SlackChannelPicker } from "@/components/messenger/SlackChannelPicker";
import { GatewayStatusBar } from "@/components/openclaw/GatewayStatusBar";
import { MessengerGatewayPicker } from "@/components/messenger/MessengerGatewayPicker";
import { useGateway } from "@/hooks/useGateway";
import { Link2, Search } from "lucide-react-native";
import type { MessengerMessage, MessengerChannelType } from "@/types/messenger";

const MemoizedBubble = memo(MessengerMessageBubble);

export default function MessengerScreen() {
  const { theme } = useThemeStore();
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);
  const activeGateway = useGatewayStore((s) => {
    const gw = s.gateways.find((g) => g.id === s.activeGatewayId);
    return gw ?? null;
  });
  const {
    connectToGateway,
    disconnectGateway,
    retryConnection,
  } = useGateway();

  const {
    channels,
    activeChannelId,
    activeThreadId,
    messagesByChannel,
    isLoadingMessages,
    users,
  } = useMessengerStore();

  const setActiveChannel = useMessengerStore((s) => s.setActiveChannel);
  const setActiveThread = useMessengerStore((s) => s.setActiveThread);
  const hasMoreMessages = useMessengerStore((s) => s.hasMoreMessages);

  const slackWorkspaces = useSlackStore((s) => s.workspaces);

  const listRef = useRef<FlatList>(null);
  const [showGatewayPicker, setShowGatewayPicker] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [showSlackConnect, setShowSlackConnect] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [slackPickerTeamId, setSlackPickerTeamId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<MessengerMessage | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId]
  );

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (connectionStatus === "connected") {
      messengerService.startMessengerListener();
      messengerNotifications.startNotificationListener();
      messengerService.fetchChannels();
      messengerService.fetchUsers();
      slackService.fetchWorkspaces();
      slackService.fetchBridges();
      // messenger.presence.update and messenger.push.register are gateway RPC
      // methods that most gateways (OpenClaw, NanoClaw, etc.) don't implement.
      // Skip them to avoid "unknown method" errors in gateway logs.
      // messengerService.setPresence("online");
      // messengerNotifications.registerPushTokenWithGateway();
    }
    return () => {
      messengerService.stopMessengerListener();
      messengerNotifications.stopNotificationListener();
    };
  }, [connectionStatus]);

  // Handle notification taps → navigate to channel/thread
  useEffect(() => {
    const cleanup = messengerNotifications.setupNotificationTapHandler(
      (channelId, threadId) => {
        setActiveChannel(channelId);
        if (threadId) setActiveThread(threadId);
      }
    );
    return cleanup;
  }, [setActiveChannel, setActiveThread]);

  // Load messages when active channel changes
  useEffect(() => {
    if (activeChannelId && connectionStatus === "connected") {
      messengerService.fetchMessages(activeChannelId);
    }
  }, [activeChannelId, connectionStatus]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannel(channels[0].id);
    }
  }, [channels, activeChannelId, setActiveChannel]);

  // ─── Messages for current channel ────────────────────────────────────────

  const channelMessages = useMemo(() => {
    if (!activeChannelId) return [];
    return (messagesByChannel[activeChannelId] || []).filter((m) => !m.threadId);
  }, [messagesByChannel, activeChannelId]);

  const invertedMessages = useMemo(() => [...channelMessages].reverse(), [channelMessages]);

  // Pinned messages
  const pinnedMessages = useMemo(() => {
    if (!activeChannel) return [];
    return channelMessages.filter((m) => m.isPinned);
  }, [channelMessages, activeChannel]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSend = useCallback((text: string) => {
    if (!activeChannelId) return;

    // Send the user's message to the channel
    messengerService.sendMessage(activeChannelId, text);

    // Check for @agent mentions and invoke agent if found
    const target = agentBridge.getTargetAgent(text);
    if (target) {
      agentBridge.invokeAgentInChannel(
        activeChannelId,
        text,
        target.agentId,
        target.agentName
      );
    }
  }, [activeChannelId]);

  const handleTyping = useCallback(() => {
    if (!activeChannelId) return;
    messengerService.sendTypingIndicator(activeChannelId);
  }, [activeChannelId]);

  const handleReactionToggle = useCallback((messageId: string, emoji: string, includesMe: boolean) => {
    if (includesMe) {
      messengerService.removeReaction(messageId, emoji);
    } else {
      messengerService.addReaction(messageId, emoji);
    }
  }, []);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    messengerService.addReaction(messageId, emoji);
  }, []);

  const handlePin = useCallback((messageId: string) => {
    messengerService.pinMessage(messageId);
  }, []);

  const handleUnpin = useCallback((messageId: string) => {
    messengerService.unpinMessage(messageId);
  }, []);

  const handleDelete = useCallback((messageId: string) => {
    messengerService.deleteMessage(messageId);
  }, []);

  const handleEdit = useCallback((_messageId: string) => {
    // TODO: implement inline edit
  }, []);

  const handleCreateChannel = useCallback((name: string, type: MessengerChannelType, description?: string) => {
    messengerService.createChannel(name, type as "public" | "private", description);
  }, []);

  const handleDeleteChannel = useCallback((channelId: string) => {
    messengerService.leaveChannel(channelId);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!activeChannelId || isLoadingMessages) return;
    if (!hasMoreMessages[activeChannelId]) return;
    const msgs = messagesByChannel[activeChannelId] || [];
    if (msgs.length === 0) return;
    const oldestId = msgs[0].id;
    messengerService.fetchMessages(activeChannelId, oldestId);
  }, [activeChannelId, isLoadingMessages, hasMoreMessages, messagesByChannel]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: MessengerMessage; index: number }) => {
      // For inverted list, grouping check is reversed
      const prevItem = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : null;
      const isGrouped = prevItem?.userId === item.userId;

      return (
        <MemoizedBubble
          message={item}
          onLongPress={setActionMessage}
          onThreadPress={setActiveThread}
          onReactionToggle={handleReactionToggle}
          isGrouped={isGrouped}
        />
      );
    },
    [invertedMessages, handleReactionToggle, setActiveThread]
  );

  // ─── Thread View ─────────────────────────────────────────────────────────

  if (activeThreadId && activeChannelId) {
    return (
      <MessengerThreadPanel
        parentMessageId={activeThreadId}
        channelId={activeChannelId}
        onClose={() => setActiveThread(null)}
      />
    );
  }

  // ─── Main View ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* App header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Messenger</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {connectionStatus === "connected" && (
            <TouchableOpacity
              onPress={() => setShowSearch(true)}
              hitSlop={6}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Search size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        {connectionStatus === "connected" && (
          <TouchableOpacity
            onPress={() => setShowSlackConnect(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: slackWorkspaces.length > 0 ? "#E01E5A14" : theme.card,
              borderWidth: 1,
              borderColor: slackWorkspaces.length > 0 ? "#E01E5A30" : theme.border,
            }}
          >
            <Link2 size={14} color={slackWorkspaces.length > 0 ? "#E01E5A" : theme.textTertiary} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: slackWorkspaces.length > 0 ? "#E01E5A" : theme.textTertiary }}>
              Slack{slackWorkspaces.length > 0 ? ` (${slackWorkspaces.length})` : ""}
            </Text>
          </TouchableOpacity>
        )}
        </View>
      </View>

      {connectionStatus !== "connected" && (
        <GatewayStatusBar
          status={connectionStatus}
          gatewayName={activeGateway?.name}
          error={useGatewayStore.getState().connectionError}
          onPress={() => setShowGatewayPicker(true)}
          onRetry={retryConnection}
        />
      )}

      {connectionStatus !== "connected" ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text, marginBottom: 8, textAlign: "center" }}>
            Connect to a Gateway
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center", marginBottom: 20 }}>
            Select a gateway to start messaging
          </Text>
          <TouchableOpacity
            onPress={() => setShowGatewayPicker(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: theme.primary,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Select Gateway</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Channel header */}
          <MessengerHeader
            channel={activeChannel}
            onOpenChannelList={() => setShowChannels(true)}
            pinnedCount={pinnedMessages.length}
            memberCount={activeChannel?.memberCount || 0}
          />

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={50}
          >
            {channelMessages.length === 0 && !isLoadingMessages ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, marginBottom: 4 }}>
                  {activeChannel ? `#${activeChannel.name}` : "No Channel Selected"}
                </Text>
                <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center" }}>
                  {activeChannel
                    ? "Send a message to start the conversation"
                    : "Select a channel from the list"}
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={invertedMessages}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                inverted
                contentContainerStyle={{ paddingVertical: 8 }}
                maxToRenderPerBatch={15}
                windowSize={11}
                initialNumToRender={20}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListHeaderComponent={
                  activeChannelId ? (
                    <MessengerTypingIndicator channelId={activeChannelId} />
                  ) : null
                }
              />
            )}

            {activeChannelId && <AgentStreamingIndicator channelId={activeChannelId} />}

            <MessengerInput
              onSend={handleSend}
              onTyping={handleTyping}
              disabled={!activeChannelId}
              placeholder={activeChannel ? `Message #${activeChannel.name} — @agent to invoke AI` : "Select a channel..."}
            />
          </KeyboardAvoidingView>
        </>
      )}

      {/* Modals */}
      <MessengerChannelList
        visible={showChannels}
        onClose={() => setShowChannels(false)}
        onSelect={setActiveChannel}
        onCreate={handleCreateChannel}
        onDelete={handleDeleteChannel}
      />

      <MessengerMessageActions
        message={actionMessage}
        onReact={handleReact}
        onThread={(id) => { setActiveThread(id); setActionMessage(null); }}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClose={() => setActionMessage(null)}
      />

      <SlackConnectModal
        visible={showSlackConnect}
        onClose={() => setShowSlackConnect(false)}
        onOpenChannelPicker={(teamId) => {
          setShowSlackConnect(false);
          setSlackPickerTeamId(teamId);
        }}
      />

      <SlackChannelPicker
        visible={!!slackPickerTeamId}
        teamId={slackPickerTeamId}
        onClose={() => setSlackPickerTeamId(null)}
      />

      <MessengerSearch
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onJumpToMessage={(channelId, _messageId) => {
          setActiveChannel(channelId);
          setShowSearch(false);
        }}
      />

      <MessengerGatewayPicker
        visible={showGatewayPicker}
        onSelect={connectToGateway}
        onDisconnect={disconnectGateway}
        onClose={() => setShowGatewayPicker(false)}
      />
    </SafeAreaView>
  );
}
