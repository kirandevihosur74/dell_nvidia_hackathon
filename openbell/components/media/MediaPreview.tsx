import { View, Text, Image, TouchableOpacity, Dimensions } from "react-native";
import { useState } from "react";
import { Play, FileText, Download } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { formatFileSize } from "@/services/media";
import type { MediaAttachment } from "@/types/cards";

interface MediaPreviewProps {
  attachment: MediaAttachment;
  onPress?: () => void;
  maxWidth?: number;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export function MediaPreview({ attachment, onPress, maxWidth = SCREEN_WIDTH * 0.65 }: MediaPreviewProps) {
  const { theme } = useThemeStore();
  const [imageError, setImageError] = useState(false);

  if (attachment.type === "image" && !imageError) {
    const aspectRatio =
      attachment.width && attachment.height ? attachment.width / attachment.height : 4 / 3;
    const displayWidth = Math.min(maxWidth, attachment.width || maxWidth);
    const displayHeight = displayWidth / aspectRatio;

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Image
          source={{ uri: attachment.uri }}
          style={{
            width: displayWidth,
            height: Math.min(displayHeight, 300),
            borderRadius: 12,
            backgroundColor: theme.border,
          }}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
        {attachment.uploadStatus === "uploading" && attachment.uploadProgress != null && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: theme.border,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 4,
                width: `${attachment.uploadProgress}%`,
                backgroundColor: theme.primary,
              }}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (attachment.type === "video") {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          width: maxWidth,
          height: 180,
          borderRadius: 12,
          backgroundColor: theme.background,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        {attachment.thumbnail ? (
          <Image
            source={{ uri: attachment.thumbnail }}
            style={{ width: "100%", height: "100%", borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        {attachment.duration != null && (
          <View style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, color: "#FFFFFF", fontVariant: ["tabular-nums"] }}>
              {Math.floor(attachment.duration / 60)}:{String(Math.floor(attachment.duration % 60)).padStart(2, "0")}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (attachment.type === "audio") {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
          gap: 10,
          width: maxWidth,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + "20", justifyContent: "center", alignItems: "center" }}>
          <Play size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: theme.text }} numberOfLines={1}>
            {attachment.fileName || "Audio"}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            {attachment.duration ? `${Math.floor(attachment.duration / 60)}:${String(Math.floor(attachment.duration % 60)).padStart(2, "0")}` : "Audio clip"}
            {attachment.size ? ` · ${formatFileSize(attachment.size)}` : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // File attachment
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 12,
        gap: 10,
        width: maxWidth,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.primary + "15", justifyContent: "center", alignItems: "center" }}>
        <FileText size={20} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: theme.text }} numberOfLines={1}>
          {attachment.fileName || "File"}
        </Text>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>
          {attachment.mimeType || "Unknown type"}
          {attachment.size ? ` · ${formatFileSize(attachment.size)}` : ""}
        </Text>
      </View>
      <Download size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}
