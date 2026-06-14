import { View, Text, FlatList, KeyboardAvoidingView, Platform, TouchableOpacity, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState, useMemo, memo } from "react";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import { useGateway } from "@/hooks/useGateway";
import { useOpenClawStream } from "@/hooks/useOpenClawStream";
import { useEncryptionStore } from "@/stores/encryptionStore";
import { useChannelStore } from "@/stores/channelStore";
import { useStreamIOStreamStore } from "@/stores/streamio/streamStore";
import { safelyTakePhoto } from "@/services/streamio/cameraRef";
import { Video } from "lucide-react-native";
import { GatewayStatusBar } from "@/components/openclaw/GatewayStatusBar";
import { ContextMeter } from "@/components/openclaw/ContextMeter";
import { WorkspaceSheet } from "@/components/workspace/WorkspaceSheet";
import { GatewayPicker } from "@/components/openclaw/GatewayPicker";
import { PairingScreen } from "@/components/openclaw/PairingScreen";
import { SessionSwitcher } from "@/components/openclaw/SessionSwitcher";
import { OpenClawMessageBubble } from "@/components/openclaw/OpenClawMessageBubble";
import { CommandPalette } from "@/components/openclaw/CommandPalette";
import { CommandToolbar } from "@/components/openclaw/CommandToolbar";
import { ToolTimeline } from "@/components/openclaw/ToolTimeline";
import { EncryptionBadge } from "@/components/openclaw/EncryptionBadge";

import { ChannelHeader } from "@/components/openclaw/ChannelHeader";
import { ChannelList } from "@/components/openclaw/ChannelList";
import { ThreadView } from "@/components/openclaw/ThreadView";
import { PinnedMessages } from "@/components/openclaw/PinnedMessages";
import { MessageActions } from "@/components/openclaw/MessageActions";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { OpenClawChatInput } from "@/components/openclaw/OpenClawChatInput";
import { LiveStreamBanner } from "@/components/openclaw/LiveStreamBanner";
import type { LiveStreamBannerHandle } from "@/components/openclaw/LiveStreamBanner";
import { SubagentBanner } from "@/components/openclaw/SubagentBanner";
import { RelayStatusBanner } from "@/components/openclaw/RelayStatusBanner";
import { sessionManager } from "@/services/gateway/sessionManager";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useCustomAgentStore, type CustomAgent } from "@/stores/customAgentStore";
import { AgentEditor } from "@/components/openclaw/AgentEditor";
import { ProfilePicker } from "@/components/openclaw/ProfilePicker";
import { findAgent } from "@/services/openclaw/agentLookup";
import { getSubagent } from "@/services/openclaw/subagentRegistry";
import { MeetingBotPanel } from "@/components/meeting/MeetingBotPanel";
import { StreamPreview } from "@/components/streamio/stream/StreamPreview";
import type { OpenClawMessage, OpenClawChannel } from "@/types/openclaw";

const MemoizedMessageBubble = memo(OpenClawMessageBubble);

