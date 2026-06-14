import { View, Text, ScrollView } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { ToolResultCard, TableData } from "@/types/cards";

interface Props {
  card: ToolResultCard;
}

export function TableCard({ card }: Props) {
  const { theme } = useThemeStore();
  const data = card.data as unknown as TableData;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: "hidden",
      }}
    >
      {data.caption && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>{data.caption}</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Header row */}
          <View style={{ flexDirection: "row", backgroundColor: theme.background }}>
            {data.headers.map((header, i) => (
              <View
                key={i}
                style={{
                  minWidth: 100,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRightWidth: i < data.headers.length - 1 ? 0.5 : 0,
                  borderRightColor: theme.border,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text }}>
                  {header}
                </Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {data.rows.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={{
                flexDirection: "row",
                backgroundColor: rowIdx % 2 === 0 ? theme.card : theme.background,
              }}
            >
              {row.map((cell, colIdx) => (
                <View
                  key={colIdx}
                  style={{
                    minWidth: 100,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRightWidth: colIdx < row.length - 1 ? 0.5 : 0,
                    borderRightColor: theme.border,
                    borderBottomWidth: rowIdx < data.rows.length - 1 ? 0.5 : 0,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>{cell}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
