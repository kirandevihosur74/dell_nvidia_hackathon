import { useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { FileText, Brain, Wrench, User, Users, HeartPulse, Fingerprint } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useWorkspaceStore, CONFIG_FILES } from "@/stores/workspaceStore";

interface ConfigPanelProps {
  agentId: string;
}

const FILE_META: Record<string, { icon: typeof FileText; label: string; description: string }> = {
  "SOUL.md": { icon: Brain, label: "Soul", description: "Agent personality and behavior" },
  "TOOLS.md": { icon: Wrench, label: "Tools", description: "Available tools and capabilities" },
  "USER.md": { icon: User, label: "User", description: "User context and preferences" },
  "AGENTS.md": { icon: Users, label: "Agents", description: "Sub-agent definitions" },
  "HEARTBEAT.md": { icon: HeartPulse, label: "Heartbeat", description: "Periodic task instructions" },
  "IDENTITY.md": { icon: Fingerprint, label: "Identity", description: "Agent identity and metadata" },
};

export function ConfigPanel({ agentId }: ConfigPanelProps) {
  const { theme } = useThemeStore();
  const { openFile } = useWorkspaceStore();

  const handlePress = useCallback(
    (name: string) => {
      openFile(agentId, name);
    },
    [agentId, openFile]
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        Agent Configuration
      </Text>

      {CONFIG_FILES.map((name) => {
        const meta = FILE_META[name] || { icon: FileText, label: name, description: "" };
        const Icon = meta.icon;

        return (
          <TouchableOpacity
            key={name}
            onPress={() => handlePress(name)}
            activeOpacity={0.6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
              borderRadius: 12,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: theme.primary + "12",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>
                {meta.label}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
                {meta.description}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.textTertiary, fontFamily: "monospace" }}>
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
