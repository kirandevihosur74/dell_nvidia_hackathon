import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useThemeStore } from "@/stores/themeStore";
import { useContextStore } from "@/stores/contextStore";
import { useGatewayStore } from "@/stores/gatewayStore";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function getBarColor(ratio: number): string {
  if (ratio < 0.5) return "#10B981"; // green
  if (ratio < 0.75) return "#F59E0B"; // yellow
  if (ratio < 0.9) return "#F97316"; // orange
  return "#EF4444"; // red
}

export function ContextMeter() {
  const { theme } = useThemeStore();
  const activeSessionId = useGatewayStore((s) => s.activeSessionId);
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);
  const { usage, error, startPolling, stopPolling } = useContextStore();
  const [expanded, setExpanded] = useState(false);

  const isConnected = connectionStatus === "connected";

  useEffect(() => {
    if (isConnected && activeSessionId) {
      startPolling(activeSessionId);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isConnected, activeSessionId, startPolling, stopPolling]);

  const toggleExpand = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  // Don't render if no usage data or error (feature might not be supported)
  if (!usage || error) return null;

  const ratio = usage.contextLimit > 0 ? usage.totalTokens / usage.contextLimit : 0;
  const barColor = getBarColor(ratio);
  const percentage = Math.min(Math.round(ratio * 100), 100);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.7}
        style={{ gap: 4 }}
      >
        {/* Bar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${percentage}%`,
                height: "100%",
                borderRadius: 2,
                backgroundColor: barColor,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, fontWeight: "600", color: theme.textTertiary, minWidth: 30, textAlign: "right" }}>
            {percentage}%
          </Text>
        </View>

        {/* Compact label */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 10, color: theme.textTertiary }}>
            {formatTokens(usage.totalTokens)} / {formatTokens(usage.contextLimit)} tokens
          </Text>
          {usage.costUsd > 0 && (
            <Text style={{ fontSize: 10, color: theme.textTertiary }}>
              {formatCost(usage.costUsd)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Input tokens</Text>
            <Text style={{ fontSize: 12, color: theme.text, fontWeight: "500", fontFamily: "monospace" }}>
              {formatTokens(usage.inputTokens)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Output tokens</Text>
            <Text style={{ fontSize: 12, color: theme.text, fontWeight: "500", fontFamily: "monospace" }}>
              {formatTokens(usage.outputTokens)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>Context limit</Text>
            <Text style={{ fontSize: 12, color: theme.text, fontWeight: "500", fontFamily: "monospace" }}>
              {formatTokens(usage.contextLimit)}
            </Text>
          </View>
          {usage.costUsd > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 4 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>Estimated cost</Text>
              <Text style={{ fontSize: 12, color: theme.primary, fontWeight: "600" }}>
                {formatCost(usage.costUsd)}
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}
