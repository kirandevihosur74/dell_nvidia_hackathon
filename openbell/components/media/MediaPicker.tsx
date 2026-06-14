import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Camera, Image, Paperclip, X } from "lucide-react-native";
import Animated, { SlideInDown, FadeOut } from "react-native-reanimated";
import { useThemeStore } from "@/stores/themeStore";
import type { MediaAttachment } from "@/types/cards";

interface MediaPickerProps {
  visible: boolean;
  onSelect: (attachment: MediaAttachment) => void;
  onClose: () => void;
}

export function MediaPicker({ visible, onSelect, onClose }: MediaPickerProps) {
  const { theme } = useThemeStore();

  if (!visible) return null;

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission Required", `Please grant ${useCamera ? "camera" : "photo library"} access.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8,
          allowsMultipleSelection: false,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === "video";

      const attachment: MediaAttachment = {
        id: `media_${Date.now()}`,
        type: isVideo ? "video" : "image",
        uri: asset.uri,
        mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
        fileName: asset.fileName || `${isVideo ? "video" : "photo"}_${Date.now()}`,
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        duration: isVideo ? (asset.duration ?? undefined) : undefined,
        uploadStatus: "pending",
      };

      onSelect(attachment);
      onClose();
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      const attachment: MediaAttachment = {
        id: `media_${Date.now()}`,
        type: "file",
        uri: asset.uri,
        mimeType: asset.mimeType || "application/octet-stream",
        fileName: asset.name,
        size: asset.size,
        uploadStatus: "pending",
      };

      onSelect(attachment);
      onClose();
    }
  };

  const options = [
    { label: "Camera", icon: Camera, onPress: () => pickImage(true) },
    { label: "Photo Library", icon: Image, onPress: () => pickImage(false) },
    { label: "File", icon: Paperclip, onPress: pickDocument },
  ];

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        backgroundColor: theme.card,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>Attach</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <X size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 16 }}>
        {options.map(({ label, icon: Icon, onPress }) => (
          <TouchableOpacity
            key={label}
            onPress={onPress}
            style={{ alignItems: "center", gap: 6, flex: 1 }}
            activeOpacity={0.6}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: theme.primary + "15",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon size={22} color={theme.primary} />
            </View>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}
