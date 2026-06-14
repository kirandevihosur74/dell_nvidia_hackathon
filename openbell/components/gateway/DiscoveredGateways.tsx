import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Wifi, RefreshCw, Server, ChevronRight } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import {
  gatewayDiscovery,
  discoveredToGatewayConfig,
  type DiscoveredGateway,
} from "@/services/gateway/gatewayDiscovery";
import type { GatewayConfig } from "@/types/gateway";

interface DiscoveredGatewaysProps {
  onConnect: (config: GatewayConfig) => void;
}

export function DiscoveredGateways({ onConnect }: DiscoveredGatewaysProps) {
  const { theme } = useThemeStore();
  const [gateways, setGateways] = useState<DiscoveredGateway[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!gatewayDiscovery.available) return;

    gatewayDiscovery.start();
    const unsub = gatewayDiscovery.onUpdate(setGateways);

    return () => {
      unsub();
      gatewayDiscovery.stop();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    gatewayDiscovery.refresh();
    // Give the browser a moment to re-discover
    setTimeout(() => setIsRefreshing(false), 2000);
  }, []);

  const handleConnect = useCallback(
    (discovered: DiscoveredGateway) => {
      const config = discoveredToGatewayConfig(discovered);
      onConnect(config);
    },
    [onConnect],
  );

  // Don't render if discovery isn't available or no gateways found
  if (!gatewayDiscovery.available || gateways.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      {/* Section Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Wifi size={14} color={theme.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary, letterSpacing: 0.5 }}>
            DISCOVERED ON YOUR NETWORK
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} hitSlop={8} disabled={isRefreshing}>
          <RefreshCw
            size={14}
            color={theme.textTertiary}
            style={isRefreshing ? { opacity: 0.5 } : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* Gateway List */}
      {gateways.map((gw) => (
        <TouchableOpacity
          key={gw.id}
          onPress={() => handleConnect(gw)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: theme.primary + "30",
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.primary + "15",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Server size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>{gw.name}</Text>
            <Text style={{ fontSize: 12, color: theme.textTertiary }}>
              {gw.host}:{gw.port}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
