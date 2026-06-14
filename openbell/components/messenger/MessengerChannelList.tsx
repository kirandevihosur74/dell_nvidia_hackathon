import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, Alert, SectionList } from "react-native";
import { useState, useMemo } from "react";
import { Hash, Lock, MessageCircle, Users, Plus, X, Trash2, Bot } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { PresenceDot } from "./PresenceDot";
import { useMessengerStore } from "@/stores/messengerStore";
import type { MessengerChannel, MessengerChannelType } from "@/types/messenger";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (channelId: string) => void;
  onCreate: (name: string, type: MessengerChannelType, description?: string) => void;
  onDelete: (channelId: string) => void;
  onNewDM?: () => void;
}

function ChannelIcon({ type, size, color }: { type: MessengerChannelType; size: number; color: string }) {
  switch (type) {
    case "private": return <Lock size={size} color={color} />;
    case "dm": return <MessageCircle size={size} color={color} />;
    case "group_dm": return <Users size={size} color={color} />;
    case "slack_bridge": return <Hash size={size} color={color} />;
    default: return <Hash size={size} color={color} />;
  }
}

export function MessengerChannelList({ visible, onClose, onSelect, onCreate, onDelete, onNewDM }: Props) {
  const { theme } = useThemeStore();
  const channels = useMessengerStore((s) => s.channels);
  const activeChannelId = useMessengerStore((s) => s.activeChannelId);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"public" | "private">("public");

  const sections = useMemo(() => {
    const channelsList = channels.filter((c) => c.type === "public" || c.type === "private" || c.type === "slack_bridge");
    const dmList = channels.filter((c) => c.type === "dm" || c.type === "group_dm");
    return [
      { title: "Channels", data: channelsList },
      { title: "Direct Messages", data: dmList },
    ];
  }, [channels]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newType, newDescription.trim() || undefined);
    setNewName("");
    setNewDescription("");
    setShowCreate(false);
  };

  const handleDelete = (channel: MessengerChannel) => {
    Alert.alert("Leave Channel", `Leave #${channel.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => onDelete(channel.id) },
    ]);
  };

  const renderChannel = ({ item }: { item: MessengerChannel }) => {
    const isActive = item.id === activeChannelId;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={() => { onSelect(item.id); onClose(); }}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 11,
          backgroundColor: isActive ? theme.primary + "10" : "transparent",
          gap: 10,
        }}
      >
        <ChannelIcon
          type={item.type}
          size={18}
          color={isActive ? theme.primary : hasUnread ? theme.text : theme.textTertiary}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: hasUnread || isActive ? "600" : "400",
                color: isActive ? theme.primary : hasUnread ? theme.text : theme.textSecondary,
              }}
              numberOfLines={1}
            >
              {item.type === "dm" || item.type === "group_dm" ? item.name : `#${item.name}`}
            </Text>
            {item.type === "slack_bridge" && (
              <View style={{ backgroundColor: "#E01E5A14", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                <Text style={{ fontSize: 9, fontWeight: "600", color: "#E01E5A" }}>SLACK</Text>
              </View>
            )}
          </View>
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
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, backgroundColor: theme.background }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {section.title}
      </Text>
      {section.title === "Direct Messages" ? (
        <TouchableOpacity onPress={onNewDM} hitSlop={8}>
          <Plus size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={8}>
          <Plus size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Messenger</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {showCreate ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text }}>New Channel</Text>

            {/* Type selector */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["public", "private"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setNewType(t)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: newType === t ? theme.primary + "14" : theme.card,
                    borderWidth: 1,
                    borderColor: newType === t ? theme.primary : theme.border,
                  }}
                >
                  {t === "public" ? <Hash size={14} color={newType === t ? theme.primary : theme.textTertiary} /> : <Lock size={14} color={newType === t ? theme.primary : theme.textTertiary} />}
                  <Text style={{ fontSize: 14, fontWeight: "500", color: newType === t ? theme.primary : theme.textSecondary, textTransform: "capitalize" }}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Name */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary }}>NAME</Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12 }}>
                <Hash size={16} color={theme.textTertiary} />
                <TextInput
                  value={newName}
                  onChangeText={(t) => setNewName(t.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))}
                  placeholder="engineering"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: theme.text }}
                  autoFocus
                />
              </View>
            </View>

            {/* Description */}
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

            {/* Buttons */}
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
          <SectionList
            sections={sections}
            renderItem={renderChannel}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </Modal>
  );
}
