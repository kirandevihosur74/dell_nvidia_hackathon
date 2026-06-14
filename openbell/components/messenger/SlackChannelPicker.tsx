import { View, Text, TouchableOpacity, Modal, FlatList, ActivityIndicator, Switch } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { X, Hash, Lock, Check, Link2, Users } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSlackStore } from "@/stores/slackStore";
import * as slackService from "@/services/messenger/slackService";
import type { SlackChannel } from "@/types/slack";

const SLACK_BRAND = "#E01E5A";

interface Props {
  visible: boolean;
  teamId: string | null;
  onClose: () => void;
}

export function SlackChannelPicker({ visible, teamId, onClose }: Props) {
  const { theme } = useThemeStore();
  const availableChannels = useSlackStore((s) => s.availableChannels);
  const isLoading = useSlackStore((s) => s.isLoadingChannels);
  const channelCursor = useSlackStore((s) => s.channelCursor);
  const isBridged = useSlackStore((s) => s.isBridged);
  const workspace = useSlackStore((s) => s.getWorkspaceById(teamId || ""));

  // Bridge options
  const [syncReactions, setSyncReactions] = useState(true);
  const [syncThreads, setSyncThreads] = useState(true);
  const [syncFiles, setSyncFiles] = useState(true);
  const [bridgingChannelId, setBridgingChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && teamId) {
      slackService.fetchSlackChannels(teamId);
    }
  }, [visible, teamId]);

  const handleLoadMore = useCallback(() => {
    if (teamId && channelCursor && !isLoading) {
      slackService.fetchSlackChannels(teamId, true);
    }
  }, [teamId, channelCursor, isLoading]);

  const handleBridge = useCallback(async (channel: SlackChannel) => {
    if (!teamId || isBridged(channel.id)) return;
    setBridgingChannelId(channel.id);
    try {
      await slackService.bridgeChannel(channel.id, teamId, {
        syncDirection: "bidirectional",
        syncReactions,
        syncThreads,
        syncFiles,
      });
    } finally {
      setBridgingChannelId(null);
    }
  }, [teamId, isBridged, syncReactions, syncThreads, syncFiles]);

  const renderChannel = ({ item }: { item: SlackChannel }) => {
    const alreadyBridged = isBridged(item.id);
    const isBridging = bridgingChannelId === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleBridge(item)}
        disabled={alreadyBridged || isBridging}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 10,
          opacity: alreadyBridged ? 0.5 : 1,
        }}
      >
        {item.isPrivate ? (
          <Lock size={16} color={theme.textTertiary} />
        ) : (
          <Hash size={16} color={theme.textTertiary} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: theme.text }}>
            {item.name}
          </Text>
          {item.purpose && (
            <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }} numberOfLines={1}>
              {item.purpose}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Users size={12} color={theme.textTertiary} />
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>{item.memberCount}</Text>
        </View>

        {alreadyBridged ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: theme.success + "14" }}>
            <Check size={12} color={theme.success} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.success }}>Bridged</Text>
          </View>
        ) : isBridging ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.primary + "14" }}>
            <Link2 size={14} color={theme.primary} />
          </View>
        )}
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
          <View>
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Bridge Channels</Text>
            {workspace && (
              <Text style={{ fontSize: 13, color: theme.textTertiary }}>{workspace.name}</Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sync options */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Sync Options
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: theme.text }}>Reactions</Text>
            <Switch value={syncReactions} onValueChange={setSyncReactions} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: theme.text }}>Threads</Text>
            <Switch value={syncThreads} onValueChange={setSyncThreads} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: theme.text }}>Files</Text>
            <Switch value={syncFiles} onValueChange={setSyncFiles} />
          </View>
        </View>

        {/* Channel list */}
        {isLoading && availableChannels.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12 }}>Loading channels...</Text>
          </View>
        ) : (
          <FlatList
            data={availableChannels}
            renderItem={renderChannel}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isLoading ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={{ padding: 48, alignItems: "center" }}>
                <Hash size={48} color={theme.textTertiary} />
                <Text style={{ fontSize: 16, fontWeight: "600", color: theme.textSecondary, marginTop: 16 }}>
                  No Channels Found
                </Text>
                <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                  The bot needs to be invited to channels to see them
                </Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}
