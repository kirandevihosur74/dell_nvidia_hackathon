import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { X } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";

interface CronCreateModalProps {
  visible: boolean;
  agentId: string;
  onClose: () => void;
  onCreate: (job: { schedule: string; command: string; agentId: string }) => Promise<void>;
}

const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekly (Monday)", value: "0 9 * * 1" },
];

export function CronCreateModal({ visible, agentId, onClose, onCreate }: CronCreateModalProps) {
  const { theme } = useThemeStore();
  const [schedule, setSchedule] = useState("");
  const [command, setCommand] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!schedule.trim() || !command.trim()) return;
    setCreating(true);
    try {
      await onCreate({ schedule: schedule.trim(), command: command.trim(), agentId });
      setSchedule("");
      setCommand("");
      onClose();
    } catch {
      // error handled by store
    } finally {
      setCreating(false);
    }
  }, [schedule, command, agentId, onCreate, onClose]);

  const handlePreset = useCallback((value: string) => {
    setSchedule(value);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text }}>
              New Cron Job
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            {/* Schedule */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Schedule</Text>
              <TextInput
                value={schedule}
                onChangeText={setSchedule}
                placeholder="e.g. */5 * * * *"
                placeholderTextColor={theme.textTertiary}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  color: theme.text,
                  backgroundColor: theme.background,
                }}
              />

              {/* Presets */}
              <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>
                Presets
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    onPress={() => handlePreset(p.value)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: schedule === p.value ? theme.primary + "20" : theme.background,
                      borderWidth: 1,
                      borderColor: schedule === p.value ? theme.primary + "40" : theme.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: schedule === p.value ? theme.primary : theme.textSecondary,
                        fontWeight: schedule === p.value ? "600" : "400",
                      }}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Command */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Command</Text>
              <TextInput
                value={command}
                onChangeText={setCommand}
                placeholder="What should the agent do?"
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: theme.text,
                  backgroundColor: theme.background,
                  minHeight: 80,
                }}
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating || !schedule.trim() || !command.trim()}
              activeOpacity={0.7}
              style={{
                backgroundColor: !schedule.trim() || !command.trim() ? theme.textTertiary : theme.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>Create Cron Job</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
