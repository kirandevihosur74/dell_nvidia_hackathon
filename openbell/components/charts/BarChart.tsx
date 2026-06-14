import { View, Text } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { useThemeStore } from "@/stores/themeStore";

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarItem[];
  width: number;
  height: number;
  title?: string;
  horizontal?: boolean;
}

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export function BarChart({ data, width, height, title, horizontal }: BarChartProps) {
  const { theme } = useThemeStore();

  if (!data || data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>No data</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value)) || 1;
  const padding = { top: 16, right: 16, bottom: 32, left: horizontal ? 80 : 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (horizontal) {
    const barH = Math.min(24, (chartH - (data.length - 1) * 4) / data.length);
    const totalH = data.length * barH + (data.length - 1) * 4;
    const startY = padding.top + (chartH - totalH) / 2;

    return (
      <View>
        {title && <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text, marginBottom: 4 }}>{title}</Text>}
        <Svg width={width} height={height}>
          {data.map((d, i) => {
            const barW = (d.value / maxVal) * chartW;
            const y = startY + i * (barH + 4);
            const fill = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <View key={i}>
                <SvgText x={padding.left - 6} y={y + barH / 2 + 4} textAnchor="end" fontSize={10} fill={theme.textSecondary}>
                  {d.label}
                </SvgText>
                <Rect x={padding.left} y={y} width={barW} height={barH} rx={4} fill={fill} />
                <SvgText x={padding.left + barW + 6} y={y + barH / 2 + 4} fontSize={10} fill={theme.text} fontWeight="500">
                  {d.value.toLocaleString()}
                </SvgText>
              </View>
            );
          })}
        </Svg>
      </View>
    );
  }

  // Vertical bars
  const barW = Math.min(32, (chartW - (data.length - 1) * 4) / data.length);
  const totalW = data.length * barW + (data.length - 1) * 4;
  const startX = padding.left + (chartW - totalW) / 2;

  return (
    <View>
      {title && <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text, marginBottom: 4 }}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke={theme.border} strokeWidth={0.5} />

        {data.map((d, i) => {
          const barH = (d.value / maxVal) * chartH;
          const x = startX + i * (barW + 4);
          const y = padding.top + chartH - barH;
          const fill = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <View key={i}>
              <Rect x={x} y={y} width={barW} height={barH} rx={3} fill={fill} />
              <SvgText x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={9} fill={theme.textTertiary}>
                {d.label.slice(0, 6)}
              </SvgText>
            </View>
          );
        })}
      </Svg>
    </View>
  );
}
