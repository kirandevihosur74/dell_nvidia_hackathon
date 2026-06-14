import { View, Text, ScrollView } from "react-native";
import { useThemeStore } from "@/stores/themeStore";
import { KanbanTaskCard } from "./KanbanTaskCard";
import type { KanbanTask, KanbanStatus } from "@/types/gateway";

const STATUS_LABELS: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_COLORS: Record<KanbanStatus, string> = {
  backlog: "#9CA3AF",
  todo: "#3B82F6",
  "in-progress": "#F59E0B",
  review: "#8B5CF6",
  done: "#10B981",
};

interface KanbanColumnProps {
  status: KanbanStatus;
  tasks: KanbanTask[];
  columnWidth: number;
  onTaskPress: (task: KanbanTask) => void;
  onMoveForward: (task: KanbanTask) => void;
  onMoveBack: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
}

export function KanbanColumn({
  status,
  tasks,
  columnWidth,
  onTaskPress,
  onMoveForward,
  onMoveBack,
  onDelete,
}: KanbanColumnProps) {
  const { theme } = useThemeStore();
  const statusColor = STATUS_COLORS[status];

  return (
    <View
      style={{
        width: columnWidth,
        marginRight: 10,
      }}
    >
      {/* Column header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingBottom: 10,
          borderBottomWidth: 2,
          borderBottomColor: statusColor,
          marginBottom: 10,
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
          {STATUS_LABELS[status]}
        </Text>
        <View
          style={{
            backgroundColor: theme.border,
            borderRadius: 8,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "700", color: theme.textSecondary }}>
            {tasks.length}
          </Text>
        </View>
      </View>

      {/* Cards */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 80 }}
      >
        {tasks.map((task) => (
          <KanbanTaskCard
            key={task.id}
            task={task}
            onPress={onTaskPress}
            onMoveForward={onMoveForward}
            onMoveBack={onMoveBack}
            onDelete={onDelete}
          />
        ))}

        {tasks.length === 0 && (
          <View
            style={{
              paddingVertical: 24,
              alignItems: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.border,
              borderStyle: "dashed",
            }}
          >
            <Text style={{ fontSize: 12, color: theme.textTertiary }}>No tasks</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
