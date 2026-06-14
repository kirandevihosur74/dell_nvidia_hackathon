import { useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { BookOpen } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface MemoryPanelProps {
  agentId: string;
}

export function MemoryPanel({ agentId }: MemoryPanelProps) {
  const { theme } = useThemeStore();
  const { loading, openFile } = useWorkspaceStore();

  const loadMemory = useCallback(() => {
    openFile(agentId, "MEMORY.md");
  }, [agentId, openFile]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
      <BookOpen size={40} color={theme.textTertiary} />
      <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12, textAlign: "center" }}>
        View and edit agent memory
      </Text>
      <Pressable
        onPress={loadMemory}
        style={{
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 8,
          backgroundColor: theme.primary,
        }}
      >
        <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Open MEMORY.md</Text>
      </Pressable>
    </View>
  );
}
