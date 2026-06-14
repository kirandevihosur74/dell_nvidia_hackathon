import { TouchableOpacity, View, Text } from "react-native";
import { Calendar, Folder } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useThemeStore } from "@/stores/themeStore";
import { formatDueDate, getDueDateUrgency, getDueDateColor } from "@/utils/dateFormat";
import type { AsanaTask } from "@/types/asana";

interface Props {
  task: AsanaTask;
  onPress?: (task: AsanaTask) => void;
  onLongPress?: (task: AsanaTask) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const INITIAL_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#6366F1"];

function getInitialColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length];
}

const PRIORITY_CONFIG = {
  overdue: { label: "Overdue", bg: "#FEE2E2", text: "#DC2626" },
  soon: { label: "Due Soon", bg: "#FEF3C7", text: "#D97706" },
  upcoming: { label: "On Track", bg: "#D1FAE5", text: "#059669" },
  none: null,
} as const;

export function KanbanCard({ task, onPress, onLongPress }: Props) {
  const { theme } = useThemeStore();
  const urgency = getDueDateUrgency(task.due_on);
  const dateColor = getDueDateColor(urgency, theme);
  const priority = PRIORITY_CONFIG[urgency];
  const firstProject = task.projects?.[0];

  return (
    <Animated.View entering={FadeInDown.duration(200)}>
      <TouchableOpacity
        onPress={() => onPress?.(task)}
        onLongPress={() => onLongPress?.(task)}
        delayLongPress={300}
        activeOpacity={0.7}
        style={{
          backgroundColor: theme.background,
          borderRadius: 10,
          padding: 12,
          gap: 8,
        }}
      >
        {/* Top row: priority tag + project chip */}
        {(priority || firstProject) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {priority && (
              <View
                style={{
                  backgroundColor: priority.bg,
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "600", color: priority.text }}>
                  {priority.label}
                </Text>
              </View>
            )}
            {firstProject && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  backgroundColor: theme.card,
                  borderRadius: 4,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Folder size={9} color={theme.textTertiary} />
                <Text style={{ fontSize: 10, color: theme.textSecondary }} numberOfLines={1}>
                  {firstProject.name}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Task name */}
        <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }} numberOfLines={2}>
          {task.name}
        </Text>

        {/* Description preview */}
        {task.notes ? (
          <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
            {task.notes}
          </Text>
        ) : null}

        {/* Bottom row: due date + assignee */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {task.due_on && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Calendar size={11} color={dateColor} />
                <Text style={{ fontSize: 11, color: dateColor, fontWeight: urgency === "overdue" ? "600" : "400" }}>
                  {formatDueDate(task.due_on)}
                </Text>
              </View>
            )}
          </View>

          {task.assignee && (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: getInitialColor(task.assignee.name),
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: "700", color: "#FFFFFF" }}>
                {getInitials(task.assignee.name)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
