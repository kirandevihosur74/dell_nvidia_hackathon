import { View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ChevronRight } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { api } from "@/services/apiClient";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { SwipeableCard } from "@/components/board/SwipeableCard";
import { TaskContextMenu } from "@/components/board/TaskContextMenu";
import { TaskDetailSheet } from "@/components/board/TaskDetailSheet";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useOfflineStore } from "@/stores/offlineStore";
import { useAsanaBridge } from "@/hooks/useAsanaBridge";
import { getSecure } from "@/utils/secureStore";
import type { AsanaTask } from "@/types/asana";

export default function BoardScreen() {
  const { theme } = useThemeStore();
  const { isOffline } = useOfflineStore();
  const [openTasks, setOpenTasks] = useState<AsanaTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<AsanaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AsanaTask | null>(null);
  const [contextTask, setContextTask] = useState<AsanaTask | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const fetchBoardTasks = useCallback(async () => {
    const projectId = await getSecure("settings_default_project_id");
    const data = await api.getBoardTasks(projectId || undefined);
    setOpenTasks(data.columns.open as unknown as AsanaTask[]);
    setCompletedTasks(data.columns.completed as unknown as AsanaTask[]);
  }, []);

  // Stable ref for loadTasks to avoid circular dependency with useAsanaBridge
  const loadTasksRef = useCallback(async () => {
    try {
      await fetchBoardTasks();
    } catch {
      // silently fail for bridge auto-refresh
    }
  }, [fetchBoardTasks]);

  // Bridge: auto-refresh board when agent modifies tasks
  const { isAgentConnected, askAgentAboutTask, delegateTaskToAgent } = useAsanaBridge(loadTasksRef);

  const loadTasks = useCallback(async () => {
    try {
      await fetchBoardTasks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load tasks";
      Alert.alert("Board Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchBoardTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTasks();
  }, [loadTasks]);

  const handleTaskPress = useCallback((task: AsanaTask) => {
    setSelectedTask(task);
  }, []);

  const handleTaskLongPress = useCallback((task: AsanaTask) => {
    setContextTask(task);
  }, []);

  const handleComplete = useCallback(
    async (task: AsanaTask) => {
      try {
        await api.moveTask(task.gid, !task.completed);
        loadTasks();
      } catch {
        Alert.alert("Error", "Failed to update task.");
      }
    },
    [loadTasks]
  );

  const handleDelete = useCallback(
    async (task: AsanaTask) => {
      try {
        await api.deleteTask(task.gid);
        loadTasks();
      } catch {
        Alert.alert("Error", "Failed to delete task.");
      }
    },
    [loadTasks]
  );

  const renderSwipeableCard = useCallback(
    (task: AsanaTask) => (
      <SwipeableCard
        task={task}
        onPress={handleTaskPress}
        onLongPress={handleTaskLongPress}
        onComplete={handleComplete}
        onDelete={handleDelete}
      />
    ),
    [handleTaskPress, handleTaskLongPress, handleComplete, handleDelete]
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Task Board</Text>
        </View>

        {isOffline && (
          <View style={{ backgroundColor: theme.warning, paddingVertical: 6, alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#FFFFFF" }}>Offline — showing cached data</Text>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <KanbanColumn
            title="Open"
            tasks={openTasks}
            color={theme.primary}
            showOverdueCount
            renderCard={renderSwipeableCard}
          />

          {/* Completed: collapsed badge when empty, full column when expanded or has tasks */}
          {completedTasks.length === 0 && !completedExpanded ? (
            <TouchableOpacity
              onPress={() => setCompletedExpanded(true)}
              style={{
                backgroundColor: theme.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                alignSelf: "flex-start",
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success }} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textSecondary }}>Completed</Text>
              <View style={{ backgroundColor: theme.background, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>0</Text>
              </View>
              <ChevronRight size={14} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : (
            <KanbanColumn
              title="Completed"
              tasks={completedTasks}
              color={theme.success}
              renderCard={renderSwipeableCard}
            />
          )}
        </ScrollView>

        {/* Task Detail Bottom Sheet */}
        <TaskDetailSheet
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={loadTasks}
          isAgentConnected={isAgentConnected}
          onAskAgent={(task, question) => {
            askAgentAboutTask(task, question);
            setSelectedTask(null);
          }}
          onDelegateToAgent={(task, instructions) => {
            delegateTaskToAgent(task, instructions);
            setSelectedTask(null);
          }}
        />

        {/* Context Menu Bottom Sheet */}
        <TaskContextMenu
          task={contextTask}
          onClose={() => setContextTask(null)}
          onComplete={handleComplete}
          onEdit={(task) => {
            setContextTask(null);
            setSelectedTask(task);
          }}
          onDelete={handleDelete}
          isAgentConnected={isAgentConnected}
          onAskAgent={(task) => {
            askAgentAboutTask(task);
            setContextTask(null);
          }}
          onDelegateToAgent={(task) => {
            delegateTaskToAgent(task);
            setContextTask(null);
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
