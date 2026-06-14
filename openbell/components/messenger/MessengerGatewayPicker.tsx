import { View, Text, TouchableOpacity, Modal, FlatList } from "react-native";
import { Server, Wifi, WifiOff, X, ChevronRight, Unplug } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { GatewayConfig, ConnectionStatus } from "@/types/gateway";

interface Props {
  visible: boolean;
  onSelect: (gateway: GatewayConfig) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

/**
 * Lightweight gateway picker for the Messenger tab.
 * Shows saved gateways and lets users connect/switch — no create/edit/delete.
 * For full management, use the GatewayPicker in the OpenClaw tab or Settings.
 */
export function MessengerGatewayPicker({ visible, onSelect, onDisconnect, onClose }: Props) {
  const { theme } = useThemeStore();
  const gateways = useGatewayStore((s) => s.gateways);
  const activeGatewayId = useGatewayStore((s) => s.activeGatewayId);
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);

  const renderGateway = ({ item }: { item: GatewayConfig }) => {
    const isActive = item.id === activeGatewayId;
    const isConnected = isActive && connectionStatus === "connected";

    return (
      <TouchableOpacity
        onPress={() => { onSelect(item); onClose(); }}
        activeOpacity={0.6}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          backgroundColor: isActive ? theme.primary + "10" : "transparent",
          borderBottomWidth: 0.5,
          borderBottomColor: theme.border,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: isActive ? theme.primary + "18" : theme.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Server size={18} color={isActive ? theme.primary : theme.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: isActive ? "600" : "400", color: isActive ? theme.primary : theme.text }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {item.host}:{item.port}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isConnected ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.success }} />
              <Text style={{ fontSize: 12, color: theme.success, fontWeight: "500" }}>Connected</Text>
            </View>
          ) : item.isPaired ? (
            <Wifi size={14} color={theme.textTertiary} />
          ) : (
            <WifiOff size={14} color={theme.textTertiary} />
          )}
          {!isConnected && <ChevronRight size={14} color={theme.textTertiary} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "55%",
            paddingBottom: 34,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <View>
              <Text style={{ fontSize: 17, fontWeight: "600", color: theme.text }}>Switch Gateway</Text>
              <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                Manage gateways in OpenClaw or Settings
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Gateway list */}
          <FlatList
            data={gateways}
            renderItem={renderGateway}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: "center" }}>
                <Server size={40} color={theme.textTertiary} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textSecondary, marginTop: 12 }}>
                  No Gateways Configured
                </Text>
                <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: "center", marginTop: 4 }}>
                  Go to the OpenClaw tab to add a gateway
                </Text>
              </View>
            }
          />

          {/* Disconnect button (only if connected) */}
          {connectionStatus === "connected" && (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity
                onPress={() => { onDisconnect(); onClose(); }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: theme.error + "10",
                  borderWidth: 1,
                  borderColor: theme.error + "30",
                }}
              >
                <Unplug size={16} color={theme.error} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.error }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
