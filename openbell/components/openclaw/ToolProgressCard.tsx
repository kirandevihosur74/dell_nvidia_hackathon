import { View, Text, TouchableOpacity, Platform } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useState } from "react";
import { Wrench, Check, AlertCircle, ChevronDown, ChevronUp, Loader } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { OpenClawToolCall } from "@/types/openclaw";

interface ToolProgressCardProps {
  toolCall: OpenClawToolCall;
  compact?: boolean;
}

export function ToolProgressCard({ toolCall, compact = false }: ToolProgressCardProps) {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  const isRunning = toolCall.status === "running";
  const isError = toolCall.status === "error";
  const isComplete = toolCall.status === "completed";

  const statusColor = isError ? theme.error : isComplete ? theme.success : theme.warning;
  const StatusIcon = isError ? AlertCircle : isComplete ? Check : Loader;

  if (compact) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 }}>
        <StatusIcon size={12} color={statusColor} />
        <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
          {toolCall.toolName}
        </Text>
        {isRunning && toolCall.progress != null && (
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{toolCall.progress}%</Text>
        )}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)}>
      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isRunning ? statusColor + "40" : theme.border,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 12,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: statusColor + "15",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Wrench size={14} color={statusColor} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>
              {toolCall.toolName}
            </Text>
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              {isRunning ? "Running..." : isError ? "Failed" : "Completed"}
            </Text>
          </View>

          {/* Progress bar for running tools */}
          {isRunning && toolCall.progress != null && (
            <View style={{ width: 48 }}>
              <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2 }}>
                <View
                  style={{
                    height: 4,
                    width: `${toolCall.progress}%`,
                    backgroundColor: statusColor,
                    borderRadius: 2,
                  }}
                />
              </View>
              <Text style={{ fontSize: 10, color: theme.textTertiary, textAlign: "right", marginTop: 2 }}>
                {toolCall.progress}%
              </Text>
            </View>
          )}

          <StatusIcon size={16} color={statusColor} />
          {expanded ? (
            <ChevronUp size={14} color={theme.textTertiary} />
          ) : (
            <ChevronDown size={14} color={theme.textTertiary} />
          )}
        </TouchableOpacity>

        {/* Expanded Details */}
        {expanded && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            {/* Input */}
            {toolCall.input && Object.keys(toolCall.input).length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase" }}>
                  Input
                </Text>
                <View style={{ backgroundColor: theme.background, borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
                    {JSON.stringify(toolCall.input, null, 2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Output */}
            {toolCall.output != null && (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase" }}>
                  Output
                </Text>
                <View style={{ backgroundColor: theme.background, borderRadius: 8, padding: 10 }}>
                  <Text
                    style={{ fontSize: 12, color: theme.textSecondary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
                    numberOfLines={20}
                  >
                    {typeof toolCall.output === "string"
                      ? toolCall.output
                      : JSON.stringify(toolCall.output, null, 2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Timing */}
            {toolCall.completedAt && (
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                Duration: {Math.round((new Date(toolCall.completedAt).getTime() - new Date(toolCall.startedAt).getTime()) / 1000)}s
              </Text>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
