import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { ChevronRight, CheckCircle2, AlertCircle, Link2, Trash2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSlackStore } from "@/stores/slackStore";
import { SlackConnectModal } from "./SlackConnectModal";
import { SlackChannelPicker } from "./SlackChannelPicker";
import * as slackService from "@/services/messenger/slackService";
import type { SlackBridge } from "@/types/slack";

const SLACK_BRAND = "#E01E5A";

/**
 * Standalone settings section for Slack integration.
 * Drop this into the Settings screen as a section.
 */
export function SlackSettingsSection() {
  const { theme } = useThemeStore();
  const workspaces = useSlackStore((s) => s.workspaces);
  const bridges = useSlackStore((s) => s.bridges);
  const [showConnect, setShowConnect] = useState(false);
  const [pickerTeamId, setPickerTeamId] = useState<string | null>(null);

  const handleUnbridge = (bridge: SlackBridge) => {
    Alert.alert(
      "Remove Bridge",
      `Unlink #${bridge.slackChannelName}? Messages won't be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => slackService.unbridgeChannel(bridge.messengerChannelId),
        },
      ]
    );
  };

  return (
    <>
      {/* Workspaces row */}
      <TouchableOpacity onPress={() => setShowConnect(true)}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 15, color: theme.text }}>Slack Workspaces</Text>
            <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>
              {workspaces.length === 0
                ? "No workspaces connected"
                : `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""} connected`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {workspaces.length > 0 && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: workspaces.some((w) => w.status === "connected")
                    ? theme.success
                    : theme.textTertiary,
                }}
              />
            )}
            <ChevronRight size={14} color={theme.textTertiary} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Active bridges */}
      {bridges.length > 0 && (
        <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Bridged Channels
          </Text>
          {bridges.map((bridge) => (
            <View
              key={bridge.messengerChannelId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Link2 size={14} color={SLACK_BRAND} />
                <Text style={{ fontSize: 14, color: theme.text }}>
                  #{bridge.slackChannelName}
                </Text>
                <View style={{ backgroundColor: SLACK_BRAND + "14", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: "600", color: SLACK_BRAND }}>
                    {bridge.syncDirection === "bidirectional" ? "↔" : bridge.syncDirection === "slack_to_messenger" ? "→" : "←"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleUnbridge(bridge)} hitSlop={8}>
                <Trash2 size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Modals */}
      <SlackConnectModal
        visible={showConnect}
        onClose={() => setShowConnect(false)}
        onOpenChannelPicker={(teamId) => {
          setShowConnect(false);
          setPickerTeamId(teamId);
        }}
      />

      <SlackChannelPicker
        visible={!!pickerTeamId}
        teamId={pickerTeamId}
        onClose={() => setPickerTeamId(null)}
      />
    </>
  );
}
