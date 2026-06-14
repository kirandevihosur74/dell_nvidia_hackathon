import { View, Text, TouchableOpacity } from "react-native";
import { Bot, PlusCircle, CheckCircle2, Edit3, Trash2, Zap, MessageSquare } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { BridgeActivity } from "@/services/bridge/asanaBridge";

interface AgentActivityItemProps {
  activity: BridgeActivity;
  onPress?: (activity: BridgeActivity) => void;
}

const TYPE_CONFIG: Record<BridgeActivity["type"], { icon: typeof Bot; color: string }> = {
  task_created: { icon: PlusCircle, color: "#10B981" },
  task_completed: { icon: CheckCircle2, color: "#8B5CF6" },
  task_updated: { icon: Edit3, color: "#3B82F6" },
  task_deleted: { icon: Trash2, color: "#EF4444" },
  agent_action: { icon: MessageSquare, color: "#3B82F6" },
  delegation: { icon: Zap, color: "#F59E0B" },
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

export function AgentActivityItem({ activity, onPress }: AgentActivityItemProps) {
  const { theme } = useThemeStore();
  const config = TYPE_CONFIG[activity.type];
  const Icon = config.icon;
  const isAgent = activity.source === "agent";

  return (
    <TouchableOpacity
      onPress={() => onPress?.(activity)}
      disabled={!onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}
    >
      <View style={{ alignItems: "center", gap: 4 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: config.color + "18",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={config.color} />
        </View>
        {isAgent && (
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
              marginTop: -8,
            }}
          >
            <Bot size={10} color={theme.primary} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>{activity.title}</Text>
            {isAgent && (
              <View style={{ backgroundColor: theme.primary + "20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: theme.primary }}>AGENT</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{formatTime(activity.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
          {activity.detail}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
