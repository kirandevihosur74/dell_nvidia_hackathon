import { View, Text, TouchableOpacity, Modal, Alert } from "react-native";
import {
  MessageSquare,
  SmilePlus,
  Pin,
  PinOff,
  Copy,
  Pencil,
  Trash2,
  X,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useThemeStore } from "@/stores/themeStore";
import { useMessengerStore } from "@/stores/messengerStore";
import { ReactionPicker } from "./ReactionPicker";
import { useState } from "react";
import type { MessengerMessage } from "@/types/messenger";

interface Props {
  message: MessengerMessage | null;
  onReact: (messageId: string, emoji: string) => void;
  onThread: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
  onEdit: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀"];

export function MessengerMessageActions({
  message,
  onReact,
  onThread,
  onPin,
  onUnpin,
  onEdit,
  onDelete,
  onClose,
}: Props) {
  const { theme } = useThemeStore();
  const currentUserId = useMessengerStore((s) => s.currentUserId);
  const [showFullPicker, setShowFullPicker] = useState(false);

  if (!message) return null;

  const isMyMessage = message.userId === currentUserId;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert("Delete Message", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(message.id);
          onClose();
        },
      },
    ]);
  };

  type ActionItem = {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  };

  const actions: ActionItem[] = [
    {
      icon: <MessageSquare size={18} color={theme.text} />,
      label: "Reply in Thread",
      onPress: () => { onThread(message.id); onClose(); },
    },
    {
      icon: <SmilePlus size={18} color={theme.text} />,
      label: "Add Reaction",
      onPress: () => setShowFullPicker(true),
    },
    {
      icon: <Copy size={18} color={theme.text} />,
      label: "Copy Text",
      onPress: handleCopy,
    },
    message.isPinned
      ? {
          icon: <PinOff size={18} color={theme.text} />,
          label: "Unpin Message",
          onPress: () => { onUnpin(message.id); onClose(); },
        }
      : {
          icon: <Pin size={18} color={theme.text} />,
          label: "Pin Message",
          onPress: () => { onPin(message.id); onClose(); },
        },
  ];

  if (isMyMessage) {
    actions.push({
      icon: <Pencil size={18} color={theme.text} />,
      label: "Edit Message",
      onPress: () => { onEdit(message.id); onClose(); },
    });
    actions.push({
      icon: <Trash2 size={18} color={theme.error} />,
      label: "Delete Message",
      onPress: handleDelete,
      destructive: true,
    });
  }

  return (
    <Modal visible={!!message} animationType="fade" transparent>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={onClose}>
        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 }}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>

          {/* Quick reactions */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => { onReact(message.id, emoji); onClose(); }}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.card, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action list */}
          <View style={{ paddingVertical: 8 }}>
            {actions.map((action, i) => (
              <TouchableOpacity
                key={i}
                onPress={action.onPress}
                activeOpacity={0.6}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}
              >
                {action.icon}
                <Text style={{ fontSize: 16, color: action.destructive ? theme.error : theme.text }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>

      <ReactionPicker
        visible={showFullPicker}
        onSelect={(emoji) => { onReact(message.id, emoji); onClose(); }}
        onClose={() => setShowFullPicker(false)}
      />
    </Modal>
  );
}
