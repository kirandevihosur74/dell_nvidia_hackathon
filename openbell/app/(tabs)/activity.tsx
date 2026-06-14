import { View, Text, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, MessageSquare, CheckCircle2, PlusCircle, Search, AlertCircle, Radio, Bot } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { useAsanaBridge } from "@/hooks/useAsanaBridge";
import { AgentActivityItem } from "@/components/bridge/AgentActivityItem";
import { useStreamActivity, StreamActivity } from "@/hooks/streamio/useStreamActivity";
import { useMeetingBotStore } from "@/stores/meetingBotStore";
import { StreamActivityCard } from "@/components/streamio/dashboard/StreamActivityCard";
import { LiveStatusWidget } from "@/components/streamio/dashboard/LiveStatusWidget";
import { StreamQuickActions } from "@/components/streamio/dashboard/StreamQuickActions";
import { useState, useCallback, useMemo } from "react";
import type { BridgeActivity } from "@/services/bridge/asanaBridge";

type ActivitySource = "all" | "asana" | "openclaw" | "stream" | "meeting";

interface ActivityItem {
  id: string;
  type: "chat" | "task_created" | "task_completed" | "task_searched" | "error" | "meeting_bot" | "meeting_action";
  title: string;
  detail: string;
  timestamp: string;
  source: "asana" | "openclaw" | "meeting";
}

const iconMap = {
  chat: MessageSquare,
  task_created: PlusCircle,
  task_completed: CheckCircle2,
  task_searched: Search,
  error: AlertCircle,
  meeting_bot: Bot,
  meeting_action: CheckCircle2,
};

