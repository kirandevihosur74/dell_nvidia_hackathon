import { View, Text } from "react-native";
import Svg, { Path, Line, Circle, G, Text as SvgText } from "react-native-svg";
import { useThemeStore } from "@/stores/themeStore";

interface DataPoint {
  x: number | string;
  y: number;
}

interface LineChartProps {
  data: DataPoint[];
  width: number;
  height: number;
  title?: string;
  color?: string;
  showArea?: boolean;
}

export function LineChart({ data, width, height, title, color, showArea }: LineChartProps) {
  const { theme } = useThemeStore();
  const strokeColor = color || theme.primary;

  if (!data || data.length < 2) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: theme.textTertiary }}>Not enough data</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 16, bottom: 28, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const yValues = data.map((d) => d.y);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - ((v - yMin) / yRange) * chartH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(d.y).toFixed(1)}`).join(" ");

  const areaPath = showArea
    ? `${linePath} L${xScale(data.length - 1).toFixed(1)},${(padding.top + chartH).toFixed(1)} L${padding.left},${(padding.top + chartH).toFixed(1)} Z`
    : "";

  // Y-axis labels (3 ticks)
  const yTicks = [yMin, yMin + yRange / 2, yMax];

  return (
    <View>
      {title && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text, marginBottom: 4 }}>
          {title}
        </Text>
      )}
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <Line
            key={i}
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            stroke={theme.border}
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <SvgText
            key={`yl-${i}`}
            x={padding.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
            fontSize={9}
            fill={theme.textTertiary}
          >
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(v % 1 ? 1 : 0)}
          </SvgText>
        ))}

        {/* Area fill */}
        {showArea && <Path d={areaPath} fill={strokeColor} opacity={0.1} />}

        {/* Line */}
        <Path d={linePath} stroke={strokeColor} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points */}
        {data.map((d, i) => (
          <Circle key={i} cx={xScale(i)} cy={yScale(d.y)} r={2.5} fill={strokeColor} />
        ))}

        {/* X-axis labels (first, middle, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <SvgText
            key={`xl-${i}`}
            x={xScale(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize={9}
            fill={theme.textTertiary}
          >
            {String(data[i].x)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
