import { View, Text } from "react-native";
import { ListTodo } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { TaskCard } from "./TaskCard";
import type { AsanaTask } from "@/types/asana";

interface Props {
  tasks: AsanaTask[];
  title?: string;
  onTaskPress?: (task: AsanaTask) => void;
}

export function TaskListCard({ tasks, title, onTaskPress }: Props) {
  const { theme } = useThemeStore();

  if (tasks.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        marginTop: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.background,
        }}
      >
        <ListTodo size={16} color={theme.primary} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>
          {title || `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {/* Task list */}
      <View style={{ padding: 8, gap: 4 }}>
        {tasks.slice(0, 10).map((task) => (
          <TaskCard key={task.gid} task={task} onPress={onTaskPress} />
        ))}
        {tasks.length > 10 && (
          <Text
            style={{
              fontSize: 12,
              color: theme.textTertiary,
              textAlign: "center",
              paddingVertical: 8,
            }}
          >
            +{tasks.length - 10} more tasks
          </Text>
        )}
      </View>
    </View>
  );
}