const colorMap = {
  chat: "#3B82F6",
  task_created: "#10B981",
  task_completed: "#8B5CF6",
  task_searched: "#F59E0B",
  error: "#EF4444",
  meeting_bot: "#22C55E",
  meeting_action: "#3B82F6",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function classifyMessage(content: string): { type: ActivityItem["type"]; title: string } {
  const lower = content.toLowerCase();
  if (lower.includes("created") || lower.includes("new task")) {
    return { type: "task_created", title: "Task Created" };
  }
  if (lower.includes("completed") || lower.includes("marked as complete")) {
    return { type: "task_completed", title: "Task Completed" };
  }
  if (lower.includes("search") || lower.includes("found")) {
    return { type: "task_searched", title: "Task Search" };
  }
  if (lower.startsWith("error")) {
    return { type: "error", title: "Error" };
  }
  return { type: "chat", title: "AI Response" };
}

type UnifiedItem = ActivityItem | BridgeActivity | StreamActivity;

function isBridgeActivity(item: UnifiedItem): item is BridgeActivity {
  return "source" in item && (item.source === "agent" || (item as BridgeActivity).type === "delegation");
}

function isStreamActivity(item: UnifiedItem): item is StreamActivity {
  return "source" in item && item.source === "stream";
}

export default function ActivityScreen() {
  const { theme } = useThemeStore();
  const { messages } = useChatStore();
  const { activities: bridgeActivities } = useAsanaBridge();
  const streamActivities = useStreamActivity();
  const meetingBotStatus = useMeetingBotStore((s) => s.status);
  const meetingActionItems = useMeetingBotStore((s) => s.actionItems);
  const meetingPlatform = useMeetingBotStore((s) => s.platform);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<ActivitySource>("all");

  // Asana activities from chat messages
  const asanaActivities: ActivityItem[] = useMemo(() => {
    return messages
      .filter((m) => m.role === "assistant")
      .map((m) => {
        const { type, title } = classifyMessage(m.content);
        return {
          id: m.id,
          type,
          title,
          detail: m.content.length > 120 ? m.content.slice(0, 120) + "..." : m.content,
          timestamp: m.timestamp,
          source: "asana" as const,
        };
      })
      .reverse();
  }, [messages]);

  // Meeting bot activity items
  const meetingActivities: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];

    // Bot lifecycle event
    if (meetingBotStatus === "recording" && meetingPlatform) {
      items.push({
        id: "meeting-bot-active",
        type: "meeting_bot",
        title: "Meeting Bot Active",
        detail: `Recording ${meetingPlatform} meeting`,
        timestamp: new Date().toISOString(),
        source: "meeting",
      });
    }

    // Action item events
    for (const ai of meetingActionItems) {
      if (ai.status === "pushed") {
        items.push({
          id: `meeting-ai-${ai.id}`,
          type: "meeting_action",
          title: "Action Item Pushed",
          detail: ai.description,
          timestamp: ai.confirmedAt || ai.detectedAt,
          source: "meeting",
        });
      } else if (ai.status === "confirmed") {
        items.push({
          id: `meeting-ai-${ai.id}`,
          type: "meeting_action",
          title: "Action Item Confirmed",
          detail: ai.description,
          timestamp: ai.confirmedAt || ai.detectedAt,
          source: "meeting",
        });
      }
    }

    return items;
  }, [meetingBotStatus, meetingPlatform, meetingActionItems]);

  // Unified & filtered
  const allActivities: UnifiedItem[] = useMemo(() => {
    const combined: UnifiedItem[] = [...asanaActivities, ...bridgeActivities, ...streamActivities, ...meetingActivities];
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (sourceFilter === "asana") return combined.filter((a) => !isBridgeActivity(a) && !isStreamActivity(a) && (a as ActivityItem).source !== "meeting");
    if (sourceFilter === "openclaw") return combined.filter((a) => isBridgeActivity(a));
    if (sourceFilter === "stream") return combined.filter((a) => isStreamActivity(a));
    if (sourceFilter === "meeting") return combined.filter((a) => (a as ActivityItem).source === "meeting");
    return combined;
  }, [asanaActivities, bridgeActivities, streamActivities, meetingActivities, sourceFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: UnifiedItem }) => {
      if (isStreamActivity(item)) {
        return <StreamActivityCard activity={item} />;
      }

      if (isBridgeActivity(item)) {
        return <AgentActivityItem activity={item} />;
      }

      const actItem = item as ActivityItem;
      const Icon = iconMap[actItem.type];
      const color = colorMap[actItem.type];

      return (
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.border,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: color + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{actItem.title}</Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>{formatTime(actItem.timestamp)}</Text>
            </View>
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
              {actItem.detail}
            </Text>
          </View>
        </View>
      );
    },
    [theme]
  );

  const filterOptions: { id: ActivitySource; label: string }[] = [
    { id: "all", label: "All" },
    { id: "asana", label: "Asana" },
    { id: "openclaw", label: "Agent" },
    { id: "stream", label: "Stream" },
    { id: "meeting", label: "Meeting" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Activity</Text>
      </View>

      {/* Source Filter */}
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            onPress={() => setSourceFilter(opt.id)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: sourceFilter === opt.id ? theme.primary : theme.card,
              borderWidth: 1,
              borderColor: sourceFilter === opt.id ? theme.primary : theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: sourceFilter === opt.id ? "600" : "400",
                color: sourceFilter === opt.id ? "#FFFFFF" : theme.textSecondary,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stream widgets when Stream filter active */}
      {sourceFilter === "stream" && (
        <>
          <LiveStatusWidget />
          <StreamQuickActions />
        </>
      )}

      {allActivities.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
          <Bell size={48} color={theme.textTertiary} />
          <Text style={{ fontSize: 16, color: theme.textSecondary }}>No recent activity</Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.textTertiary,
              textAlign: "center",
              paddingHorizontal: 48,
            }}
          >
            {sourceFilter === "stream"
              ? "Start a stream to see activity here."
              : "Start a chat or connect your ClawMobile.app agent to see activity here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={allActivities}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      )}
    </SafeAreaView>
  );
}
