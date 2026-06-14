import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, Alert } from "react-native";
import { useState } from "react";
import { Hash, Plus, X, Trash2, Edit3 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawChannel } from "@/types/openclaw";

interface ChannelListProps {
  visible: boolean;
  channels: OpenClawChannel[];
  activeChannelId: string | null;
  onSelect: (channelId: string | null) => void;
  onCreate: (name: string, description?: string) => void;
  onDelete: (channelId: string) => void;
  onClose: () => void;
}

export function ChannelList({
  visible,
  channels,
  activeChannelId,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: ChannelListProps) {
  const { theme } = useThemeStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newDescription.trim() || undefined);
    setNewName("");
    setNewDescription("");
    setShowCreate(false);
  };

  const handleDelete = (channel: OpenClawChannel) => {
    Alert.alert("Delete Channel", `Delete #${channel.name}? Messages will be lost.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(channel.id) },
    ]);
  };

  const renderChannel = ({ item }: { item: OpenClawChannel }) => {
    const isActive = item.id === activeChannelId;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={() => {
          onSelect(item.id);
          onClose();
        }}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: isActive ? theme.primary + "10" : "transparent",
          gap: 10,
        }}
      >
        <Hash size={18} color={isActive ? theme.primary : hasUnread ? theme.text : theme.textTertiary} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: hasUnread || isActive ? "600" : "400",
              color: isActive ? theme.primary : hasUnread ? theme.text : theme.textSecondary,
            }}
          >
            {item.name}
          </Text>
          {item.lastMessage && (
            <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
        </View>
        {hasUnread && (
          <View
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: theme.primary,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#FFFFFF" }}>
              {item.unreadCount > 99 ? "99+" : item.unreadCount}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
          <Trash2 size={14} color={theme.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Channels</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* General channel (always first) */}
        {!showCreate && (() => {
          const generalChannel = channels.find((c) => c.name === "general");
          const generalId = generalChannel?.id ?? null;
          const isActive = activeChannelId === generalId || (!activeChannelId && !generalId);
          return (
            <TouchableOpacity
              onPress={() => { onSelect(generalId); onClose(); }}
              activeOpacity={0.6}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: isActive ? theme.primary + "10" : "transparent",
                gap: 10,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <Hash size={18} color={isActive ? theme.primary : theme.textSecondary} />
              <Text style={{
                fontSize: 15,
                fontWeight: isActive ? "600" : "400",
                color: isActive ? theme.primary : theme.textSecondary,
              }}>
                general
              </Text>
            </TouchableOpacity>
          );
        })()}

        {showCreate ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>New Channel</Text>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>NAME</Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12 }}>
                <Hash size={16} color={theme.textTertiary} />
                <TextInput
                  value={newName}
                  onChangeText={(t) => setNewName(t.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))}
                  placeholder="deployments"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: theme.text }}
                  autoFocus
                />
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>DESCRIPTION (optional)</Text>
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="What's this channel about?"
                placeholderTextColor={theme.textTertiary}
                style={{ backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 12, fontSize: 15, color: theme.text }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => { setShowCreate(false); setNewName(""); setNewDescription(""); }}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={!newName.trim()}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: newName.trim() ? theme.primary : theme.border }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={channels.filter((c) => c.name !== "general")}
              renderItem={renderChannel}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                <View style={{ padding: 48, alignItems: "center" }}>
                  <Hash size={48} color={theme.textTertiary} />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary, marginTop: 16 }}>
                    No Channels
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                    Create a channel to organize your conversations
                  </Text>
                </View>
              }
            />
            <View style={{ position: "absolute", bottom: 32, left: 16, right: 16 }}>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                  gap: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>New Channel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
