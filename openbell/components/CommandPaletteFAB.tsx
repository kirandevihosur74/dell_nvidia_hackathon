import { useState, useCallback } from "react";
import { TouchableOpacity } from "react-native";
import { Command } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { CommandPalette } from "./CommandPalette";
import { SubagentPicker } from "./openclaw/SubagentPicker";
import { sessionManager } from "@/services/gateway/sessionManager";
import { useGatewayStore } from "@/stores/gatewayStore";
import type { Subagent } from "@/services/openclaw/subagentRegistry";

interface CommandPaletteFABProps {
  onResetSession?: () => void;
  onAbort?: () => void;
}

export function CommandPaletteFAB({ onResetSession, onAbort }: CommandPaletteFABProps) {
  const { theme } = useThemeStore();
  const [visible, setVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);

  const handleSpawn = useCallback(() => {
    setPickerVisible(true);
  }, []);

  const handlePickAgent = useCallback((agent: Subagent) => {
    const sessionName = agent.name;
    sessionManager.createSession(sessionName, undefined, {
      agentId: agent.id,
      systemPrompt: agent.systemPrompt,
    });

    // Sync sessions to store
    const { setSessions, setActiveSession } = useGatewayStore.getState();
    setSessions(sessionManager.getSessions());
    setActiveSession(sessionManager.getActiveSessionId());

    setPickerVisible(false);
  }, []);

  return (
    <>
      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          bottom: 86,
          left: 16,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.primary,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 100,
          opacity: 0.9,
        }}
      >
        <Command size={20} color="#FFF" />
      </TouchableOpacity>

      <CommandPalette
        visible={visible}
        onClose={handleClose}
        onSpawnSession={handleSpawn}
        onResetSession={onResetSession}
        onAbort={onAbort}
      />

      <SubagentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handlePickAgent}
      />
    </>
  );
}
