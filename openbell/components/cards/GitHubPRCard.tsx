import { View, Text, TouchableOpacity, Linking } from "react-native";
import { GitPullRequest, GitMerge, X, Plus, Minus, MessageSquare } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, GitHubPRData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

const STATE_CONFIG = {
  open: { color: "#3FB950", icon: GitPullRequest, label: "Open" },
  closed: { color: "#F85149", icon: X, label: "Closed" },
  merged: { color: "#A371F7", icon: GitMerge, label: "Merged" },
};

const REVIEW_CONFIG = {
  approved: { color: "#3FB950", label: "Approved" },
  changes_requested: { color: "#F85149", label: "Changes Requested" },
  pending: { color: "#D29922", label: "Review Pending" },
};

export function GitHubPRCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as GitHubPRData;
  const stateConfig = STATE_CONFIG[data.state];
  const StateIcon = stateConfig.icon;

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
          borderLeftColor: stateConfig.color,
          padding: 12,
          gap: 8,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StateIcon size={16} color={stateConfig.color} />
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{data.repo}</Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>#{data.number}</Text>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={2}>
          {data.title}
        </Text>

        {/* Labels */}
        {data.labels && data.labels.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {data.labels.map((label) => (
              <View key={label} style={{ backgroundColor: theme.primary + "20", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: theme.primary, fontWeight: "500" }}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Stats row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Plus size={12} color="#3FB950" />
            <Text style={{ fontSize: 12, color: "#3FB950", fontWeight: "500" }}>{data.additions}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Minus size={12} color="#F85149" />
            <Text style={{ fontSize: 12, color: "#F85149", fontWeight: "500" }}>{data.deletions}</Text>
          </View>
          {data.reviewStatus && (
            <View
              style={{
                backgroundColor: REVIEW_CONFIG[data.reviewStatus].color + "20",
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "600", color: REVIEW_CONFIG[data.reviewStatus].color }}>
                {REVIEW_CONFIG[data.reviewStatus].label}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 11, color: theme.textTertiary, marginLeft: "auto" }}>
            by {data.author}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