export default function OpenClawScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { enabled: encryptionEnabled, isVerified: encryptionVerified, loadFromStorage: loadEncryption } = useEncryptionStore();
  const {
    gateways, activeGatewayId, connectionStatus, connectionError,
    agents, activeAgentId, sessions, activeSessionId,
    pairingCode, pairingDirection,
    connectToGateway, disconnectGateway, retryConnection, addNewGateway, editGateway, deleteGateway,
    submitPairingCode, selectAgent, createSession, switchSession,
  } = useGateway();

  const { messages, streamingContent, isStreaming, send, activeToolCalls } = useOpenClawStream();
  const isStreamLive = useStreamIOStreamStore((s) => s.status === "streaming");
  const streamCaptureSource = useStreamIOStreamStore((s) => s.captureSource);
  const streamCameraPosition = useStreamIOStreamStore((s) => s.cameraPosition);
  const [showStreamBanner, setShowStreamBanner] = useState(true);

  const {
    channels, activeChannelId, activeThreadId,
    setActiveChannel, setActiveThread,
    addChannel, removeChannel, pinMessage, unpinMessage,
    loadFromStorage: loadChannels,
  } = useChannelStore();

  useEffect(() => { loadChannels(); }, [loadChannels]);
  // Ensure a "general" channel always exists for the active gateway
  useEffect(() => {
    if (!activeGatewayId) return;
    const hasGeneral = channels.some((c) => c.name === "general" && c.gatewayId === activeGatewayId);
    if (!hasGeneral) {
      const defaultChannel: OpenClawChannel = {
        id: `${activeGatewayId}:general`,
        gatewayId: activeGatewayId,
        name: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
        pinnedMessageIds: [],
      };
      addChannel(defaultChannel);
    }
    if (!activeChannelId) {
      const general = channels.find((c) => c.name === "general" && c.gatewayId === activeGatewayId);
      setActiveChannel(general?.id || channels[0]?.id || null);
    }
  }, [channels.length, activeGatewayId, activeChannelId, addChannel, setActiveChannel]);
  useEffect(() => { loadEncryption(); }, [loadEncryption]);
  // Load custom agents
  useEffect(() => { useCustomAgentStore.getState().loadFromStorage(); }, []);
  // Restore persisted subagent sessions and ensure "main" always exists
  useEffect(() => {
    sessionManager.start();
    sessionManager.loadFromStorage().then(() => {
      const { setSessions } = useGatewayStore.getState();
      setSessions(sessionManager.getSessions());
    });

    // Keep store in sync whenever sessionManager changes
    const unsub = sessionManager.onUpdate((updatedSessions) => {
      useGatewayStore.getState().setSessions(updatedSessions);
    });
    return unsub;
  }, []);
  // Re-show the stream banner whenever a new stream starts
  useEffect(() => { if (isStreamLive) setShowStreamBanner(true); }, [isStreamLive]);

  const listRef = useRef<FlatList>(null);
  const streamBannerRef = useRef<LiveStreamBannerHandle>(null);
  const lastPreviewTapRef = useRef(0);
  const [showGateways, setShowGateways] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showAgentEditor, setShowAgentEditor] = useState(false);
  const [editorEditAgent, setEditorEditAgent] = useState<CustomAgent | null>(null);
  const [editorCloneFrom, setEditorCloneFrom] = useState<{ name: string; description: string; systemPrompt: string; categoryId: string; sandboxMode: "read-only" | "workspace-write"; id: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [threadInputText, setThreadInputText] = useState("");
  const [actionMessage, setActionMessage] = useState<OpenClawMessage | null>(null);

  const activeGateway = gateways.find((g) => g.id === activeGatewayId);
  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isSubagentSession = !!activeSession?.agentId;

  // Filter messages: session + channel, exclude thread replies from main view
  const sessionMessages = useMemo(
    () => messages.filter(
      (m) =>
        m.gatewayId === activeGatewayId &&
        m.sessionId === activeSessionId &&
        (m.channelId === activeChannelId || (!m.channelId && activeChannelId?.endsWith(":general"))) &&
        !m.threadId
    ),
    [messages, activeGatewayId, activeSessionId, activeChannelId]
  );

  const invertedMessages = useMemo(
    () => [...sessionMessages].reverse(),
    [sessionMessages]
  );

  // Thread data
  const threadParent = useMemo(
    () => activeThreadId ? messages.find((m) => m.id === activeThreadId) : null,
    [messages, activeThreadId]
  );
  const threadReplies = useMemo(
    () => activeThreadId ? messages.filter((m) => m.threadId === activeThreadId) : [],
    [messages, activeThreadId]
  );

  // Pinned messages
  const pinnedMessages = useMemo(() => {
    if (!activeChannel) return [];
    return messages.filter((m) => activeChannel.pinnedMessageIds.includes(m.id));
  }, [messages, activeChannel]);

  const isMessagePinned = useCallback(
    (messageId: string) => activeChannel?.pinnedMessageIds.includes(messageId) || false,
    [activeChannel]
  );

  const handleEditAgent = useCallback((agentId: string) => {
    // Delay to let the action sheet modal fully dismiss before opening the editor modal.
    // iOS can swallow the second modal if both transitions overlap.
    setTimeout(() => {
      // Check if it's a custom agent — edit directly
      const custom = useCustomAgentStore.getState().getAgent(agentId);
      if (custom) {
        setEditorEditAgent(custom);
        setEditorCloneFrom(null);
        setShowAgentEditor(true);
        return;
      }
      // Built-in agent — clone it for editing
      const builtIn = getSubagent(agentId);
      if (builtIn) {
        setEditorEditAgent(null);
        setEditorCloneFrom(builtIn);
        setShowAgentEditor(true);
      }
    }, 350);
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sessionManager.deleteSession(sessionId);
    const { setSessions, setActiveSession } = useGatewayStore.getState();
    setSessions(sessionManager.getSessions());
    setActiveSession(sessionManager.getActiveSessionId());
  }, []);

  const handleSend = useCallback((text: string, imageData?: string) => {
    setInputText("");
    // Only attach a frame if the user explicitly captured one via the camera button.
    // Auto-capture was removed — it blocked sends when the camera queue was busy.
    send(text, imageData);
  }, [send]);
  const handleThreadSend = useCallback((text: string) => { send(text, undefined, activeThreadId || undefined); setThreadInputText(""); }, [send, activeThreadId]);
  const handleCommand = useCallback((command: string) => { send(command); }, [send]);
  const handleCommandSelect = useCallback((cmd: { command: string }) => { send(cmd.command); setInputText(""); }, [send]);

  const handleCreateChannel = useCallback((name: string, description?: string) => {
    const channel: OpenClawChannel = {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      gatewayId: activeGatewayId || "",
      name, description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unreadCount: 0,
      pinnedMessageIds: [],
    };
    addChannel(channel);
    setActiveChannel(channel.id);
  }, [activeGatewayId, addChannel, setActiveChannel]);

  const handlePinMessage = useCallback((messageId: string) => {
    if (activeChannelId) pinMessage(activeChannelId, messageId);
  }, [activeChannelId, pinMessage]);

  const handleUnpinMessage = useCallback((messageId: string) => {
    if (activeChannelId) unpinMessage(activeChannelId, messageId);
  }, [activeChannelId, unpinMessage]);

  const renderItem = useCallback(
    ({ item }: { item: OpenClawMessage }) => (
      <MemoizedMessageBubble
        message={{ ...item, isPinned: isMessagePinned(item.id) }}
        onLongPress={setActionMessage}
        onThreadPress={setActiveThread}
      />
    ),
    [isMessagePinned, setActiveThread]
  );

  const renderFooter = useCallback(() => (
    <View style={{ gap: 8 }}>
      {isStreaming && activeToolCalls.length > 0 && <ToolTimeline toolCalls={activeToolCalls} />}
      {isStreaming && streamingContent ? (
        <StreamingMessage content={streamingContent} />
      ) : isStreaming ? <TypingIndicator /> : null}
    </View>
  ), [isStreaming, streamingContent, activeToolCalls]);

  // Pairing screen
  if (connectionStatus === "pairing" && (pairingCode || pairingDirection === "enter")) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <PairingScreen code={pairingCode} direction={pairingDirection} onSubmitCode={submitPairingCode} onCancel={disconnectGateway} onRetry={retryConnection} />
      </SafeAreaView>
    );
  }

  // Thread view
  if (activeThreadId && threadParent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <ThreadView
          parentMessage={threadParent}
          replies={threadReplies}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          inputValue={threadInputText}
          onInputChange={setThreadInputText}
          onSend={handleThreadSend}
          onBack={() => setActiveThread(null)}
        />
      </SafeAreaView>
    );
  }

  const showCommandPalette = inputText.startsWith("/") && connectionStatus === "connected";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>ClawMobile.app</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {connectionStatus === "connected" && (
            <TouchableOpacity
              onPress={() => setShowStreamBanner((v) => !v)}
              hitSlop={6}
              style={{
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: isStreamLive ? theme.error + "18" : theme.background,
                justifyContent: "center", alignItems: "center",
              }}
            >
              <Video size={16} color={isStreamLive ? theme.error : theme.textSecondary} />
            </TouchableOpacity>
          )}
          {connectionStatus === "connected" && (
            <EncryptionBadge enabled={encryptionEnabled} verified={encryptionVerified} onPress={() => router.push("/openclaw/encryption")} />
          )}
          {connectionStatus === "connected" && <ProfilePicker />}
        </View>
      </View>

      <GatewayStatusBar status={connectionStatus} gatewayName={activeGateway?.name} error={connectionError} onPress={() => setShowGateways(true)} onRetry={retryConnection} />

      {connectionStatus === "connected" && <ContextMeter />}

      {/* Meeting Bot Panel — collapsible, above agent selector */}
      {connectionStatus === "connected" && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          <MeetingBotPanel />
        </View>
      )}

      {/* Channel Header + inline Live Stream Banner */}
      {connectionStatus === "connected" && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <ChannelHeader
                channel={activeChannel}
                onOpenChannelList={() => setShowChannels(true)}
                onOpenPinnedMessages={() => setShowPinned(true)}
                pinnedCount={pinnedMessages.length}
                noBorder
              />
            </View>
            {showStreamBanner && (
              <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", paddingRight: 12 }}>
                <LiveStreamBanner
                  ref={streamBannerRef}
                  onDismiss={() => setShowStreamBanner(false)}
                  onSend={handleSend}
                  messages={sessionMessages}
                  streamingContent={streamingContent}
                  isAgentStreaming={isStreaming}
                  inline
                />
              </View>
            )}
          </View>
          {/* Camera preview below the header row when live — double-tap to expand */}
          {showStreamBanner && isStreamLive && (
            <Pressable
              onPress={() => {
                const now = Date.now();
                if (now - lastPreviewTapRef.current < 300) {
                  streamBannerRef.current?.expandFullscreen();
                }
                lastPreviewTapRef.current = now;
              }}
              style={{ height: 100, marginHorizontal: 12, marginTop: 4, marginBottom: 4, borderRadius: 8, overflow: "hidden" }}
            >
              <StreamPreview
                captureSource={streamCaptureSource}
                isStreaming
                cameraPosition={streamCameraPosition}
                cameraActive
              />
            </Pressable>
          )}
        </View>
      )}

      {connectionStatus === "connected" && sessions.length > 0 && (
        <SessionSwitcher sessions={sessions} activeSessionId={activeSessionId} onSelect={switchSession} onCreate={() => createSession()} onDelete={handleDeleteSession} onEditAgent={handleEditAgent} />
      )}

      {connectionStatus === "connected" && isSubagentSession && activeSession && (
        <SubagentBanner
          session={activeSession}
          onBackToMain={() => switchSession("main")}
          onEditAgent={handleEditAgent}
        />
      )}

      {connectionStatus === "connected" && <CommandToolbar onCommand={handleCommand} onWorkspace={() => setShowWorkspace(true)} />}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={50}>
        {connectionStatus !== "connected" ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🦀</Text>
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text, marginBottom: 8, textAlign: "center" }}>Connect to ClawMobile.app</Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center" }}>Add a Gateway to start chatting with your AI agent</Text>
          </View>
        ) : sessionMessages.length === 0 && !isStreaming ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🦀</Text>
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, marginBottom: 4 }}>
              {activeChannel ? `#${activeChannel.name}` : `Connected to ${activeGateway?.name}`}
            </Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: "center" }}>Send a message to start a conversation</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef} data={invertedMessages} renderItem={renderItem} keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={{ padding: 16, gap: 12 }} ListHeaderComponent={renderFooter}
            maxToRenderPerBatch={10} windowSize={11} initialNumToRender={15}
          />
        )}

        {showCommandPalette && <CommandPalette query={inputText} onSelect={handleCommandSelect} />}
        <RelayStatusBanner onTapAgent={(agentName) => {
          const match = sessions.find(s => s.name.toLowerCase() === agentName.toLowerCase() || s.agentId === agentName);
          if (match) switchSession(match.id);
        }} />
        <OpenClawChatInput onSend={handleSend} disabled={isStreaming || connectionStatus !== "connected"} readOnly={connectionStatus !== "connected"} value={inputText} onChangeText={setInputText} isStreamLive={isStreamLive} onCaptureFrame={safelyTakePhoto} />
      </KeyboardAvoidingView>

      {/* Modals */}
      <AgentEditor
        visible={showAgentEditor}
        onClose={() => setShowAgentEditor(false)}
        editAgent={editorEditAgent}
        cloneFrom={editorCloneFrom}
      />
      <GatewayPicker visible={showGateways} gateways={gateways} activeGatewayId={activeGatewayId}
        onSelect={(gw) => { connectToGateway(gw); setShowGateways(false); }}
        onAdd={async (name, host, port, authMethod, password, providerType) => { const config = await addNewGateway(name, host, port, authMethod, password, providerType); connectToGateway(config); setShowGateways(false); }}
        onEdit={editGateway} onDelete={deleteGateway} onClose={() => setShowGateways(false)}
        onScanQR={() => { setShowGateways(false); router.push("/scan-gateway"); }}
        onDiscoveredConnect={(config) => { connectToGateway(config); setShowGateways(false); }} />

      <ChannelList visible={showChannels} channels={channels} activeChannelId={activeChannelId}
        onSelect={setActiveChannel} onCreate={handleCreateChannel} onDelete={removeChannel} onClose={() => setShowChannels(false)} />

      <PinnedMessages visible={showPinned} messages={pinnedMessages} channelName={activeChannel?.name || "general"}
        onUnpin={handleUnpinMessage} onGoToMessage={() => {}} onClose={() => setShowPinned(false)} />

      <MessageActions message={actionMessage} isPinned={actionMessage ? isMessagePinned(actionMessage.id) : false}
        onPin={handlePinMessage} onUnpin={handleUnpinMessage} onOpenThread={setActiveThread} onClose={() => setActionMessage(null)} />

      <WorkspaceSheet visible={showWorkspace} onClose={() => setShowWorkspace(false)} />
    </SafeAreaView>
  );
}
