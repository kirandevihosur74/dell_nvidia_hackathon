import { useCallback, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Plus,
  MessageSquare,
  ChevronRight,
  Bot,
  Server,
  Pencil,
  Trash2,
  StopCircle,
  Clock,
} from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { SUBAGENT_CATEGORIES } from "@/services/openclaw/subagentRegistry";
import { findAgent } from "@/services/openclaw/agentLookup";
import { sessionManager } from "@/services/gateway/sessionManager";
import type { GatewaySession, SessionStatus } from "@/types/gateway";

/** Resolve a session's display name. Uses the gateway name lookup for raw keys. */
function resolveSessionName(session: GatewaySession): string {
  // Try the gateway name lookup first (handles both agent: and webchat: key formats)
  const resolved = sessionManager.getGatewaySubagentName(session.id);
  if (resolved) return resolved;
  // If the session already has a clean name (not a raw key), use it
  if (session.name && !session.name.includes(":") && !session.name.includes("subagent")) {
    return session.name;
  }
  // Fallback
  return session.name || `Session ${session.id.slice(0, 6)}`;
}

interface SessionSwitcherProps {
  sessions: GatewaySession[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onAbort?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onEditAgent?: (agentId: string) => void;
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  idle: "#9CA3AF",
  thinking: "#F59E0B",
  streaming: "#3B82F6",
  done: "#10B981",
  error: "#EF4444",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  streaming: "Streaming",
  done: "Done",
  error: "Error",
};

interface SessionNode {
  session: GatewaySession;
  children: SessionNode[];
  depth: number;
}

function buildTree(sessions: GatewaySession[]): SessionNode[] {
  const nodeMap = new Map<string, SessionNode>();
  const roots: SessionNode[] = [];

  for (const session of sessions) {
    nodeMap.set(session.id, { session, children: [], depth: 0 });
  }

  for (const session of sessions) {
    const node = nodeMap.get(session.id)!;
    if (session.parentSessionId && nodeMap.has(session.parentSessionId)) {
      const parent = nodeMap.get(session.parentSessionId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flattenTree(nodes: SessionNode[]): SessionNode[] {
  const result: SessionNode[] = [];
  function walk(node: SessionNode) {
    result.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const root of nodes) {
    walk(root);
  }
  return result;
}

/** Themed action sheet for session management */
function SessionActionSheet({
  session,
  visible,
  onClose,
  onAbort,
  onDelete,
  onEditAgent,
}: {
  session: GatewaySession | null;
  visible: boolean;
  onClose: () => void;
  onAbort?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onEditAgent?: (agentId: string) => void;
}) {
  const { theme } = useThemeStore();

  // Count messages in this session — hooks must run before any early return
  const messages = useGatewayStore((s) => s.messages);
  const messageCount = useMemo(
    () => session ? messages.filter((m) => m.sessionId === session.id).length : 0,
    [messages, session?.id],
  );

  const createdLabel = useMemo(() => {
    if (!session) return "";
    try {
      const d = new Date(session.createdAt);
      return `Created ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    } catch {
      return "";
    }
  }, [session?.createdAt]);

  if (!session) return null;

  const isSubagent = !!session.agentId;
  const subagent = session.agentId ? findAgent(session.agentId) : undefined;
  const status = session.status || "idle";
  const canAbort = onAbort && (status === "thinking" || status === "streaming");

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(80)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

        <Animated.View
          entering={SlideInUp.duration(180)}
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: theme.border,
            paddingBottom: 34,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.border,
              }}
            />
          </View>

          {/* Session info header */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {isSubagent ? (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: theme.primary + "15",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bot size={20} color={theme.primary} />
                </View>
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: theme.border + "80",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MessageSquare size={20} color={theme.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text }}>
                  {resolveSessionName(session)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 13, color: theme.primary, fontWeight: "500" }}>
                    {isSubagent ? "Subagent" : "Main Session"}
                  </Text>
                  {createdLabel.length > 0 && (
                    <>
                      <Text style={{ fontSize: 13, color: theme.textTertiary }}>·</Text>
                      <Text style={{ fontSize: 13, color: theme.textTertiary }}>{createdLabel}</Text>
                    </>
                  )}
                  <Text style={{ fontSize: 13, color: theme.textTertiary }}>·</Text>
                  <Text style={{ fontSize: 13, color: theme.textTertiary }}>
                    {messageCount} {messageCount === 1 ? "message" : "messages"}
                  </Text>
                </View>
              </View>
            </View>

            {isSubagent && subagent?.description && (
              <Text
                style={{
                  fontSize: 13,
                  color: theme.textSecondary,
                  marginLeft: 50,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {subagent.description}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 16 }} />

          {/* Actions */}
          <View style={{ paddingVertical: 6 }}>
            {onEditAgent && session.agentId && (
              <TouchableOpacity
                onPress={() => { onEditAgent(session.agentId!); onClose(); }}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: 14,
                }}
              >
                <Pencil size={18} color={theme.primary} />
                <Text style={{ fontSize: 16, color: theme.primary, fontWeight: "500" }}>
                  Edit Agent
                </Text>
              </TouchableOpacity>
            )}

            {canAbort && (
              <TouchableOpacity
                onPress={() => { onAbort(session.id); onClose(); }}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: 14,
                }}
              >
                <StopCircle size={18} color="#F59E0B" />
                <Text style={{ fontSize: 16, color: "#F59E0B", fontWeight: "500" }}>
                  Abort
                </Text>
              </TouchableOpacity>
            )}

            {onDelete && isSubagent && (
              <TouchableOpacity
                onPress={() => { onDelete(session.id); onClose(); }}
                activeOpacity={0.6}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  gap: 14,
                }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={{ fontSize: 16, color: "#EF4444", fontWeight: "500" }}>
                  Delete Session
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function SessionSwitcher({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onAbort,
  onDelete,
  onEditAgent,
}: SessionSwitcherProps) {
  const { theme } = useThemeStore();
  const [actionSession, setActionSession] = useState<GatewaySession | null>(null);

  const flatNodes = useMemo(() => {
    // Deduplicate gateway subagents — show only the most recent per label
    const deduped = sessions.filter(s => sessionManager.isLatestForLabel(s.id));
    const tree = buildTree(deduped);
    return flattenTree(tree);
  }, [sessions]);

  const handleLongPress = useCallback(
    (session: GatewaySession) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setActionSession(session);
    },
    [],
  );

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
      >
        {flatNodes.map(({ session, depth, children }) => {
          const isActive = session.id === activeSessionId;
          const status = session.status || "idle";
          const statusColor = STATUS_COLORS[status];
          const hasChildren = children.length > 0;
          const isSubagent = !!session.agentId;
          const subagent = session.agentId ? findAgent(session.agentId) : undefined;
          const catMeta = subagent
            ? SUBAGENT_CATEGORIES.find((c) => c.id === subagent.categoryId)
            : undefined;
          const isGatewaySubagent = /subagent[:\-]/.test(session.id);
          const SessionIcon = isGatewaySubagent ? Server : isSubagent ? Bot : MessageSquare;
          const pillBorderColor = isActive
            ? theme.primary
            : isSubagent && catMeta
              ? theme.primary + "60"
              : theme.border;

          return (
            <TouchableOpacity
              key={session.id}
              onPress={() => onSelect(session.id)}
              onLongPress={() => handleLongPress(session)}
              delayLongPress={400}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 18,
                backgroundColor: isActive ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: pillBorderColor,
                gap: 6,
                marginLeft: depth > 0 ? depth * 4 : 0,
              }}
            >
              {depth > 0 && (
                <ChevronRight size={10} color={isActive ? "#FFFFFF" : theme.textTertiary} />
              )}

              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: isActive ? "#FFFFFF" : statusColor,
                }}
              />

              <SessionIcon size={13} color={isActive ? "#FFFFFF" : isSubagent ? theme.primary : theme.textSecondary} />

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? "600" : "400",
                  color: isActive ? "#FFFFFF" : isSubagent ? theme.text : theme.textSecondary,
                  maxWidth: 100,
                }}
                numberOfLines={1}
              >
                {resolveSessionName(session)}
              </Text>

              {hasChildren && (
                <View
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.3)" : theme.primary + "20",
                    borderRadius: 8,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: isActive ? "#FFFFFF" : theme.primary,
                    }}
                  >
                    {children.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={onCreate}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            borderStyle: "dashed",
            gap: 6,
          }}
        >
          <Plus size={13} color={theme.textTertiary} />
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>New</Text>
        </TouchableOpacity>
      </ScrollView>

      <SessionActionSheet
        session={actionSession}
        visible={!!actionSession}
        onClose={() => setActionSession(null)}
        onAbort={onAbort}
        onDelete={onDelete}
        onEditAgent={onEditAgent}
      />
    </View>
  );
}
