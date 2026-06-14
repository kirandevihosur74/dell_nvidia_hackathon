import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  Search,
  X,
  Plus,
  Code2,
  FileCode,
  Server,
  ShieldCheck,
  Brain,
  Wrench,
  Layers,
  Briefcase,
  GitBranch,
  Bot,
  User,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import {
  SUBAGENT_CATEGORIES,
  SUBAGENTS,
  searchSubagents,
  getSubagentsByCategory,
  type Subagent,
} from "@/services/openclaw/subagentRegistry";
import { useCustomAgentStore, type CustomAgent } from "@/stores/customAgentStore";
import { AgentEditor } from "./AgentEditor";

// Map category icon names to actual Lucide components
const ICON_MAP: Record<string, typeof Code2> = {
  Code2, FileCode, Server, ShieldCheck, Brain, Wrench, Layers, Briefcase, GitBranch, Search,
};

// Unified agent type used for selection
type PickableAgent = Subagent & { isCustom?: boolean };

function customToSubagent(c: CustomAgent): PickableAgent {
  return {
    id: c.id,
    categoryId: c.categoryId,
    name: c.name,
    description: c.description,
    sandboxMode: c.sandboxMode,
    systemPrompt: c.systemPrompt,
    isCustom: true,
  };
}

interface SubagentPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (agent: Subagent) => void;
}

