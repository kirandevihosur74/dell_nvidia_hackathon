import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { ToolProgressCard } from "./ToolProgressCard";
import type { OpenClawToolCall } from "@/types/openclaw";

interface ToolTimelineProps {
  toolCalls: OpenClawToolCall[];
}

export function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  if (toolCalls.length === 0) return null;

  const completedCount = toolCalls.filter((tc) => tc.status === "completed").length;
  const runningCount = toolCalls.filter((tc) => tc.status === "running").length;
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;

  // Show the latest running tool prominently, collapse completed ones
  const activeTool = toolCalls.find((tc) => tc.status === "running");
  const completedTools = toolCalls.filter((tc) => tc.status !== "running");

  return (
    <View style={{ gap: 8, alignSelf: "flex-start", maxWidth: "90%" }}>
      {/* Active tool — always shown full */}
      {activeTool && <ToolProgressCard toolCall={activeTool} />}

      {/* Completed tools summary */}
      {completedTools.length > 0 && (
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 8,
          }}
        >
          {expanded ? (
            <ChevronUp size={12} color={theme.textTertiary} />
          ) : (
            <ChevronDown size={12} color={theme.textTertiary} />
          )}
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>
            {completedCount > 0 && `${completedCount} completed`}
            {errorCount > 0 && ` · ${errorCount} failed`}
            {runningCount > 0 && ` · ${runningCount} running`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Expanded completed tools */}
      {expanded && (
        <View style={{ gap: 6, paddingLeft: 8 }}>
          {completedTools.map((tc) => (
            <ToolProgressCard key={tc.id} toolCall={tc} compact />
          ))}
        </View>
      )}
    </View>
  );
}
