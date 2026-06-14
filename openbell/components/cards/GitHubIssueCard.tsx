import { View, Text, TouchableOpacity, Linking } from "react-native";
import { CircleDot, CheckCircle2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, GitHubIssueData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function GitHubIssueCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as GitHubIssueData;
  const isOpen = data.state === "open";

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
          borderColor: theme.border,
          borderLeftWidth: 3,
          borderLeftColor: isOpen ? "#3FB950" : "#A371F7",
          padding: 12,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isOpen ? (
            <CircleDot size={16} color="#3FB950" />
          ) : (
            <CheckCircle2 size={16} color="#A371F7" />
          )}
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{data.repo}</Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>#{data.number}</Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={2}>
          {data.title}
        </Text>

        {data.labels && data.labels.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {data.labels.map((label) => (
              <View key={label} style={{ backgroundColor: theme.primary + "20", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: theme.primary, fontWeight: "500" }}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>by {data.author}</Text>
          {data.assignees && data.assignees.length > 0 && (
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              → {data.assignees.join(", ")}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
