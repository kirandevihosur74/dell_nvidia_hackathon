import { View, Text, ScrollView, Platform } from "react-native";
import { FileCode } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, DiffData, DiffLine } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === "add"
      ? "rgba(63,185,80,0.15)"
      : line.type === "remove"
      ? "rgba(248,81,73,0.15)"
      : "transparent";

  const textColor =
    line.type === "add"
      ? "#3FB950"
      : line.type === "remove"
      ? "#F85149"
      : "#C9D1D9";

  const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

  return (
    <View style={{ flexDirection: "row", backgroundColor: bgColor, paddingHorizontal: 8 }}>
      {line.lineNumber != null && (
        <Text
          style={{
            width: 36,
            fontSize: 11,
            color: "#484F58",
            textAlign: "right",
            paddingRight: 8,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          }}
        >
          {line.lineNumber}
        </Text>
      )}
      <Text
        style={{
          fontSize: 12,
          color: textColor,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          lineHeight: 20,
        }}
      >
        {prefix} {line.content}
      </Text>
    </View>
  );
}

export function DiffCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as DiffData;

  // Build lines from hunks if available, otherwise from additions/deletions
  const lines: DiffLine[] = data.hunks
    ? data.hunks.flatMap((h) => h.lines)
    : [
        ...data.deletions.map(
          (content, i): DiffLine => ({ type: "remove", content, lineNumber: i + 1 })
        ),
        ...data.additions.map(
          (content, i): DiffLine => ({ type: "add", content, lineNumber: i + 1 })
        ),
      ];

  const addCount = lines.filter((l) => l.type === "add").length;
  const removeCount = lines.filter((l) => l.type === "remove").length;

  return (
    <View
      style={{
        backgroundColor: "#0D1117",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#30363D",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: "#161B22",
          borderBottomWidth: 1,
          borderBottomColor: "#30363D",
          gap: 8,
        }}
      >
        <FileCode size={13} color="#8B949E" />
        <Text
          style={{
            fontSize: 12,
            color: "#C9D1D9",
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {data.filename}
        </Text>
        <Text style={{ fontSize: 11, color: "#3FB950" }}>+{addCount}</Text>
        <Text style={{ fontSize: 11, color: "#F85149" }}>-{removeCount}</Text>
      </View>

      {/* Diff content */}
      <ScrollView style={{ maxHeight: 300 }}>
        {lines.map((line, index) => (
          <DiffLineRow key={index} line={line} />
        ))}
      </ScrollView>
    </View>
  );
}
