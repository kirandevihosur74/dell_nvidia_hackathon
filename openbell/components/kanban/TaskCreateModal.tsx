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
import type { KanbanStatus } from "@/types/gateway";

interface TaskCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (task: { title: string; description?: string; status: KanbanStatus; priority?: string }) => Promise<void>;
}

const STATUSES: { key: KanbanStatus; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
];

const PRIORITIES = [
  { key: "low", label: "Low", color: "#10B981" },
  { key: "medium", label: "Medium", color: "#F59E0B" },
  { key: "high", label: "High", color: "#EF4444" },
];

export function TaskCreateModal({ visible, onClose, onCreate }: TaskCreateModalProps) {
  const { theme } = useThemeStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KanbanStatus>("todo");
  const [priority, setPriority] = useState("medium");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
      });
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      onClose();
    } catch {
      // handled by store
    } finally {
      setCreating(false);
    }
  }, [title, description, status, priority, onCreate, onClose]);

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
            maxHeight: "80%",
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
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text }}>New Task</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What needs to be done?"
                placeholderTextColor={theme.textTertiary}
                autoFocus
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: theme.text,
                  backgroundColor: theme.background,
                }}
              />
            </View>

            {/* Description */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional details..."
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
                  minHeight: 70,
                }}
              />
            </View>

            {/* Status */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Status</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setStatus(s.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: status === s.key ? theme.primary + "20" : theme.background,
                      borderWidth: 1,
                      borderColor: status === s.key ? theme.primary + "40" : theme.border,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: status === s.key ? "600" : "400",
                        color: status === s.key ? theme.primary : theme.textSecondary,
                      }}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Priority */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: theme.text }}>Priority</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setPriority(p.key)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: priority === p.key ? p.color + "15" : theme.background,
                      borderWidth: 1,
                      borderColor: priority === p.key ? p.color + "40" : theme.border,
                      gap: 4,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: priority === p.key ? "600" : "400",
                        color: priority === p.key ? p.color : theme.textSecondary,
                      }}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Create button */}
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating || !title.trim()}
              activeOpacity={0.7}
              style={{
                backgroundColor: !title.trim() ? theme.textTertiary : theme.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 4,
              }}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>Create Task</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
