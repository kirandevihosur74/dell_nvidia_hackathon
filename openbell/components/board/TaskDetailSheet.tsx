import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Calendar, User, FileText, CheckCircle2, Circle, X } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { formatDueDate } from "@/utils/dateFormat";
import { api } from "@/services/apiClient";
import { AgentTaskAction } from "@/components/bridge/AgentTaskAction";
import type { AsanaTask } from "@/types/asana";

interface Props {
  task: AsanaTask | null;
  onClose: () => void;
  onTaskUpdated: () => void;
  isAgentConnected?: boolean;
  onAskAgent?: (task: AsanaTask, question?: string) => void;
  onDelegateToAgent?: (task: AsanaTask, instructions?: string) => void;
}

export function TaskDetailSheet({ task, onClose, onTaskUpdated, isAgentConnected, onAskAgent, onDelegateToAgent }: Props) {
  const { theme } = useThemeStore();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%", "90%"], []);
  const [moving, setMoving] = useState(false);

  const handleToggleComplete = useCallback(async () => {
    if (!task) return;
    setMoving(true);
    try {
      await api.moveTask(task.gid, !task.completed);
      onTaskUpdated();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to update task status.");
    } finally {
      setMoving(false);
    }
  }, [task, onTaskUpdated, onClose]);

  if (!task) return null;

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
            <Text style={{ fontSize: 20, fontWeight: "600", color: theme.text }}>{task.name}</Text>
            {task.projects && task.projects.length > 0 && (
              <Text style={{ fontSize: 13, color: theme.primary }}>
                {task.projects.map((p) => p.name).join(", ")}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={20} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {/* Status */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {task.completed ? (
              <CheckCircle2 size={20} color={theme.success} />
            ) : (
              <Circle size={20} color={theme.textTertiary} />
            )}
            <Text style={{ fontSize: 15, color: theme.text }}>
              {task.completed ? "Completed" : "Open"}
            </Text>
          </View>

          {/* Due Date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Calendar size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, color: theme.text }}>{formatDueDate(task.due_on)}</Text>
          </View>

          {/* Assignee */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <User size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 15, color: theme.text }}>
              {task.assignee?.name || "Unassigned"}
            </Text>
          </View>

          {/* Notes */}
          {task.notes ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <FileText size={20} color={theme.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>Notes</Text>
              </View>
              <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20, paddingLeft: 30 }}>
                {task.notes}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Agent Actions */}
        {isAgentConnected && onAskAgent && onDelegateToAgent && (
          <AgentTaskAction
            task={task}
            isAgentConnected={isAgentConnected}
            onAskAgent={onAskAgent}
            onDelegateToAgent={onDelegateToAgent}
          />
        )}

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleToggleComplete}
          disabled={moving}
          style={{
            backgroundColor: task.completed ? theme.textTertiary : theme.success,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            marginTop: 20,
            opacity: moving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>
            {moving ? "Updating..." : task.completed ? "Reopen Task" : "Mark Complete"}
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}