export function SubagentPicker({ visible, onClose, onSelect }: SubagentPickerProps) {
  const { theme } = useThemeStore();
  const { agents: customAgents, loadFromStorage, loaded } = useCustomAgentStore();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Editor state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editAgent, setEditAgent] = useState<CustomAgent | null>(null);
  const [cloneFrom, setCloneFrom] = useState<Subagent | null>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedCategory(null);
      if (!loaded) loadFromStorage();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible, loaded, loadFromStorage]);

  const customPickable = useMemo(
    () => customAgents.map(customToSubagent),
    [customAgents],
  );

  const filteredAgents = useMemo((): PickableAgent[] => {
    if (query.length > 0) {
      const builtIn = searchSubagents(query);
      const q = query.toLowerCase();
      const custom = customPickable.filter(
        a => a.name.toLowerCase().includes(q) ||
             a.description.toLowerCase().includes(q)
      );
      return [...custom, ...builtIn];
    }
    if (selectedCategory === "my-agents") return customPickable;
    if (selectedCategory) return getSubagentsByCategory(selectedCategory);
    return [];
  }, [query, selectedCategory, customPickable]);

  const showCategories = query.length === 0 && !selectedCategory;

  const handleSelect = useCallback(
    (agent: PickableAgent) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onSelect(agent);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleCategorySelect = useCallback((catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedCategory(catId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
    setQuery("");
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditAgent(null);
    setCloneFrom(null);
    setEditorVisible(true);
  }, []);

  const handleClone = useCallback((agent: Subagent) => {
    setEditAgent(null);
    setCloneFrom(agent);
    setEditorVisible(true);
  }, []);

  const handleEdit = useCallback((agent: PickableAgent) => {
    const custom = customAgents.find(a => a.id === agent.id);
    if (custom) {
      setCloneFrom(null);
      setEditAgent(custom);
      setEditorVisible(true);
    }
  }, [customAgents]);

  const handleDeleteCustom = useCallback((agent: PickableAgent) => {
    Alert.alert("Delete Agent", `Remove "${agent.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => useCustomAgentStore.getState().deleteAgent(agent.id),
      },
    ]);
  }, []);

  const handleLongPress = useCallback((agent: PickableAgent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (agent.isCustom) {
      Alert.alert(agent.name, undefined, [
        { text: "Edit", onPress: () => handleEdit(agent) },
        { text: "Delete", onPress: () => handleDeleteCustom(agent), style: "destructive" },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      Alert.alert(agent.name, "Clone this agent to customize its prompt.", [
        { text: "Clone", onPress: () => handleClone(agent) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }, [handleClone, handleEdit, handleDeleteCustom]);

  const selectedCategoryMeta = selectedCategory === "my-agents"
    ? { id: "my-agents", label: "My Agents", icon: "User" }
    : selectedCategory
      ? SUBAGENT_CATEGORIES.find((c) => c.id === selectedCategory)
      : null;

  const categories = useMemo(() => {
    const myAgents = {
      id: "my-agents",
      label: "My Agents",
      icon: "User",
    };
    return [myAgents, ...SUBAGENT_CATEGORIES];
  }, []);

  return (
    <>
      <Modal visible={visible && !editorVisible} animationType="none" transparent>
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
                maxHeight: "85%",
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
                  paddingBottom: 8,
                  gap: 10,
                }}
              >
                <Bot size={20} color={theme.primary} />
                <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text, flex: 1 }}>
                  Spawn Subagent
                </Text>
                <TouchableOpacity
                  onPress={handleCreateNew}
                  hitSlop={8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                    backgroundColor: theme.primary + "15",
                  }}
                >
                  <Plus size={14} color={theme.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }}>New</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  gap: 10,
                }}
              >
                <Search size={18} color={theme.textTertiary} />
                <TextInput
                  ref={inputRef}
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (t.length > 0) setSelectedCategory(null);
                  }}
                  placeholder="Search agents..."
                  placeholderTextColor={theme.textTertiary}
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: theme.text,
                    paddingVertical: 4,
                  }}
                />
                {(query.length > 0 || selectedCategory) && (
                  <TouchableOpacity onPress={handleBack} hitSlop={8}>
                    <X size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category breadcrumb */}
              {selectedCategoryMeta && query.length === 0 && (
                <TouchableOpacity
                  onPress={handleBack}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    gap: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 13, color: theme.primary, fontWeight: "600" }}>
                    {"< "}{selectedCategoryMeta.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textTertiary }}>
                    {filteredAgents.length} agents
                  </Text>
                </TouchableOpacity>
              )}

              {/* Content */}
              {showCategories ? (
                <FlatList
                  data={categories}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 40 }}
                  renderItem={({ item: cat }) => {
                    const isMyAgents = cat.id === "my-agents";
                    const Icon = isMyAgents ? User : (ICON_MAP[cat.icon] || Code2);
                    const count = isMyAgents
                      ? customAgents.length
                      : getSubagentsByCategory(cat.id).length;
                    return (
                      <TouchableOpacity
                        onPress={() => handleCategorySelect(cat.id)}
                        activeOpacity={0.6}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          gap: 14,
                          borderBottomWidth: 0.5,
                          borderBottomColor: theme.border,
                          backgroundColor: isMyAgents ? theme.primary + "06" : "transparent",
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: isMyAgents ? theme.primary + "20" : theme.primary + "15",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon size={18} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
                            {cat.label}
                          </Text>
                          {isMyAgents && count === 0 && (
                            <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 1 }}>
                              Clone or create your own agents
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 13, color: theme.textTertiary }}>{count}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              ) : (
                <FlatList
                  data={filteredAgents}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 40 }}
                  ListEmptyComponent={
                    selectedCategory === "my-agents" ? (
                      <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
                        <Text style={{ fontSize: 14, color: theme.textTertiary }}>
                          No custom agents yet
                        </Text>
                        <TouchableOpacity
                          onPress={handleCreateNew}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: theme.primary,
                          }}
                        >
                          <Plus size={14} color="#FFF" />
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFF" }}>
                            Create Agent
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: "center", paddingHorizontal: 32 }}>
                          Or long-press any built-in agent to clone it
                        </Text>
                      </View>
                    ) : (
                      <View style={{ padding: 32, alignItems: "center" }}>
                        <Text style={{ fontSize: 14, color: theme.textTertiary }}>
                          No matching agents
                        </Text>
                      </View>
                    )
                  }
                  renderItem={({ item: agent }) => (
                    <TouchableOpacity
                      onPress={() => handleSelect(agent)}
                      onLongPress={() => handleLongPress(agent)}
                      delayLongPress={400}
                      activeOpacity={0.6}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 0.5,
                        borderBottomColor: theme.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Bot size={16} color={agent.isCustom ? "#10B981" : theme.primary} />
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: theme.text,
                            flex: 1,
                          }}
                        >
                          {agent.name}
                        </Text>
                        {agent.isCustom && (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              backgroundColor: "#10B98120",
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: "600", color: "#10B981" }}>
                              CUSTOM
                            </Text>
                          </View>
                        )}
                        <View
                          style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor:
                              agent.sandboxMode === "read-only"
                                ? theme.textTertiary + "20"
                                : theme.primary + "20",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "600",
                              color:
                                agent.sandboxMode === "read-only"
                                  ? theme.textTertiary
                                  : theme.primary,
                            }}
                          >
                            {agent.sandboxMode === "read-only" ? "READ" : "WRITE"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        numberOfLines={2}
                        style={{
                          fontSize: 13,
                          color: theme.textSecondary,
                          marginTop: 4,
                          marginLeft: 26,
                        }}
                      >
                        {agent.description}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      <AgentEditor
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        editAgent={editAgent}
        cloneFrom={cloneFrom}
      />
    </>
  );
}
