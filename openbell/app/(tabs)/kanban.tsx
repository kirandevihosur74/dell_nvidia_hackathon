import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, useWindowDimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { KanbanSquare, Plus, AlertCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useKanbanStore } from "@/stores/kanbanStore";
import { KanbanColumn, TaskCreateModal, ProposalQueue } from "@/components/kanban";
import { KanbanTaskDetailSheet } from "@/components/kanban/KanbanTaskDetailSheet";
import type { KanbanTask, KanbanStatus } from "@/types/gateway";

const COLUMNS: KanbanStatus[] = ["backlog", "todo", "in-progress", "review", "done"];
const STATUS_ORDER: KanbanStatus[] = COLUMNS;

export default function KanbanScreen() {
  const { theme } = useThemeStore();
  const { width: screenWidth } = useWindowDimensions();
  const connectionStatus = useGatewayStore((s) => s.connectionStatus);
  const {
    tasks,
    proposals,
    loading,
    error,
    loadBoard,
    createTask,
    moveTask,
    deleteTask,
    loadProposals,
    approveProposal,
    rejectProposal,
    clearError,
  } = useKanbanStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  const isConnected = connectionStatus === "connected";
  const columnWidth = Math.max(200, screenWidth * 0.6);

  useEffect(() => {
    if (isConnected) {
      loadBoard();
      loadProposals();
    }
  }, [isConnected, loadBoard, loadProposals]);

  const handleRefresh = useCallback(() => {
    loadBoard();
    loadProposals();
  }, [loadBoard, loadProposals]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanTask[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      review: [],
      done: [],
    };
    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    }
    return grouped;
  }, [tasks]);

  const handleTaskPress = useCallback((task: KanbanTask) => {
    setSelectedTask(task);
  }, []);

  const handleMoveForward = useCallback(
    (task: KanbanTask) => {
      const idx = STATUS_ORDER.indexOf(task.status);
      if (idx < STATUS_ORDER.length - 1) {
        moveTask(task.id, STATUS_ORDER[idx + 1]);
      }
    },
    [moveTask]
  );

  const handleMoveBack = useCallback(
    (task: KanbanTask) => {
      const idx = STATUS_ORDER.indexOf(task.status);
      if (idx > 0) {
        moveTask(task.id, STATUS_ORDER[idx - 1]);
      }
    },
    [moveTask]
  );

  const handleDelete = useCallback(
    (task: KanbanTask) => {
      deleteTask(task.id);
    },
    [deleteTask]
  );

  const handleCreate = useCallback(
    async (task: { title: string; description?: string; status: KanbanStatus; priority?: string }) => {
      await createTask(task);
    },
    [createTask]
  );

  if (!isConnected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <KanbanSquare size={48} color={theme.textTertiary} />
          <Text style={{ fontSize: 16, fontWeight: "600", color: theme.text, marginTop: 16 }}>
            No Gateway Connected
          </Text>
          <Text style={{ fontSize: 13, color: theme.textTertiary, marginTop: 6, textAlign: "center" }}>
            Connect to an OpenClaw Gateway to use the Kanban board
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text }}>Kanban</Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <AlertCircle size={32} color={theme.error} />
          <Text style={{ fontSize: 14, color: theme.error, marginTop: 12, textAlign: "center" }}>
            {error}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 6, textAlign: "center" }}>
            Check that Nerve is running and the URL is correct in Settings
          </Text>
          <TouchableOpacity
            onPress={() => { clearError(); handleRefresh(); }}
            style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.primary }}
          >
            <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text }}>Kanban</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>{tasks.length} tasks</Text>
        </View>
      </View>

      {/* Proposals */}
      <ProposalQueue
        proposals={proposals}
        onApprove={approveProposal}
        onReject={(id) => rejectProposal(id)}
      />

      {/* Columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            columnWidth={columnWidth}
            onTaskPress={handleTaskPress}
            onMoveForward={handleMoveForward}
            onMoveBack={handleMoveBack}
            onDelete={handleDelete}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>

      <TaskCreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {selectedTask && (
        <KanbanTaskDetailSheet
          task={selectedTask}
          onClose={() => { setSelectedTask(null); loadBoard(); }}
        />
      )}
    </SafeAreaView>
  );
}
