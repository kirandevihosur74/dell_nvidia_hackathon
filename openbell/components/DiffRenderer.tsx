import { useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useThemeStore } from "@/stores/themeStore";

const COLLAPSE_THRESHOLD = 20;

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  lineNumber: number;
}

function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      return { type: "header" as const, content: line, lineNumber: i + 1 };
    }
    if (line.startsWith("+")) {
      return { type: "add" as const, content: line, lineNumber: i + 1 };
    }
    if (line.startsWith("-")) {
      return { type: "remove" as const, content: line, lineNumber: i + 1 };
    }
    return { type: "context" as const, content: line, lineNumber: i + 1 };
  });
}

/**
 * Detects ```diff code blocks and extracts them from message text.
 */
export function parseDiffBlocks(text: string): { diffs: string[]; cleanText: string } {
  const diffs: string[] = [];
  const regex = /```diff\n([\s\S]*?)```/g;
  const cleanText = text.replace(regex, (_, content) => {
    diffs.push(content.trimEnd());
    return "";
  }).trim();
  return { diffs, cleanText };
}

export function hasDiffBlock(text: string): boolean {
  return /```diff\n/.test(text);
}

interface DiffRendererProps {
  diff: string;
}

export function DiffRenderer({ diff }: DiffRendererProps) {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => parseDiff(diff), [diff]);
  const isLong = lines.length > COLLAPSE_THRESHOLD;
  const visibleLines = isLong && !expanded ? lines.slice(0, COLLAPSE_THRESHOLD) : lines;
  const remaining = lines.length - COLLAPSE_THRESHOLD;

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  const getLineStyle = useCallback(
    (type: DiffLine["type"]) => {
      switch (type) {
        case "add":
          return { bg: theme.success + "15", color: theme.success };
        case "remove":
          return { bg: theme.error + "12", color: theme.error };
        case "header":
          return { bg: theme.info + "10", color: theme.info };
        default:
          return { bg: "transparent", color: theme.textSecondary };
      }
    },
    [theme]
  );

  return (
    <View
      style={{
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.card,
        marginTop: 8,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: theme.border + "40",
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: "700", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Diff
        </Text>
        <Text style={{ fontSize: 10, color: theme.textTertiary }}>
          {lines.filter((l) => l.type === "add").length} additions,{" "}
          {lines.filter((l) => l.type === "remove").length} deletions
        </Text>
      </View>

      {/* Lines */}
      {visibleLines.map((line, i) => {
        const style = getLineStyle(line.type);
        return (
          <View
            key={i}
            style={{
              flexDirection: "row",
              backgroundColor: style.bg,
              minHeight: 20,
            }}
          >
            {/* Line number */}
            <View
              style={{
                width: 34,
                paddingRight: 6,
                paddingVertical: 2,
                alignItems: "flex-end",
                justifyContent: "center",
                borderRightWidth: 1,
                borderRightColor: theme.border,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  color: theme.textTertiary,
                }}
              >
                {line.lineNumber}
              </Text>
            </View>

            {/* Content */}
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                lineHeight: 18,
                color: style.color,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
              selectable
            >
              {line.content}
            </Text>
          </View>
        );
      })}

      {/* Expand/collapse */}
      {isLong && (
        <TouchableOpacity
          onPress={toggleExpand}
          style={{
            paddingVertical: 8,
            alignItems: "center",
            backgroundColor: theme.border + "30",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }}>
            {expanded ? "Show less" : `Show ${remaining} more lines`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
