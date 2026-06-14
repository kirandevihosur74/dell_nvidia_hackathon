import { View, Text, TouchableOpacity } from "react-native";
import { Hash, Pin, ChevronDown, MessageSquare } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawChannel } from "@/types/openclaw";

interface ChannelHeaderProps {
  channel: OpenClawChannel | null;
  onOpenChannelList: () => void;
  onOpenPinnedMessages: () => void;
  pinnedCount: number;
  noBorder?: boolean;
}

export function ChannelHeader({ channel, onOpenChannelList, onOpenPinnedMessages, pinnedCount, noBorder }: ChannelHeaderProps) {
  const { theme } = useThemeStore();

  return (
    <TouchableOpacity
      onPress={onOpenChannelList}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        ...(!noBorder ? { borderBottomWidth: 1, borderBottomColor: theme.border } : {}),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Hash size={16} color={theme.primary} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>
          {channel?.name || "general"}
        </Text>
        <ChevronDown size={14} color={theme.textTertiary} />
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onOpenPinnedMessages(); }}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 3,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: pinnedCount > 0 ? theme.warning + "15" : "transparent",
            marginLeft: 2,
          }}
        >
          <Pin size={11} color={pinnedCount > 0 ? theme.warning : theme.textTertiary} />
          {pinnedCount > 0 && (
            <Text style={{ fontSize: 10, fontWeight: "600", color: theme.warning }}>{pinnedCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
