import { View, Text } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { useThemeStore } from "@/stores/themeStore";

interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieSlice[];
  width: number;
  height: number;
  title?: string;
}

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M${cx},${cy} L${start.x},${start.y} A${r},${r},0,${largeArc},0,${end.x},${end.y} Z`;
}

export function PieChart({ data, width, height, title }: PieChartProps) {
  const { theme } = useThemeStore();

  if (!data || data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>No data</Text>
      </View>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const cx = width / 2;
  const cy = (height - 30) / 2 + 16;
  const r = Math.min(cx, cy) - 20;

  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const midAngle = startAngle + angle / 2;
    const labelPos = polarToCartesian(cx, cy, r * 0.65, midAngle);

    return {
      ...d,
      path: arcPath(cx, cy, r, startAngle, endAngle),
      color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      percentage: Math.round((d.value / total) * 100),
      labelPos,
    };
  });

  return (
    <View>
      {title && <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text, marginBottom: 4 }}>{title}</Text>}
      <Svg width={width} height={height - 20}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} />
        ))}
        {slices
          .filter((s) => s.percentage >= 8)
          .map((s, i) => (
            <SvgText
              key={`l-${i}`}
              x={s.labelPos.x}
              y={s.labelPos.y + 3}
              textAnchor="middle"
              fontSize={10}
              fontWeight="600"
              fill="#FFFFFF"
            >
              {s.percentage}%
            </SvgText>
          ))}
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 8, marginTop: 4 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
              }}
            />
            <Text style={{ fontSize: 10, color: theme.textSecondary }}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
