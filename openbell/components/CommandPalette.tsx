import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import {
  Search,
  X,
  Plus,
  RotateCw,
  Square,
  Palette,
  FolderCode,
  LayoutGrid,
  Zap,
  Radio,
  MessageSquare,
  Bell,
  Terminal,
  Settings,
  Clock,
  MessageSquareDashed,
  Moon,
  Sun,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useThemeStore, themes } from "@/stores/themeStore";

type ActionCategory = "actions" | "navigate" | "appearance" | "voice";

interface PaletteAction {
  id: string;
  label: string;
  description: string;
  category: ActionCategory;
  icon: typeof Search;
  keywords: string[];
  action: () => void;
}

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onSpawnSession?: () => void;
  onResetSession?: () => void;
  onAbort?: () => void;
}

const CATEGORY_ORDER: Record<ActionCategory, number> = {
  actions: 0,
  navigate: 1,
  appearance: 2,
  voice: 3,
};

const CATEGORY_LABELS: Record<ActionCategory, string> = {
  actions: "Actions",
  navigate: "Navigate",
  appearance: "Appearance",
  voice: "Voice",
};

function filterActions(actions: PaletteAction[], query: string): PaletteAction[] {
  if (!query.trim()) return actions;
  const q = query.toLowerCase();
  return actions.filter(
    (a) =>
      a.label.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.toLowerCase().includes(q))
  );
}

function groupByCategory(actions: PaletteAction[]): { category: ActionCategory; label: string; actions: PaletteAction[] }[] {
  const groups = new Map<ActionCategory, PaletteAction[]>();
  for (const action of actions) {
    const list = groups.get(action.category) || [];
    list.push(action);
    groups.set(action.category, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b])
    .map(([category, actions]) => ({ category, label: CATEGORY_LABELS[category], actions }));
}

