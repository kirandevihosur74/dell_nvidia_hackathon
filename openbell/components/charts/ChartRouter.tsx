import { useCallback, useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import { LineChart } from "./LineChart";
import { BarChart } from "./BarChart";
import { PieChart } from "./PieChart";

/**
 * Detects and renders [chart:{...}] markers embedded in agent messages.
 *
 * Expected marker format:
 *   [chart:{"type":"line","title":"Usage","data":[{"x":"Mon","y":10},{"x":"Tue","y":20}]}]
 *   [chart:{"type":"bar","title":"Tasks","data":[{"label":"Done","value":5},{"label":"Open","value":3}]}]
 *   [chart:{"type":"pie","title":"Split","data":[{"label":"A","value":60},{"label":"B","value":40}]}]
 */

const CHART_REGEX = /\[chart:([\s\S]*?)\]/g;

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area";
  title?: string;
  data: unknown[];
  horizontal?: boolean;
  color?: string;
}

export function parseChartMarkers(text: string): { charts: ChartSpec[]; cleanText: string } {
  const charts: ChartSpec[] = [];
  const cleanText = text.replace(CHART_REGEX, (_, json) => {
    try {
      const spec = JSON.parse(json) as ChartSpec;
      if (spec.type && Array.isArray(spec.data) && spec.data.length > 0) {
        charts.push(spec);
      }
    } catch {
      // Malformed JSON — leave as text
    }
    return "";
  }).trim();

  return { charts, cleanText };
}

export function hasChartMarker(text: string): boolean {
  return CHART_REGEX.test(text);
}

interface ChartRendererProps {
  charts: ChartSpec[];
}

export function ChartRenderer({ charts }: ChartRendererProps) {
  const { theme } = useThemeStore();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 80, 320);

  if (charts.length === 0) return null;

  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      {charts.map((spec, i) => (
        <View
          key={i}
          style={{
            backgroundColor: theme.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          {(spec.type === "line" || spec.type === "area") && (
            <LineChart
              data={spec.data as { x: number | string; y: number }[]}
              width={chartWidth}
              height={180}
              title={spec.title}
              color={spec.color}
              showArea={spec.type === "area"}
            />
          )}
          {spec.type === "bar" && (
            <BarChart
              data={spec.data as { label: string; value: number; color?: string }[]}
              width={chartWidth}
              height={180}
              title={spec.title}
              horizontal={spec.horizontal}
            />
          )}
          {spec.type === "pie" && (
            <PieChart
              data={spec.data as { label: string; value: number; color?: string }[]}
              width={chartWidth}
              height={200}
              title={spec.title}
            />
          )}
        </View>
      ))}
    </View>
  );
}
