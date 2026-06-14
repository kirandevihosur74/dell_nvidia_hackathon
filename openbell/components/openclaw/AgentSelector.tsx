import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Bot, Code, Search, Briefcase, Shield, Wrench, HelpCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { GatewayAgent } from "@/types/gateway";

interface AgentSelectorProps {
  agents: GatewayAgent[];
  activeAgentId: string | null;
  onSelect: (agentId: string) => void;
}

const ICON_MAP: Record<string, typeof Bot> = {
  bot: Bot,
  code: Code,
  search: Search,
  briefcase: Briefcase,
  shield: Shield,
  wrench: Wrench,
};

export function AgentSelector({ agents, activeAgentId, onSelect }: AgentSelectorProps) {
  const { theme } = useThemeStore();

  if (agents.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 48, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" }}
    >
      {agents.map((agent) => {
        const isActive = agent.id === activeAgentId;
        const Icon = ICON_MAP[agent.icon] || Bot;

        return (
          <TouchableOpacity
            key={agent.id}
            onPress={() => onSelect(agent.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${agent.name} agent${isActive ? ", selected" : ""}. ${agent.description}`}
            accessibilityState={{ selected: isActive }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: isActive ? theme.primary : theme.card,
              borderWidth: 1,
              borderColor: isActive ? theme.primary : theme.border,
            }}
          >
            <Icon size={14} color={isActive ? "#FFFFFF" : theme.textSecondary} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: isActive ? "#FFFFFF" : theme.textSecondary,
              }}
            >
              {agent.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
