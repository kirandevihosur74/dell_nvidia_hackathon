import { View, Text, TouchableOpacity } from "react-native";
import { Bot, Check, X, ArrowRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useThemeStore } from "@/stores/themeStore";
import type { KanbanProposal } from "@/types/gateway";

const ACTION_LABELS: Record<string, string> = {
  create: "Create task",
  update: "Update task",
  move: "Move task",
  complete: "Complete task",
};

interface ProposalQueueProps {
  proposals: KanbanProposal[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ProposalQueue({ proposals, onApprove, onReject }: ProposalQueueProps) {
  const { theme } = useThemeStore();

  if (proposals.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Bot size={13} color={theme.warning} />
        <Text style={{ fontSize: 11, fontWeight: "700", color: theme.warning, textTransform: "uppercase", letterSpacing: 1 }}>
          Agent Proposals ({proposals.length})
        </Text>
      </View>

      {proposals.map((proposal) => (
        <View
          key={proposal.id}
          style={{
            backgroundColor: theme.warning + "08",
            borderWidth: 1,
            borderColor: theme.warning + "25",
            borderRadius: 10,
            padding: 12,
            gap: 6,
          }}
        >
          {/* Action header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <ArrowRight size={12} color={theme.warning} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.warning }}>
              {ACTION_LABELS[proposal.action] || proposal.action}
            </Text>
            {proposal.payload.title && (
              <Text style={{ fontSize: 12, color: theme.text, fontWeight: "500", flex: 1 }} numberOfLines={1}>
                : {proposal.payload.title}
              </Text>
            )}
          </View>

          {/* Reason */}
          <Text style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={3}>
            {proposal.reason}
          </Text>

          {/* Agent + actions */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 10, color: theme.textTertiary }}>
              Agent: {proposal.agentId.slice(0, 8)}
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                  onReject(proposal.id);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: theme.error + "15",
                }}
              >
                <X size={12} color={theme.error} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: theme.error }}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  onApprove(proposal.id);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: theme.success + "15",
                }}
              >
                <Check size={12} color={theme.success} />
                <Text style={{ fontSize: 11, fontWeight: "600", color: theme.success }}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