export function CommandPalette({
  visible,
  onClose,
  onSpawnSession,
  onResetSession,
  onAbort,
}: CommandPaletteProps) {
  const { theme, setTheme, activeThemeKey, toggleMode, mode } = useThemeStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  const allActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      // --- Actions ---
      {
        id: "spawn",
        label: "Spawn Agent",
        description: "Create a new agent session",
        category: "actions",
        icon: Plus,
        keywords: ["new", "create", "session", "agent"],
        action: () => { onSpawnSession?.(); onClose(); },
      },
      {
        id: "reset",
        label: "Reset Session",
        description: "Clear current session context",
        category: "actions",
        icon: RotateCw,
        keywords: ["clear", "restart", "fresh"],
        action: () => { onResetSession?.(); onClose(); },
      },
      {
        id: "abort",
        label: "Stop Generation",
        description: "Abort current agent response",
        category: "actions",
        icon: Square,
        keywords: ["stop", "cancel", "abort"],
        action: () => { onAbort?.(); onClose(); },
      },

      // --- Navigate ---
      {
        id: "nav-openclaw",
        label: "OpenClaw",
        description: "Go to agent chat",
        category: "navigate",
        icon: MessageSquare,
        keywords: ["chat", "agent", "gateway"],
        action: () => { router.navigate("/(tabs)/openclaw"); onClose(); },
      },
      {
        id: "nav-messenger",
        label: "Messenger",
        description: "Go to Slack messenger",
        category: "navigate",
        icon: MessageSquareDashed,
        keywords: ["slack", "message"],
        action: () => { router.navigate("/(tabs)/messenger"); onClose(); },
      },
      {
        id: "nav-workspace",
        label: "Workspace",
        description: "Browse agent files and config",
        category: "navigate",
        icon: FolderCode,
        keywords: ["files", "memory", "config", "soul", "tools"],
        action: () => { router.navigate("/(tabs)/workspace"); onClose(); },
      },
      {
        id: "nav-board",
        label: "Board",
        description: "Go to Asana task board",
        category: "navigate",
        icon: LayoutGrid,
        keywords: ["asana", "tasks", "kanban"],
        action: () => { router.navigate("/(tabs)/board"); onClose(); },
      },
      {
        id: "nav-skills",
        label: "Skills",
        description: "Browse agent skills",
        category: "navigate",
        icon: Zap,
        keywords: ["skill", "capability"],
        action: () => { router.navigate("/(tabs)/skills"); onClose(); },
      },
      {
        id: "nav-stream",
        label: "Stream",
        description: "Go to video inference",
        category: "navigate",
        icon: Radio,
        keywords: ["camera", "inference", "video", "live"],
        action: () => { router.navigate("/(tabs)/stream"); onClose(); },
      },
      {
        id: "nav-activity",
        label: "Activity",
        description: "View activity feed",
        category: "navigate",
        icon: Bell,
        keywords: ["events", "log", "notifications"],
        action: () => { router.navigate("/(tabs)/activity"); onClose(); },
      },
      {
        id: "nav-terminal",
        label: "Terminal",
        description: "Open terminal interface",
        category: "navigate",
        icon: Terminal,
        keywords: ["shell", "command", "cli"],
        action: () => { router.navigate("/(tabs)/terminal"); onClose(); },
      },
      {
        id: "nav-settings",
        label: "Settings",
        description: "Open app settings",
        category: "navigate",
        icon: Settings,
        keywords: ["preferences", "config"],
        action: () => { router.navigate("/(tabs)/settings"); onClose(); },
      },

      // --- Appearance: theme commands ---
      ...themes.map((t) => ({
        id: `theme-${t.key}`,
        label: `Theme: ${t.name}`,
        description: t.isDark ? "Dark theme" : "Light theme",
        category: "appearance" as ActionCategory,
        icon: Palette,
        keywords: ["theme", "color", t.isDark ? "dark" : "light", t.name.toLowerCase()],
        action: () => { setTheme(t.key); onClose(); },
      })),

      {
        id: "toggle-dark",
        label: mode === "dark" ? "Switch to Light" : "Switch to Dark",
        description: "Toggle light/dark mode",
        category: "appearance",
        icon: mode === "dark" ? Sun : Moon,
        keywords: ["dark", "light", "mode", "toggle"],
        action: () => { toggleMode(); onClose(); },
      },
    ];

    return actions;
  }, [onSpawnSession, onResetSession, onAbort, onClose, router, setTheme, toggleMode, mode]);

  const filtered = useMemo(() => filterActions(allActions, query), [allActions, query]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const handleSelect = useCallback((action: PaletteAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    action.action();
  }, []);

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={onClose}
          />

          <Animated.View
            entering={SlideInUp.duration(200)}
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "80%",
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
            {/* Search header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                gap: 10,
              }}
            >
              <Search size={18} color={theme.textTertiary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search actions, pages, themes..."
                placeholderTextColor={theme.textTertiary}
                autoCorrect={false}
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: theme.text,
                  paddingVertical: 4,
                }}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                  <X size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            <FlatList
              data={grouped}
              keyExtractor={(item) => item.category}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={{ padding: 32, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: theme.textTertiary }}>No matching actions</Text>
                </View>
              }
              renderItem={({ item: group }) => (
                <View>
                  {/* Category header */}
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: theme.textTertiary,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {group.label}
                    </Text>
                  </View>

                  {/* Actions in category */}
                  {group.actions.map((action) => {
                    const Icon = action.icon;
                    const isActiveTheme = action.id === `theme-${activeThemeKey}`;
                    return (
                      <TouchableOpacity
                        key={action.id}
                        onPress={() => handleSelect(action)}
                        activeOpacity={0.6}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 16,
                          paddingVertical: 11,
                          gap: 12,
                          backgroundColor: isActiveTheme ? theme.primary + "10" : "transparent",
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            backgroundColor: theme.primary + "12",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Icon size={15} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>
                            {action.label}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.textTertiary }} numberOfLines={1}>
                            {action.description}
                          </Text>
                        </View>
                        {isActiveTheme && (
                          <View
                            style={{
                              backgroundColor: theme.primary + "20",
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: "700", color: theme.primary }}>
                              ACTIVE
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
