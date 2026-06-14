import { View, Text, TouchableOpacity } from "react-native";
import { Hash, Lock, MessageCircle, Users, ChevronDown, Pin, UserPlus } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { MessengerChannel } from "@/types/messenger";

interface Props {
  channel: MessengerChannel | null;
  onOpenChannelList: () => void;
  onOpenPinned?: () => void;
  onOpenMembers?: () => void;
  pinnedCount?: number;
  memberCount?: number;
}

export function MessengerHeader({
  channel,
  onOpenChannelList,
  onOpenPinned,
  onOpenMembers,
  pinnedCount = 0,
  memberCount = 0,
}: Props) {
  const { theme } = useThemeStore();

  const icon = !channel || channel.type === "public"
    ? <Hash size={16} color={theme.textSecondary} />
    : channel.type === "private"
    ? <Lock size={16} color={theme.textSecondary} />
    : channel.type === "dm"
    ? <MessageCircle size={16} color={theme.textSecondary} />
    : <Users size={16} color={theme.textSecondary} />;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      {/* Channel name (tappable to open list) */}
      <TouchableOpacity
        onPress={onOpenChannelList}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}
        activeOpacity={0.7}
      >
        {icon}
        <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }} numberOfLines={1}>
          {channel ? channel.name : "general"}
        </Text>
        <ChevronDown size={16} color={theme.textTertiary} />
        {channel?.type === "slack_bridge" && (
          <View style={{ backgroundColor: "#E01E5A14", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, fontWeight: "600", color: "#E01E5A" }}>SLACK</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Right actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {pinnedCount > 0 && (
          <TouchableOpacity onPress={onOpenPinned} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Pin size={14} color={theme.warning} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.warning }}>{pinnedCount}</Text>
          </TouchableOpacity>
        )}
        {memberCount > 0 && (
          <TouchableOpacity onPress={onOpenMembers} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Users size={14} color={theme.textTertiary} />
            <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>{memberCount}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
