import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Pin, MessageSquare, Copy, Share2, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawMessage } from "@/types/openclaw";

interface MessageActionsProps {
  message: OpenClawMessage | null;
  isPinned: boolean;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onOpenThread: (messageId: string) => void;
  onClose: () => void;
}

export function MessageActions({ message, isPinned, onPin, onUnpin, onOpenThread, onClose }: MessageActionsProps) {
  const { theme } = useThemeStore();
  const [copied, setCopied] = useState(false);

  if (!message) return null;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 1000);
  };

  const actions = [
    {
      icon: <MessageSquare size={18} color={theme.primary} />,
      label: "Reply in Thread",
      onPress: () => { onOpenThread(message.id); onClose(); },
    },
    {
      icon: <Pin size={18} color={theme.warning} />,
      label: isPinned ? "Unpin Message" : "Pin Message",
      onPress: () => { isPinned ? onUnpin(message.id) : onPin(message.id); onClose(); },
    },
    {
      icon: copied ? <Copy size={18} color={theme.success} /> : <Copy size={18} color={theme.textSecondary} />,
      label: copied ? "Copied!" : "Copy Text",
      onPress: handleCopy,
    },
  ];

  return (
    <Modal visible transparent animationType="fade">
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 8,
            paddingBottom: 32,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingVertical: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>

          {/* Preview */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ fontSize: 13, color: theme.textSecondary }} numberOfLines={2}>
              {message.content}
            </Text>
          </View>

          {/* Actions */}
          <View style={{ paddingTop: 4 }}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={action.onPress}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                }}
                activeOpacity={0.6}
              >
                {action.icon}
                <Text style={{ fontSize: 16, color: theme.text }}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
