import { View, Text, TouchableOpacity } from "react-native";
import { Wifi, WifiOff, Loader, ShieldAlert, Link, RefreshCw } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ConnectionStatus } from "@/types/gateway";

interface GatewayStatusBarProps {
  status: ConnectionStatus;
  gatewayName?: string;
  error?: string | null;
  onPress?: () => void;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; colorKey: string; icon: typeof Wifi }> = {
  connected: { label: "Connected", colorKey: "success", icon: Wifi },
  connecting: { label: "Connecting...", colorKey: "warning", icon: Loader },
  disconnected: { label: "Disconnected", colorKey: "textTertiary", icon: WifiOff },
  pairing: { label: "Pairing Required", colorKey: "info", icon: Link },
  error: { label: "Connection Error", colorKey: "error", icon: ShieldAlert },
};

function friendlyError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes("origin not allowed") || lower.includes("control_ui_origin")) {
    return "Gateway rejected connection origin. Start gateway with --bind lan.";
  }
  if (lower.includes("device identity")) {
    return "Device identity required. Ensure gateway allows LAN connections.";
  }
  if (lower.includes("token mismatch") || lower.includes("password mismatch")) {
    return "Token/password is incorrect. Check your credentials.";
  }
  if (lower.includes("password missing")) {
    return "Gateway requires a password. Add it in gateway settings.";
  }
  if (lower.includes("pairing required") || lower.includes("not-paired") || lower.includes("not_paired")) {
    return "New device — approve it on your gateway: openclaw devices approve";
  }
  if (lower.includes("websocket error") || lower.includes("failed to create")) {
    return "Cannot reach gateway. Check host, port, and network.";
  }
  if (lower.includes("connection closed")) {
    return "Connection lost. Tap retry to reconnect.";
  }
  return error;
}

export function GatewayStatusBar({ status, gatewayName, error, onPress, onRetry }: GatewayStatusBarProps) {
  const { theme } = useThemeStore();
  const config = STATUS_CONFIG[status];
  const color = theme[config.colorKey as keyof typeof theme] as string;
  const Icon = config.icon;
  const displayError = error ? friendlyError(error) : null;
  const showRetry = (status === "error" || status === "disconnected") && onRetry;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Gateway ${gatewayName || "unknown"}, status: ${config.label}. Tap to manage gateways.`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Icon size={14} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>
          {gatewayName ? `${gatewayName} — ` : ""}
          {config.label}
        </Text>
        {displayError && (status === "error" || status === "pairing") && (
          <Text style={{ fontSize: 11, color: status === "pairing" ? theme.info : theme.error }} numberOfLines={2}>
            {displayError}
          </Text>
        )}
      </View>
      {showRetry && (
        <TouchableOpacity
          onPress={onRetry}
          hitSlop={8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.primary,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
            gap: 4,
          }}
        >
          <RefreshCw size={12} color="#FFFFFF" />
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#FFFFFF" }}>Retry</Text>
        </TouchableOpacity>
      )}
      <Text style={{ fontSize: 11, color: theme.textTertiary }}>Tap to manage</Text>
    </TouchableOpacity>
  );
}
