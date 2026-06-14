import { View, Text, TouchableOpacity } from "react-native";
import { Bot, ArrowLeft, Pencil } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { findAgent } from "@/services/openclaw/agentLookup";
import { sessionManager } from "@/services/gateway/sessionManager";
import type { GatewaySession } from "@/types/gateway";

interface SubagentBannerProps {
  session: GatewaySession;
  onBackToMain: () => void;
  onEditAgent?: (agentId: string) => void;
}

export function SubagentBanner({ session, onBackToMain, onEditAgent }: SubagentBannerProps) {
  const { theme } = useThemeStore();

  if (!session.agentId) return null;

  const subagent = findAgent(session.agentId);
  const gatewayName = sessionManager.getGatewaySubagentName(session.id);
  const name = subagent?.name || gatewayName || session.name;
  const description = subagent?.description || "";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: theme.primary + "10",
        borderBottomWidth: 1,
        borderBottomColor: theme.primary + "25",
        gap: 10,
      }}
    >
      <Bot size={16} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: theme.primary,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {description.length > 0 && (
          <Text
            style={{
              fontSize: 11,
              color: theme.textSecondary,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {description}
          </Text>
        )}
      </View>
      {onEditAgent && (
        <TouchableOpacity
          onPress={() => onEditAgent(session.agentId!)}
          hitSlop={8}
          style={{
            padding: 6,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Pencil size={12} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onBackToMain}
        hitSlop={8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          gap: 4,
        }}
      >
        <ArrowLeft size={12} color={theme.textSecondary} />
        <Text style={{ fontSize: 11, fontWeight: "500", color: theme.textSecondary }}>Main</Text>
      </TouchableOpacity>
    </View>
  );
}
