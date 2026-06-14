import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Cloud, Server, ChevronRight, RefreshCw, LogIn } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import {
  fetchMyGateways,
  relayGatewayToConfig,
  isAuthenticated,
  type RelayGateway,
} from "@/services/gateway/cloudRelayService";
import type { GatewayConfig } from "@/types/gateway";

interface MyGatewaysProps {
  onConnect: (config: GatewayConfig) => void;
  onSignIn?: () => void;
}

export function MyGateways({ onConnect, onSignIn }: MyGatewaysProps) {
  const { theme } = useThemeStore();
  const [gateways, setGateways] = useState<RelayGateway[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const loadGateways = useCallback(async () => {
    if (!isAuthenticated()) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setIsLoading(true);
    setError(null);

    const result = await fetchMyGateways();
    if (result.success) {
      setGateways(result.gateways);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadGateways();
  }, [loadGateways]);

  const handleConnect = useCallback(
    (relay: RelayGateway) => {
      const config = relayGatewayToConfig(relay);
      onConnect(config);
    },
    [onConnect],
  );

  // Not signed in — show prompt
  if (!authed) {
    if (!onSignIn) return null;
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Cloud size={14} color={theme.textTertiary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, letterSpacing: 0.5 }}>
            YOUR GATEWAYS
          </Text>
        </View>
        <TouchableOpacity
          onPress={onSignIn}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <LogIn size={20} color={theme.textTertiary} />
          <Text style={{ fontSize: 14, color: theme.textTertiary }}>
            Sign in to see your Gateways
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading
  if (isLoading && gateways.length === 0) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Cloud size={14} color={theme.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary, letterSpacing: 0.5 }}>
            YOUR GATEWAYS
          </Text>
        </View>
        <View style={{ padding: 16, alignItems: "center" }}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      </View>
    );
  }

  // No gateways registered or error fetching — hide silently
  if (gateways.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      {/* Section Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Cloud size={14} color={theme.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary, letterSpacing: 0.5 }}>
            YOUR GATEWAYS
          </Text>
        </View>
        <TouchableOpacity onPress={loadGateways} hitSlop={8}>
          <RefreshCw size={14} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={{ fontSize: 13, color: theme.error }}>{error}</Text>
      )}

      {/* Gateway List */}
      {gateways.map((gw) => (
        <TouchableOpacity
          key={gw.gatewayId}
          onPress={() => handleConnect(gw)}
          disabled={gw.status === "offline"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: gw.status === "online" ? theme.primary + "30" : theme.border,
            opacity: gw.status === "offline" ? 0.6 : 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: gw.status === "online" ? theme.primary + "15" : theme.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Server size={20} color={gw.status === "online" ? theme.primary : theme.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{gw.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: gw.status === "online" ? "#34C759" : "#8E8E93",
                }}
              />
              <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                {gw.status === "online" ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
          {gw.status === "online" && <ChevronRight size={16} color={theme.textTertiary} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}
