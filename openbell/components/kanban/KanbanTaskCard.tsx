import { useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { ChevronRight, Trash2, Bot, ArrowRight, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useThemeStore } from "@/stores/themeStore";
import type { KanbanTask, KanbanStatus } from "@/types/gateway";

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const STATUS_ORDER: KanbanStatus[] = ["backlog", "todo", "in-progress", "review", "done"];

const STATUS_LABELS: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

interface KanbanTaskCardProps {
  task: KanbanTask;
  onPress: (task: KanbanTask) => void;
  onMoveForward: (task: KanbanTask) => void;
  onMoveBack: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
}

function AdvanceAction({ nextStatus }: { nextStatus: string }) {
  return (
    <View
      style={{
        backgroundColor: "#3B82F6",
        justifyContent: "center",
        alignItems: "center",
        width: 72,
        borderRadius: 10,
        marginRight: 6,
      }}
    >
      <ArrowRight size={18} color="#FFFFFF" />
      <Text style={{ fontSize: 9, color: "#FFFFFF", fontWeight: "600", marginTop: 2 }} numberOfLines={1}>
        {nextStatus}
      </Text>
    </View>
  );
}

function CompleteAction() {
  return (
    <View
      style={{
        backgroundColor: "#10B981",
        justifyContent: "center",
        alignItems: "center",
        width: 72,
        borderRadius: 10,
        marginRight: 6,
      }}
    >
      <Check size={18} color="#FFFFFF" />
      <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "600", marginTop: 2 }}>Done</Text>
    </View>
  );
}

function DeleteAction() {
  return (
    <View
      style={{
        backgroundColor: "#EF4444",
        justifyContent: "center",
        alignItems: "center",
        width: 72,
        borderRadius: 10,
        marginLeft: 6,
      }}
    >
      <Trash2 size={18} color="#FFFFFF" />
      <Text style={{ fontSize: 10, color: "#FFFFFF", fontWeight: "600", marginTop: 2 }}>Delete</Text>
    </View>
  );
}

export function KanbanTaskCard({ task, onPress, onMoveForward, onMoveBack, onDelete }: KanbanTaskCardProps) {
  const { theme } = useThemeStore();
  const swipeRef = useRef<Swipeable>(null);
  const statusIdx = STATUS_ORDER.indexOf(task.status);
  const canMoveForward = statusIdx < STATUS_ORDER.length - 1;
  const isDone = task.status === "done";
  const nextStatus = canMoveForward ? STATUS_LABELS[STATUS_ORDER[statusIdx + 1]] : "";
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : undefined;

  const handleSwipeRight = () => {
    swipeRef.current?.close();
    if (canMoveForward) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onMoveForward(task);
    }
  };

  const handleSwipeLeft = () => {
    swipeRef.current?.close();
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(task),
      },
    ]);
  };

  const renderLeftActions = () => {
    if (isDone) return undefined;
    if (!canMoveForward) return undefined;
    // If next status is "done", show green check; otherwise blue arrow
    if (STATUS_ORDER[statusIdx + 1] === "done") {
      return <CompleteAction />;
    }
    return <AdvanceAction nextStatus={nextStatus} />;
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={canMoveForward && !isDone ? renderLeftActions : undefined}
      renderRightActions={() => <DeleteAction />}
      onSwipeableOpen={(direction) => {
        if (direction === "left") handleSwipeRight();
        else handleSwipeLeft();
      }}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        onPress={() => onPress(task)}
        activeOpacity={0.7}
        style={{
          backgroundColor: theme.card,
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.border,
          borderLeftWidth: priorityColor ? 3 : 1,
          borderLeftColor: priorityColor || theme.border,
          gap: 8,
        }}
      >
        {/* Title */}
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }} numberOfLines={2}>
          {task.title}
        </Text>

        {/* Description preview */}
        {task.description && (
          <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {/* Footer: agent + status hint */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {task.agentId ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Bot size={11} color={theme.primary} />
              <Text style={{ fontSize: 10, color: theme.primary, fontWeight: "500" }}>
                {task.agentId.slice(0, 8)}
              </Text>
            </View>
          ) : (
            <View />
          )}

          {canMoveForward && !isDone && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <ChevronRight size={12} color={theme.textTertiary} />
              <Text style={{ fontSize: 10, color: theme.textTertiary }}>{nextStatus}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}
