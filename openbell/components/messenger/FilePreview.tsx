import { View, Text, TouchableOpacity, Image } from "react-native";
import { FileText, Download } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { MessengerFile } from "@/types/messenger";
import * as Linking from "expo-linking";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  files: MessengerFile[];
}

export function FilePreview({ files }: Props) {
  const { theme } = useThemeStore();

  if (files.length === 0) return null;

  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      {files.map((file) => {
        const isImage = file.mimeType.startsWith("image/");

        if (isImage) {
          return (
            <TouchableOpacity
              key={file.id}
              onPress={() => Linking.openURL(file.url)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: file.thumbnailUrl || file.url }}
                style={{
                  width: "100%",
                  height: 180,
                  borderRadius: 10,
                  backgroundColor: theme.border,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={file.id}
            onPress={() => Linking.openURL(file.url)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 10,
              borderRadius: 10,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: theme.primary + "14",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <FileText size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                {formatFileSize(file.size)}
              </Text>
            </View>
            <Download size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
