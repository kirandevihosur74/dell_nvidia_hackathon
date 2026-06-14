import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { ExternalLink, Globe } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, WebPreviewData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function WebPreviewCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as WebPreviewData;

  const handlePress = () => {
    if (data.url) Linking.openURL(data.url);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: "hidden",
        }}
      >
        {/* Preview image */}
        {data.imageUrl && (
          <Image
            source={{ uri: data.imageUrl }}
            style={{ width: "100%", height: 140 }}
            resizeMode="cover"
          />
        )}

        <View style={{ padding: 12, gap: 4 }}>
          {/* Site name */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {data.favicon ? (
              <Image source={{ uri: data.favicon }} style={{ width: 14, height: 14, borderRadius: 2 }} />
            ) : (
              <Globe size={12} color={theme.textTertiary} />
            )}
            <Text style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
              {data.siteName || new URL(data.url).hostname}
            </Text>
          </View>

          {/* Title */}
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={2}>
            {data.title || card.title}
          </Text>

          {/* Description */}
          {data.description && (
            <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }} numberOfLines={2}>
              {data.description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
