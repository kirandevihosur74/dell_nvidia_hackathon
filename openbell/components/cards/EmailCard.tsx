import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Mail, MailOpen } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, EmailData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function EmailCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as EmailData;
  const isRead = data.isRead ?? true;

  return (
    <TouchableOpacity
      onPress={() => data.url && Linking.openURL(data.url)}
      activeOpacity={0.8}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isRead ? theme.border : theme.primary + "40",
          padding: 12,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isRead ? (
            <MailOpen size={16} color={theme.textTertiary} />
          ) : (
            <Mail size={16} color={theme.primary} />
          )}
          <Text style={{ fontSize: 11, color: theme.textTertiary, flex: 1 }} numberOfLines={1}>
            {data.from}
          </Text>
          <Text style={{ fontSize: 10, color: theme.textTertiary }}>{data.date}</Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: isRead ? "400" : "600",
            color: theme.text,
          }}
          numberOfLines={1}
        >
          {data.subject}
        </Text>

        <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }} numberOfLines={2}>
          {data.preview}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
