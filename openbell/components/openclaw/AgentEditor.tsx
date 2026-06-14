import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import { X, Save, Trash2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useCustomAgentStore, type CustomAgent } from "@/stores/customAgentStore";

interface AgentEditorProps {
  visible: boolean;
  onClose: () => void;
  /** Existing custom agent to edit, or null for new agent */
  editAgent?: CustomAgent | null;
  /** Built-in agent to clone from, or null for blank */
  cloneFrom?: { name: string; description: string; systemPrompt: string; categoryId: string; sandboxMode: "read-only" | "workspace-write"; id: string } | null;
}

export function AgentEditor({ visible, onClose, editAgent, cloneFrom }: AgentEditorProps) {
  const { theme } = useThemeStore();
  const { addAgent, updateAgent, deleteAgent } = useCustomAgentStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const nameRef = useRef<TextInput>(null);

  const isEditing = !!editAgent;
  const title = isEditing ? "Edit Agent" : cloneFrom ? `Clone: ${cloneFrom.name}` : "Create Agent";

  useEffect(() => {
    if (visible) {
      if (editAgent) {
        setName(editAgent.name);
        setDescription(editAgent.description);
        setSystemPrompt(editAgent.systemPrompt);
      } else if (cloneFrom) {
        setName(`${cloneFrom.name} (Custom)`);
        setDescription(cloneFrom.description);
        setSystemPrompt(cloneFrom.systemPrompt);
      } else {
        setName("");
        setDescription("");
        setSystemPrompt("");
      }
      setTimeout(() => nameRef.current?.focus(), 200);
    }
  }, [visible, editAgent, cloneFrom]);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter a name for your agent.");
      return;
    }

    if (isEditing && editAgent) {
      updateAgent(editAgent.id, {
        name: trimmedName,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
      });
    } else {
      addAgent({
        name: trimmedName,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        categoryId: cloneFrom?.categoryId || "general",
        sandboxMode: cloneFrom?.sandboxMode || "workspace-write",
        clonedFrom: cloneFrom?.id,
      });
    }
    onClose();
  }, [name, description, systemPrompt, isEditing, editAgent, cloneFrom, addAgent, updateAgent, onClose]);

  const handleDelete = useCallback(() => {
    if (!editAgent) return;
    Alert.alert(
      "Delete Agent",
      `Remove "${editAgent.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteAgent(editAgent.id);
            onClose();
          },
        },
      ],
    );
  }, [editAgent, deleteAgent, onClose]);

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />

          <Animated.View
            entering={SlideInUp.duration(200)}
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "90%",
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: theme.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text, flex: 1 }}>
                {title}
              </Text>
              {isEditing && (
                <TouchableOpacity onPress={handleDelete} hitSlop={8}>
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
            >
              {/* Name */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}>
                  Name
                </Text>
                <TextInput
                  ref={nameRef}
                  value={name}
                  onChangeText={setName}
                  placeholder="My Custom Agent"
                  placeholderTextColor={theme.textTertiary}
                  style={{
                    fontSize: 15,
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </View>

              {/* Description */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}>
                  Description
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="When to use this agent..."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  numberOfLines={2}
                  style={{
                    fontSize: 15,
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 60,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              {/* System Prompt */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textSecondary }}>
                  System Prompt
                </Text>
                <TextInput
                  value={systemPrompt}
                  onChangeText={setSystemPrompt}
                  placeholder="You are a specialist in..."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  numberOfLines={8}
                  style={{
                    fontSize: 14,
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 180,
                    textAlignVertical: "top",
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  }}
                />
              </View>

              {/* Save button */}
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: theme.primary,
                  paddingVertical: 14,
                  borderRadius: 12,
                }}
              >
                <Save size={16} color="#FFF" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFF" }}>
                  {isEditing ? "Save Changes" : "Create Agent"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
