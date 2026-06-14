import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import {
  X,
  Circle,
  CheckCircle2,
  Calendar,
  User,
  FileText,
  Flag,
  ArrowRight,
  Trash2,
  Bot,
  Play,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useThemeStore } from "@/stores/themeStore";
import { useKanbanStore } from "@/stores/kanbanStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { KanbanTask, KanbanStatus } from "@/types/gateway";

interface Props {
  task: KanbanTask | null;
  onClose: () => void;
}

const STATUS_ORDER: KanbanStatus[] = ["backlog", "todo", "in-progress", "review", "done"];

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

const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

export function KanbanTaskDetailSheet({ task, onClose }: Props) {
  const { theme } = useThemeStore();
  const { moveTask, deleteTask, updateTask } = useKanbanStore();
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%", "90%"], []);
  const [moving, setMoving] = useState(false);

  const isConnected = connectionStatus === "connected";

  const statusIdx = task ? STATUS_ORDER.indexOf(task.status) : -1;
  const canMoveForward = statusIdx >= 0 && statusIdx < STATUS_ORDER.length - 1;
  const canMoveBack = statusIdx > 0;
  const isDone = task?.status === "done";
  const statusColor = task ? STATUS_COLORS[task.status] : theme.textTertiary;
  const priorityColor = task?.priority ? PRIORITY_COLORS[task.priority] : theme.textTertiary;

  const handleMoveForward = useCallback(async () => {
    if (!task || !canMoveForward) return;
    setMoving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextStatus = STATUS_ORDER[statusIdx + 1];
    await moveTask(task.id, nextStatus);
    setMoving(false);
    onClose();
  }, [task, canMoveForward, statusIdx, moveTask, onClose]);

  const handleMarkDone = useCallback(async () => {
    if (!task) return;
    setMoving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await moveTask(task.id, "done");
    setMoving(false);
    onClose();
  }, [task, moveTask, onClose]);

  const handleReopen = useCallback(async () => {
    if (!task) return;
    setMoving(true);
    await moveTask(task.id, "todo");
    setMoving(false);
    onClose();
  }, [task, moveTask, onClose]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTask(task.id);
          onClose();
        },
      },
    ]);
  }, [task, deleteTask, onClose]);

  const handleCyclePriority = useCallback(async () => {
    if (!task) return;
    const priorities: KanbanTask["priority"][] = ["low", "medium", "high"];
    const currentIdx = priorities.indexOf(task.priority || "medium");
    const next = priorities[(currentIdx + 1) % priorities.length];
    Haptics.selectionAsync().catch(() => {});
    await updateTask(task.id, { priority: next });
  }, [task, updateTask]);

  const handleAskAgent = useCallback(() => {
    if (!task) return;
    // Send task context to OpenClaw chat
    Alert.alert(
      "Ask Agent",
      `Send "${task.title}" to your agent for analysis?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Ask", onPress: () => {
          // TODO: wire to OpenClaw chat send
          Alert.alert("Sent", "Task context sent to agent chat.");
        }},
      ]
    );
  }, [task]);

  const handleExecute = useCallback(() => {
    if (!task) return;
    Alert.alert(
      "Execute Task",
      `Start an agent session to work on "${task.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Execute", onPress: () => {
          // TODO: wire to Nerve execute endpoint
          Alert.alert("Started", "Agent session spawned for this task.");
        }},
      ]
    );
  }, [task]);

  if (!task) return null;

  const formattedDate = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.card }}
      handleIndicatorStyle={{ backgroundColor: theme.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1, padding: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: "600", color: theme.text }}>{task.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {/* Status */}
          <TouchableOpacity
            onPress={canMoveForward ? handleMoveForward : undefined}
            disabled={!canMoveForward || moving}
            activeOpacity={0.6}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            {isDone ? (
              <CheckCircle2 size={20} color={theme.success} />
            ) : (
              <Circle size={20} color={statusColor} />
            )}
            <Text style={{ fontSize: 15, color: theme.text }}>
              {STATUS_LABELS[task.status]}
            </Text>
            {canMoveForward && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <ArrowRight size={14} color={theme.primary} />
                <Text style={{ fontSize: 12, color: theme.primary }}>
                  {STATUS_LABELS[STATUS_ORDER[statusIdx + 1]]}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Priority */}
          <TouchableOpacity
            onPress={handleCyclePriority}
            activeOpacity={0.6}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Flag size={20} color={priorityColor} />
            <Text style={{ fontSize: 15, color: theme.text }}>
              {PRIORITY_LABELS[task.priority || "medium"]} Priority
            </Text>
          </TouchableOpacity>

          {/* Created date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Calendar size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, color: theme.text }}>Created {formattedDate}</Text>
          </View>

          {/* Agent */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <User size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, color: theme.text }}>
              {task.agentId || "Unassigned"}
            </Text>
          </View>

          {/* Description */}
          {task.description ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <FileText size={20} color={theme.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>Description</Text>
              </View>
              <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, paddingLeft: 30 }}>
                {task.description}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Agent Actions */}
        {isConnected && (
          <View style={{ gap: 8, marginTop: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={handleAskAgent}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.primary + "15",
                  borderWidth: 1,
                  borderColor: theme.primary + "30",
                }}
                activeOpacity={0.6}
              >
                <Bot size={14} color={theme.primary} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>
                  Ask Agent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleExecute}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.warning + "15",
                  borderWidth: 1,
                  borderColor: theme.warning + "30",
                }}
                activeOpacity={0.6}
              >
                <Play size={14} color={theme.warning} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.warning }}>
                  Execute
                </Text>
              </TouchableOpacity>
            </View>

            {/* Delete */}
            <TouchableOpacity
              onPress={handleDelete}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 8,
              }}
              activeOpacity={0.6}
            >
              <Trash2 size={13} color={theme.error} />
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.error }}>Delete Task</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Primary Action */}
        <TouchableOpacity
          onPress={isDone ? handleReopen : handleMarkDone}
          disabled={moving}
          style={{
            backgroundColor: isDone ? theme.textTertiary : theme.success,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            marginTop: 12,
            opacity: moving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
            {moving ? "Updating..." : isDone ? "Reopen Task" : "Mark Complete"}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}
