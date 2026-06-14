import { View, Text, TouchableOpacity, Modal, FlatList, Alert, ActivityIndicator } from "react-native";
import { X, Plus, Trash2, RefreshCw, Link2, CheckCircle2, AlertCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSlackStore } from "@/stores/slackStore";
import * as slackService from "@/services/messenger/slackService";
import type { SlackWorkspace } from "@/types/slack";

const SLACK_BRAND = "#E01E5A";

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenChannelPicker: (teamId: string) => void;
}

export function SlackConnectModal({ visible, onClose, onOpenChannelPicker }: Props) {
  const { theme } = useThemeStore();
  const workspaces = useSlackStore((s) => s.workspaces);
  const bridges = useSlackStore((s) => s.bridges);
  const isOAuthInProgress = useSlackStore((s) => s.isOAuthInProgress);
  const oauthError = useSlackStore((s) => s.oauthError);

  const handleConnect = async () => {
    const result = await slackService.connectWorkspace();
    if (!result.success && result.error) {
      Alert.alert("Connection Failed", result.error);
    }
  };

  const handleDisconnect = (workspace: SlackWorkspace) => {
    const bridgeCount = bridges.filter((b) => b.slackTeamId === workspace.id).length;
    Alert.alert(
      "Disconnect Workspace",
      `Disconnect ${workspace.name}?${bridgeCount > 0 ? ` This will also remove ${bridgeCount} bridged channel${bridgeCount > 1 ? "s" : ""}.` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => slackService.disconnectWorkspace(workspace.id),
        },
      ]
    );
  };

  const renderWorkspace = ({ item }: { item: SlackWorkspace }) => {
    const workspaceBridges = bridges.filter((b) => b.slackTeamId === item.id);
    const isConnected = item.status === "connected";
    const isError = item.status === "error";

    return (
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Workspace icon */}
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: SLACK_BRAND + "14",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: SLACK_BRAND }}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
                {item.name}
              </Text>
              {isConnected && <CheckCircle2 size={14} color={theme.success} />}
              {isError && <AlertCircle size={14} color={theme.error} />}
            </View>
            <Text style={{ fontSize: 12, color: theme.textTertiary }}>
              {item.domain}.slack.com
            </Text>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => onOpenChannelPicker(item.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: theme.primary + "14",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>Bridge</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDisconnect(item)} hitSlop={8}>
              <Trash2 size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bridge count */}
        {workspaceBridges.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 52 }}>
            <Link2 size={12} color={theme.textTertiary} />
            <Text style={{ fontSize: 12, color: theme.textTertiary }}>
              {workspaceBridges.length} bridged channel{workspaceBridges.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Slack</Text>
            <View style={{ backgroundColor: SLACK_BRAND + "14", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "600", color: SLACK_BRAND }}>
                {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {oauthError && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: theme.error + "14" }}>
            <AlertCircle size={16} color={theme.error} />
            <Text style={{ flex: 1, fontSize: 13, color: theme.error }}>{oauthError}</Text>
          </View>
        )}

        {/* Workspace list */}
        <FlatList
          data={workspaces}
          renderItem={renderWorkspace}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ padding: 48, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: SLACK_BRAND + "14",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 28 }}>💬</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, marginBottom: 4 }}>
                No Slack Workspaces
              </Text>
              <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center" }}>
                Connect a workspace to bridge Slack channels into Messenger
              </Text>
            </View>
          }
        />

        {/* Connect button */}
        <View style={{ position: "absolute", bottom: 32, left: 16, right: 16 }}>
          <TouchableOpacity
            onPress={handleConnect}
            disabled={isOAuthInProgress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isOAuthInProgress ? theme.border : SLACK_BRAND,
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
            {isOAuthInProgress ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Connecting...</Text>
              </>
            ) : (
              <>
                <Plus size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Connect Workspace</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
