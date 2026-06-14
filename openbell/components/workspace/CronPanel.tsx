import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Clock, Play, Pause, Trash2, Plus, AlertCircle, RotateCw } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useCronStore } from "@/stores/cronStore";
import { CronCreateModal } from "./CronCreateModal";
import type { CronJob } from "@/types/gateway";

interface CronPanelProps {
  agentId: string;
}

function formatSchedule(schedule: string): string {
  const map: Record<string, string> = {
    "* * * * *": "Every minute",
    "*/5 * * * *": "Every 5 min",
    "*/15 * * * *": "Every 15 min",
    "0 * * * *": "Hourly",
    "0 */6 * * *": "Every 6 hrs",
    "0 0 * * *": "Daily midnight",
    "0 9 * * *": "Daily 9 AM",
    "0 9 * * 1": "Weekly Mon",
  };
  return map[schedule] || schedule;
}

function formatTime(ms?: number): string {
  if (!ms) return "Never";
  const d = new Date(ms);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CronPanel({ agentId }: CronPanelProps) {
  const { theme } = useThemeStore();
  const { jobs, loading, error, listJobs, createJob, toggleJob, deleteJob, runJob, clearError } =
    useCronStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listJobs();
  }, [listJobs]);

  const handleRefresh = useCallback(() => {
    listJobs();
  }, [listJobs]);

  const handleDelete = useCallback(
    (job: CronJob) => {
      Alert.alert("Delete Cron Job", `Delete "${job.command.slice(0, 50)}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteJob(job.id),
        },
      ]);
    },
    [deleteJob]
  );

  const handleRun = useCallback(
    async (job: CronJob) => {
      await runJob(job.id);
      Alert.alert("Cron Executed", "Job triggered successfully.");
    },
    [runJob]
  );

  const renderItem = useCallback(
    ({ item }: { item: CronJob }) => (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          opacity: item.enabled ? 1 : 0.5,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Status indicator */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: item.enabled ? theme.success + "15" : theme.textTertiary + "15",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Clock size={18} color={item.enabled ? theme.success : theme.textTertiary} />
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: theme.text, fontWeight: "500" }} numberOfLines={2}>
              {item.command}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.primary,
                  fontWeight: "600",
                  fontFamily: "monospace",
                }}
              >
                {formatSchedule(item.schedule)}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                Last: {formatTime(item.lastRun)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => handleRun(item)} hitSlop={6}>
              <RotateCw size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleJob(item.id)} hitSlop={6}>
              {item.enabled ? (
                <Pause size={16} color={theme.warning} />
              ) : (
                <Play size={16} color={theme.success} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={6}>
              <Trash2 size={16} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [theme, toggleJob, handleDelete, handleRun]
  );

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
        <AlertCircle size={32} color={theme.error} />
        <Text style={{ fontSize: 14, color: theme.error, marginTop: 12, textAlign: "center" }}>
          Cron scheduling unavailable
        </Text>
        <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 6, textAlign: "center", lineHeight: 18 }}>
          The Gateway's cron tool is not enabled.{"\n\n"}
          Add to ~/.openclaw/openclaw.json:{"\n"}
          gateway.tools.allow: ["cron", "gateway"]{"\n\n"}
          Then restart the Gateway.
        </Text>
        <TouchableOpacity
          onPress={() => { clearError(); handleRefresh(); }}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.primary,
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
              <Clock size={40} color={theme.textTertiary} />
              <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12 }}>
                No cron jobs yet
              </Text>
              <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 4 }}>
                Schedule recurring tasks for your agents
              </Text>
            </View>
          )
        }
      />

      {/* Inline create button */}
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginHorizontal: 16,
          marginVertical: 12,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: theme.primary,
        }}
      >
        <Plus size={18} color="#FFF" />
        <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "600" }}>New Cron Job</Text>
      </TouchableOpacity>

      <CronCreateModal
        visible={showCreate}
        agentId={agentId}
        onClose={() => setShowCreate(false)}
        onCreate={createJob}
      />
    </View>
  );
}
