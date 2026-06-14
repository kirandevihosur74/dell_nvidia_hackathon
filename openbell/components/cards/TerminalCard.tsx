import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useState } from "react";
import { Terminal, Copy, Check, ChevronDown, ChevronUp } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, TerminalData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

const MAX_LINES = 15;

export function TerminalCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as TerminalData;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = data.output.split("\n");
  const isLong = lines.length > MAX_LINES;
  const displayOutput = expanded || !isLong ? data.output : lines.slice(0, MAX_LINES).join("\n") + "\n...";

  const exitColor = data.exitCode === 0 ? "#3FB950" : data.exitCode != null ? "#F85149" : theme.textTertiary;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(data.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      {/* Title bar */}
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
        <Terminal size={13} color="#8B949E" />
        {data.command && (
          <Text
            style={{
              fontSize: 12,
              color: "#C9D1D9",
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              flex: 1,
            }}
            numberOfLines={1}
          >
            $ {data.command}
          </Text>
        )}
        {data.cwd && (
          <Text style={{ fontSize: 10, color: "#484F58" }} numberOfLines={1}>
            {data.cwd}
          </Text>
        )}
        <TouchableOpacity onPress={handleCopy} hitSlop={8}>
          {copied ? <Check size={14} color="#3FB950" /> : <Copy size={14} color="#8B949E" />}
        </TouchableOpacity>
      </View>

      {/* Output */}
      <ScrollView horizontal={false} style={{ maxHeight: expanded ? 400 : 240 }}>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 18,
            color: "#C9D1D9",
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            padding: 12,
          }}
          selectable
        >
          {displayOutput}
        </Text>
      </ScrollView>

      {/* Footer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: "#161B22",
          borderTopWidth: 1,
          borderTopColor: "#30363D",
        }}
      >
        {data.exitCode != null && (
          <Text style={{ fontSize: 10, color: exitColor, fontWeight: "500" }}>
            exit {data.exitCode}
          </Text>
        )}
        {isLong && (
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            {expanded ? <ChevronUp size={12} color="#8B949E" /> : <ChevronDown size={12} color="#8B949E" />}
            <Text style={{ fontSize: 10, color: "#8B949E" }}>
              {expanded ? "Collapse" : `${lines.length - MAX_LINES} more lines`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
