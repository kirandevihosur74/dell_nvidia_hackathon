import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, Modal } from "react-native";
import { Settings, Store, Download, X } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { useThemeStore } from "@/stores/themeStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { gatewayClient, makeIdempotencyKey } from "@/services/gateway";
import { useSkills } from "@/hooks/useSkills";
import { SkillBrowser } from "@/components/openclaw/SkillBrowser";
import { SkillDetail } from "@/components/openclaw/SkillDetail";
import { useToastStore } from "@/stores/toastStore";
import type { OpenClawSkill } from "@/types/skills";

export default function SkillsScreen() {
  const { theme } = useThemeStore();
  const {
    skills,
    searchQuery,
    activeCategory,
    loading,
    isConnected,
    setSearchQuery,
    setActiveCategory,
    toggleFavorite,
    fetchSkills,
    invokeSkill,
  } = useSkills();

  const [selectedSkill, setSelectedSkill] = useState<OpenClawSkill | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installName, setInstallName] = useState("");
  const [installing, setInstalling] = useState(false);
  const { activeSessionId, connectionStatus } = useGatewayStore();

  const handleInstallSkill = useCallback(async () => {
    const name = installName.trim();
    if (!name || connectionStatus !== "connected") return;

    setInstalling(true);
    try {
      const sessionKey = activeSessionId || "main";
      const command = `Install the ClawHub skill "${name}" by running: npx clawhub@latest install ${name}`;
      await gatewayClient.request("chat.send", {
        sessionKey,
        message: command,
        deliver: false,
        idempotencyKey: makeIdempotencyKey(),
      });
      useToastStore.getState().success(`Installing "${name}" via agent...`);
      setInstallName("");
      setShowInstall(false);
      // Refresh skills after a delay to pick up the new one
      setTimeout(() => fetchSkills(), 10000);
    } catch {
      Alert.alert("Install Failed", "Could not send install command to agent. Make sure the Gateway is connected.");
    } finally {
      setInstalling(false);
    }
  }, [installName, connectionStatus, activeSessionId, fetchSkills]);

  // Fetch skills on mount if connected
  useEffect(() => {
    if (isConnected && skills.length === 0) {
      fetchSkills();
    }
  }, [isConnected, skills.length, fetchSkills]);

  const handleInvoke = useCallback(
    (params: Record<string, unknown>) => {
      if (!selectedSkill) return;
      invokeSkill(selectedSkill, params);
      setSelectedSkill(null);
    },
    [selectedSkill, invokeSkill]
  );

  if (selectedSkill) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <SkillDetail
          skill={selectedSkill}
          onInvoke={handleInvoke}
          onToggleFavorite={() => toggleFavorite(selectedSkill.id)}
          onBack={() => setSelectedSkill(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header — large title with settings icon */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text }}>Skills</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isConnected && (
            <TouchableOpacity
              onPress={() => setShowInstall(true)}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 18,
                backgroundColor: theme.primary + "15",
                borderWidth: 1,
                borderColor: theme.primary + "30",
              }}
            >
              <Download size={14} color={theme.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }}>Install</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => WebBrowser.openBrowserAsync("https://clawhub.ai")}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 18,
              backgroundColor: theme.success + "15",
              borderWidth: 1,
              borderColor: theme.success + "30",
            }}
          >
            <Store size={14} color={theme.success} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.success }}>ClawHub</Text>
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Settings size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <SkillBrowser
        skills={skills}
        searchQuery={searchQuery}
        activeCategory={activeCategory}
        loading={loading}
        isConnected={isConnected}
        onSearchChange={setSearchQuery}
        onCategoryChange={setActiveCategory}
        onSelectSkill={setSelectedSkill}
        onToggleFavorite={toggleFavorite}
        onRefresh={fetchSkills}
      />

      {/* Install Skill Modal */}
      <Modal visible={showInstall} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowInstall(false)}
          />
          <View
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 10,
              gap: 16,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text }}>Install from ClawHub</Text>
              <TouchableOpacity onPress={() => setShowInstall(false)} hitSlop={8}>
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: theme.textTertiary, lineHeight: 18 }}>
              Enter a skill name from clawhub.ai. Your agent will run the install command.
            </Text>

            <TextInput
              value={installName}
              onChangeText={setInstallName}
              placeholder="e.g. blogwatcher, 1password, notion"
              placeholderTextColor={theme.textTertiary}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: theme.text,
                backgroundColor: theme.background,
              }}
              onSubmitEditing={handleInstallSkill}
            />

            <TouchableOpacity
              onPress={handleInstallSkill}
              disabled={installing || !installName.trim()}
              activeOpacity={0.7}
              style={{
                backgroundColor: !installName.trim() ? theme.textTertiary : theme.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Download size={16} color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>
                {installing ? "Installing..." : "Install Skill"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
