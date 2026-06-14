import { View, Text, ScrollView, Switch, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Key, Cpu, Mic, Volume2, ChevronLeft } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { api } from "@/services/apiClient";
import { saveSecure, getSecure } from "@/utils/secureStore";
import type { LLMProvider } from "@/types/settings";

/* ── Shared UI ──────────────────────────────────────────────── */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
          {title}
        </Text>
      </View>
      <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

function Row({ label, description, right }: { label: string; description?: string; right: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 15, color: theme.text }}>{label}</Text>
        {description && <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>{description}</Text>}
      </View>
      {right}
    </View>
  );
}

function SetupKeyRow({ label, field, placeholder }: { label: string; field: string; placeholder?: string }) {
  const { theme } = useThemeStore();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    getSecure(`settings_${field}`).then((v) => {
      if (v) setHasValue(true);
    });
  }, [field]);

  const handleSave = async () => {
    if (!value.trim()) return;
    await saveSecure(`settings_${field}`, value.trim());
    setHasValue(true);
    api.updateSettings({ [field]: value.trim() }).catch(() => {});
    setValue("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (hasValue && !saved) {
    return (
      <Row
        label={label}
        description="Stored securely"
        right={
          <TouchableOpacity onPress={() => setHasValue(false)}>
            <Text style={{ fontSize: 13, color: theme.primary }}>Change</Text>
          </TouchableOpacity>
        }
      />
    );
  }

  if (saved) {
    return <Row label={label} description="Stored securely" right={<Text style={{ fontSize: 12, color: theme.success }}>Saved</Text>} />;
  }

  return (
    <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border, gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder || "Paste key..."}
          placeholderTextColor={theme.textTertiary}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.text }}
        />
        <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Setup Screen ───────────────────────────────────────────── */

export default function SetupScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { complete, skip } = useOnboardingStore();
  const { defaultLlm, setDefaultLlm, voiceInputEnabled, setVoiceInput, voiceOutputEnabled, setVoiceOutput } = useSettingsStore();

  const llmOptions: { id: LLMProvider; label: string }[] = [
    { id: "gemini", label: "Gemini" },
    { id: "claude", label: "Claude" },
    { id: "openai", label: "OpenAI" },
  ];

  const handleFinish = () => {
    complete();
    router.replace("/(tabs)/openclaw");
  };

  const handleSkip = () => {
    skip();
    router.replace("/(tabs)/openclaw");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={20} color={theme.primary} />
          <Text style={{ fontSize: 15, color: theme.primary }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "600", color: theme.text }}>Setup</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={{ fontSize: 15, color: theme.textTertiary }}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 48 }}>
        {/* Intro */}
        <Text style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 20 }}>
          Configure your integrations below. You can always change these later in Settings.
        </Text>

        {/* Asana Connection */}
        <Section title="Asana Connection" icon={<Key size={14} color={theme.textTertiary} />}>
          <SetupKeyRow label="Asana PAT" field="asana_pat" placeholder="Paste Asana Personal Access Token..." />
          <SetupKeyRow label="Workspace ID" field="default_workspace_id" placeholder="Paste Workspace ID..." />
          <SetupKeyRow label="Project ID" field="default_project_id" placeholder="Paste Project ID..." />
        </Section>

        {/* AI Provider */}
        <Section title="AI Provider" icon={<Cpu size={14} color={theme.textTertiary} />}>
          <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
            {llmOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  setDefaultLlm(opt.id);
                  api.updateSettings({ default_llm: opt.id }).catch(() => {});
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: defaultLlm === opt.id ? theme.primary : theme.background,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: defaultLlm === opt.id ? "#FFFFFF" : theme.textSecondary }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <SetupKeyRow label="Gemini API Key" field="gemini_api_key" />
          <SetupKeyRow label="Claude API Key" field="claude_api_key" />
          <SetupKeyRow label="OpenAI API Key" field="openai_api_key" />
        </Section>

        {/* Voice */}
        <Section title="Voice" icon={<Mic size={14} color={theme.textTertiary} />}>
          <Row label="Voice Input" description="Speak to send messages" right={<Switch value={voiceInputEnabled} onValueChange={setVoiceInput} />} />
          <Row label="Voice Output" description="Listen to AI responses" right={<Switch value={voiceOutputEnabled} onValueChange={setVoiceOutput} />} />
          {(voiceInputEnabled || voiceOutputEnabled) && (
            <SetupKeyRow label="ElevenLabs API Key" field="elevenlabs_api_key" />
          )}
        </Section>

        {/* Finish */}
        <TouchableOpacity
          onPress={handleFinish}
          style={{ backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Finish Setup</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
