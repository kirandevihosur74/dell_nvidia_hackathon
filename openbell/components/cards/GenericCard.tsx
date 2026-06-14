import { View, Text, ScrollView, Platform } from "react-native";
import { Box } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function GenericCard({ card }: Props) {
  const { theme } = useThemeStore();

  const jsonPreview = JSON.stringify(card.data, null, 2);
  const isLong = jsonPreview.length > 500;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          gap: 6,
        }}
      >
        <Box size={13} color={theme.textTertiary} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text, flex: 1 }} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={{ fontSize: 10, color: theme.textTertiary }}>{card.type}</Text>
      </View>

      {card.subtitle && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>{card.subtitle}</Text>
        </View>
      )}

      {/* JSON data */}
      <ScrollView style={{ maxHeight: 200, padding: 12 }}>
        <Text
          style={{
            fontSize: 11,
            color: theme.textSecondary,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            lineHeight: 18,
          }}
          selectable
        >
          {isLong ? jsonPreview.slice(0, 500) + "\n..." : jsonPreview}
        </Text>
      </ScrollView>
    </View>
  );
}
