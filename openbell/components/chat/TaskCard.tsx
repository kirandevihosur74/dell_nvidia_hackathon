import { View, Text, TouchableOpacity } from "react-native";
import { CheckCircle2, Circle, Calendar, User, ChevronRight } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { formatDueDate } from "@/utils/dateFormat";
import type { AsanaTask } from "@/types/asana";

interface Props {
  task: AsanaTask;
  onPress?: (task: AsanaTask) => void;
}

export function TaskCard({ task, onPress }: Props) {
  const { theme } = useThemeStore();

  return (
    <TouchableOpacity
      onPress={() => onPress?.(task)}
      activeOpacity={0.7}
      style={{
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        {task.completed ? (
          <CheckCircle2 size={20} color={theme.success} />
        ) : (
          <Circle size={20} color={theme.textTertiary} />
        )}

        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: task.completed ? theme.textTertiary : theme.text,
              textDecorationLine: task.completed ? "line-through" : "none",
            }}
            numberOfLines={2}
          >
            {task.name}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {task.due_on && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Calendar size={12} color={theme.textTertiary} />
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                  {formatDueDate(task.due_on)}
                </Text>
              </View>
            )}
            {task.assignee && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <User size={12} color={theme.textTertiary} />
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                  {task.assignee.name}
                </Text>
              </View>
            )}
          </View>

          {task.projects && task.projects.length > 0 && (
            <Text style={{ fontSize: 11, color: theme.primary }}>
              {task.projects.map((p) => p.name).join(", ")}
            </Text>
          )}
        </View>

        <ChevronRight size={16} color={theme.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}
