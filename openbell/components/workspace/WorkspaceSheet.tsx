import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { FileText, BookOpen, Brain, Clock, Zap, X, FolderOpen } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useWorkspaceStore, type WorkspaceTab } from "@/stores/workspaceStore";
import { FileBrowser } from "./FileBrowser";
import { FileEditor } from "./FileEditor";
import { ConfigPanel } from "./ConfigPanel";
import { MemoryPanel } from "./MemoryPanel";
import { CronPanel } from "./CronPanel";

const SUB_TABS: { key: WorkspaceTab; label: string; icon: typeof FileText }[] = [
  { key: "files", label: "Files", icon: FileText },
  { key: "memory", label: "Memory", icon: BookOpen },
  { key: "config", label: "Config", icon: Brain },
  { key: "crons", label: "Crons", icon: Clock },
  { key: "skills", label: "Skills", icon: Zap },
];

interface WorkspaceSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function WorkspaceSheet({ visible, onClose }: WorkspaceSheetProps) {
  const { theme } = useThemeStore();
  const activeAgentId = useGatewayStore((s) => s.activeAgentId);
  const { activeTab, activeFile, setActiveTab, clearFile } = useWorkspaceStore();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["70%", "95%"], []);

  const handleSubTabSelect = useCallback(
    (tab: WorkspaceTab) => {
      clearFile();
      setActiveTab(tab);
    },
    [clearFile, setActiveTab]
  );

  const handleClose = useCallback(() => {
    clearFile();
    onClose();
  }, [clearFile, onClose]);

  // Clear stale file state when sheet becomes visible
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      clearFile();
    }
    prevVisibleRef.current = visible;
  }, [visible, clearFile]);

  if (!visible) return null;

  const showEditor = activeFile && activeAgentId;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={{ backgroundColor: theme.background }}
      handleIndicatorStyle={{ backgroundColor: theme.textTertiary }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {showEditor ? (
          <FileEditor agentId={activeAgentId} />
        ) : (
          <>
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingTop: 4,
                paddingBottom: 8,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "700", color: theme.text }}>Workspace</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <X size={20} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Sub-tab bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
              style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: theme.border, paddingVertical: 8 }}
            >
              {SUB_TABS.map(({ key, label, icon: Icon }) => {
                const isActive = activeTab === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleSubTabSelect(key)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isActive ? theme.primary + "15" : "transparent",
                      borderWidth: 1,
                      borderColor: isActive ? theme.primary + "30" : theme.border,
                      gap: 6,
                    }}
                  >
                    <Icon size={14} color={isActive ? theme.primary : theme.textTertiary} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? "600" : "400",
                        color: isActive ? theme.primary : theme.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Content */}
            {!activeAgentId ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                <FolderOpen size={40} color={theme.textTertiary} />
                <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12, textAlign: "center" }}>
                  Select an agent to browse its workspace
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                {activeTab === "files" && <FileBrowser agentId={activeAgentId} />}
                {activeTab === "memory" && <MemoryPanel agentId={activeAgentId} />}
                {activeTab === "config" && <ConfigPanel agentId={activeAgentId} />}
                {activeTab === "crons" && <CronPanel agentId={activeAgentId} />}
                {activeTab === "skills" && (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
                    <Zap size={40} color={theme.textTertiary} />
                    <Text style={{ fontSize: 14, color: theme.textTertiary, marginTop: 12, textAlign: "center" }}>
                      Visit the Skills tab for the full skill browser
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
