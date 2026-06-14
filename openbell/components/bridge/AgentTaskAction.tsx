import { View, Text, TouchableOpacity, TextInput, Alert } from "react-native";
import { useState } from "react";
import { MessageSquare, Zap, Send } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import type { AsanaTask } from "@/types/asana";

interface AgentTaskActionProps {
  task: AsanaTask;
  isAgentConnected: boolean;
  onAskAgent: (task: AsanaTask, question?: string) => void;
  onDelegateToAgent: (task: AsanaTask, instructions?: string) => void;
}

export function AgentTaskAction({ task, isAgentConnected, onAskAgent, onDelegateToAgent }: AgentTaskActionProps) {
  const { theme } = useThemeStore();
  const [showAskInput, setShowAskInput] = useState(false);
  const [question, setQuestion] = useState("");

  if (!isAgentConnected) return null;

  const handleAsk = () => {
    if (showAskInput && question.trim()) {
      onAskAgent(task, question.trim());
      setQuestion("");
      setShowAskInput(false);
    } else if (showAskInput) {
      // Send without question
      onAskAgent(task);
      setShowAskInput(false);
    } else {
      setShowAskInput(true);
    }
  };

  const handleDelegate = () => {
    Alert.alert(
      "Delegate to Agent",
      `Send "${task.name}" to your ClawMobile.app agent for autonomous work?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delegate",
          onPress: () => onDelegateToAgent(task),
        },
      ]
    );
  };

  return (
    <View style={{ gap: 8 }}>
      {/* Ask input */}
      {showAskInput && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask something about this task..."
            placeholderTextColor={theme.textTertiary}
            style={{
              flex: 1,
              backgroundColor: theme.background,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 13,
              color: theme.text,
              borderWidth: 1,
              borderColor: theme.border,
            }}
            autoFocus
            onSubmitEditing={handleAsk}
          />
          <TouchableOpacity
            onPress={handleAsk}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.primary,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Send size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={handleAsk}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: theme.primary + "15",
            borderWidth: 1,
            borderColor: theme.primary + "30",
          }}
          activeOpacity={0.6}
        >
          <MessageSquare size={14} color={theme.primary} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>
            Ask Agent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelegate}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: theme.warning + "15",
            borderWidth: 1,
            borderColor: theme.warning + "30",
          }}
          activeOpacity={0.6}
        >
          <Zap size={14} color={theme.warning} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.warning }}>
            Delegate
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
