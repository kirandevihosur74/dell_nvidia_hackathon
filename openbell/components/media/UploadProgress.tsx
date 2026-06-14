import { View, Text, TouchableOpacity } from "react-native";
import { X, Loader } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { formatFileSize } from "@/services/media";
import type { MediaAttachment } from "@/types/cards";

interface UploadProgressProps {
  attachment: MediaAttachment;
  onCancel?: () => void;
}

export function UploadProgress({ attachment, onCancel }: UploadProgressProps) {
  const { theme } = useThemeStore();

  if (attachment.uploadStatus === "complete") return null;

  const progress = attachment.uploadProgress || 0;
  const isError = attachment.uploadStatus === "error";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isError ? theme.error + "10" : theme.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: isError ? theme.error + "30" : theme.border,
        padding: 10,
        gap: 10,
      }}
    >
      <Loader size={16} color={isError ? theme.error : theme.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: "500", color: theme.text }} numberOfLines={1}>
          {attachment.fileName || "Uploading..."}
        </Text>
        {!isError && (
          <View style={{ height: 3, backgroundColor: theme.border, borderRadius: 2, marginTop: 4 }}>
            <View
              style={{
                height: 3,
                width: `${progress}%`,
                backgroundColor: theme.primary,
                borderRadius: 2,
              }}
            />
          </View>
        )}
        <Text style={{ fontSize: 10, color: isError ? theme.error : theme.textTertiary, marginTop: 2 }}>
          {isError ? "Upload failed — tap to retry" : `${progress}%${attachment.size ? ` of ${formatFileSize(attachment.size)}` : ""}`}
        </Text>
      </View>
      {onCancel && (
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <X size={14} color={theme.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
