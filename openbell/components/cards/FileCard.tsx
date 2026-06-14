import { View, Text, TouchableOpacity, Linking } from "react-native";
import { FileText, FileCode, FileImage, FileVideo, FileAudio, Download } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { formatFileSize } from "@/services/media";
import type { ToolResultCard, FileData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (mimeType.includes("javascript") || mimeType.includes("json") || mimeType.includes("typescript") || mimeType.includes("python") || mimeType.includes("html") || mimeType.includes("css"))
    return FileCode;
  return FileText;
}

export function FileCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as FileData;
  const Icon = getFileIcon(data.mimeType);

  return (
    <TouchableOpacity
      onPress={() => data.url && Linking.openURL(data.url)}
      activeOpacity={0.8}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: theme.primary + "15",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Icon size={22} color={theme.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }} numberOfLines={1}>
            {data.name}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            {data.mimeType || "File"}
            {data.size ? ` · ${formatFileSize(data.size)}` : ""}
          </Text>
          {data.path && (
            <Text style={{ fontSize: 10, color: theme.textTertiary }} numberOfLines={1}>
              {data.path}
            </Text>
          )}
        </View>

        {data.url && <Download size={18} color={theme.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}
