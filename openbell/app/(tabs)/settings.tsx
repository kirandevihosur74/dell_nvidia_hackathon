import { View, Text, ScrollView, Switch, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Key, Cpu, Mic, Volume2, Bell, Moon, Trash2, Info, Server, Shield, ChevronRight, Radio, MessageSquareDashed, Palette, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { StreamSettingsSection } from "@/components/streamio/settings/StreamSettingsSection";
import { StreamAuthUpgrade } from "@/components/streamio/settings/StreamAuthUpgrade";
import { SlackSettingsSection } from "@/components/messenger/SlackSettingsSection";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeStore, themes } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useGatewayStore } from "@/stores/gatewayStore";
import { useEncryptionStore } from "@/stores/encryptionStore";
import { api, setApiBaseUrl, getApiBaseUrl } from "@/services/apiClient";
import { clearOfflineCache, getCacheSize } from "@/services/offlineService";
import { saveSecure, getSecure } from "@/utils/secureStore";
import type { LLMProvider } from "@/types/settings";

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

function ApiKeyRow({ label, field }: { label: string; field: string }) {
  const { theme } = useThemeStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    getSecure(`settings_${field}`).then((v) => {
      if (v) setHasValue(true);
    });
  }, [field]);

  const handleSave = async () => {
    try {
      // Always save locally first
      await saveSecure(`settings_${field}`, value);
      setHasValue(true);

      // Try to sync to backend (non-blocking)
      api.updateSettings({ [field]: value }).catch(() => {
        // Backend unavailable — local save is sufficient
      });

      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Alert.alert("Save Failed", "Could not save the setting. Please try again.");
    }
  };

  if (editing) {
    return (
      <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border, gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>{label}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Paste API key..."
            placeholderTextColor={theme.textTertiary}
            secureTextEntry
            style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.text }}
          />
          <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Row
      label={label}
      description={hasValue ? "Stored securely" : undefined}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {saved && <Text style={{ fontSize: 12, color: theme.success }}>Saved</Text>}
          <TouchableOpacity onPress={() => { setEditing(true); setValue(""); }}>
            <Text style={{ fontSize: 13, color: theme.primary }}>{hasValue ? "Change" : "Set"}</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

function ApiUrlRow() {
  const { theme } = useThemeStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    getApiBaseUrl().then(setCurrentUrl);
  }, []);

  const handleSave = async () => {
    const url = value.trim().replace(/\/+$/, "");
    if (!url) return;
    await setApiBaseUrl(url);
    setCurrentUrl(url);
    setEditing(false);
    Alert.alert("Saved", "API URL updated. Board will use this on next load.");
  };

  if (editing) {
    return (
      <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border, gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>API Server URL</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="http://192.168.1.x:8000"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.text }}
          />
          <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>
          Use your machine's LAN IP when connecting from a phone.
        </Text>
      </View>
    );
  }

  return (
    <Row
      label="API Server URL"
      description={currentUrl || "Not set"}
      right={
        <TouchableOpacity onPress={() => { setEditing(true); setValue(currentUrl); }}>
          <Text style={{ fontSize: 13, color: theme.primary }}>Change</Text>
        </TouchableOpacity>
      }
    />
  );
}

const INFERENCE_MODES = [
  { id: "gb10" as const, label: "GB10 · Nemotron", desc: "Local model on the Dell GB10 (Ollama)" },
  { id: "local_openrouter" as const, label: "Local · OpenRouter", desc: "Local backend → OpenRouter Nemotron mirror" },
];

function InferenceSection() {
  const { theme } = useThemeStore();
  const inferenceMode = useSettingsStore((s) => s.inferenceMode);
  const gb10Url = useSettingsStore((s) => s.gb10Url);
  const localUrl = useSettingsStore((s) => s.localUrl);
  const setInferenceMode = useSettingsStore((s) => s.setInferenceMode);
  const setGb10Url = useSettingsStore((s) => s.setGb10Url);
  const setLocalUrl = useSettingsStore((s) => s.setLocalUrl);
  const loadInferenceConfig = useSettingsStore((s) => s.loadInferenceConfig);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => { loadInferenceConfig(); }, [loadInferenceConfig]);

  const activeUrl = inferenceMode === "gb10" ? gb10Url : localUrl;

  const handleSaveUrl = async () => {
    const url = value.trim().replace(/\/+$/, "");
    if (!url) return;
    if (inferenceMode === "gb10") await setGb10Url(url);
    else await setLocalUrl(url);
    setEditing(false);
  };

  return (
    <Section title="Inference Backend" icon={<Server size={14} color={theme.textTertiary} />}>
      <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
        {INFERENCE_MODES.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => { Haptics.selectionAsync(); setInferenceMode(m.id); }}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: inferenceMode === m.id ? theme.primary : theme.background,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", textAlign: "center", color: inferenceMode === m.id ? "#FFFFFF" : theme.textSecondary }}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 11, color: theme.textTertiary, paddingHorizontal: 16, paddingBottom: 8 }}>
        {INFERENCE_MODES.find((m) => m.id === inferenceMode)?.desc}
      </Text>
      {editing ? (
        <View style={{ padding: 16, borderTopWidth: 0.5, borderTopColor: theme.border, gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>
            {inferenceMode === "gb10" ? "GB10 backend URL" : "Local backend URL"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="http://192.168.1.x:5001"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.text }}
            />
            <TouchableOpacity onPress={handleSaveUrl} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>
            Use your machine's LAN IP from a phone. Port 5001 is the trading backend.
          </Text>
        </View>
      ) : (
        <Row
          label="Backend URL"
          description={activeUrl || "Not set"}
          right={
            <TouchableOpacity onPress={() => { setEditing(true); setValue(activeUrl); }}>
              <Text style={{ fontSize: 13, color: theme.primary }}>Change</Text>
            </TouchableOpacity>
          }
        />
      )}
    </Section>
  );
}

function NerveUrlRow() {
  const { theme } = useThemeStore();
  const { nerveUrl, setNerveUrl } = useSettingsStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nerveUrl);

  const handleSave = () => {
    const url = value.trim().replace(/\/+$/, "");
    if (!url) return;
    setNerveUrl(url);
    setEditing(false);
    Alert.alert("Saved", "Nerve URL updated. Kanban and Crons will use this URL.");
  };

  if (editing) {
    return (
      <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border, gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text }}>Nerve URL</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="http://100.103.105.64:3080"
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            style={{ flex: 1, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.text }}
          />
          <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, borderRadius: 8, justifyContent: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Save</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>
          Kanban and Crons connect to Nerve. Use your machine's IP for real devices.
        </Text>
      </View>
    );
  }

  return (
    <Row
      label="Nerve URL"
      description={nerveUrl || "Not set"}
      right={
        <TouchableOpacity onPress={() => { setEditing(true); setValue(nerveUrl); }}>
          <Text style={{ fontSize: 13, color: theme.primary }}>Change</Text>
        </TouchableOpacity>
      }
    />
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, mode, activeThemeKey, toggleMode, setTheme, loadPersisted: loadTheme } = useThemeStore();
  const { defaultLlm, setDefaultLlm, voiceInputEnabled, setVoiceInput, voiceOutputEnabled, setVoiceOutput, voiceProfile, setVoiceProfile, notificationsEnabled, setNotifications, nerveUrl, setNerveUrl } =
    useSettingsStore();
  type VoiceProfileOption = import("@/stores/settingsStore").VoiceProfileOption;
  const { gateways, connectionStatus, activeGatewayId } = useGatewayStore();
  const { enabled: encryptionEnabled } = useEncryptionStore();
  const activeGateway = gateways.find((g) => g.id === activeGatewayId);
  const [cacheSize, setCacheSize] = useState("0 KB");

  useEffect(() => {
    getCacheSize().then((bytes) => {
      setCacheSize(bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
    });
  }, []);

  const llmOptions: { id: LLMProvider; label: string }[] = [
    { id: "gemini", label: "Gemini" },
    { id: "claude", label: "Claude" },
    { id: "openai", label: "OpenAI" },
  ];

  const handleClearCache = () => {
    Alert.alert("Clear Cache", "This will remove all cached conversations and tasks.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearOfflineCache();
          setCacheSize("0 B");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 48 }}>
        {/* OpenClaw Gateway */}
        <Section title="ClawMobile.app Gateway" icon={<Server size={14} color={theme.textTertiary} />}>
          <Row
            label="Active Gateway"
            description={activeGateway ? `${activeGateway.host}:${activeGateway.port}` : "No gateway connected"}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connectionStatus === "connected" ? theme.success : connectionStatus === "connecting" ? theme.warning : theme.textTertiary }} />
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                  {activeGateway?.name || "None"}
                </Text>
              </View>
            }
          />
          <Row
            label="Paired Gateways"
            right={<Text style={{ fontSize: 14, color: theme.textSecondary }}>{gateways.filter((g) => g.isPaired).length} / {gateways.length}</Text>}
          />
        </Section>

        {/* OpenClaw Security & Notifications */}
        <Section title="ClawMobile.app Settings" icon={<Shield size={14} color={theme.textTertiary} />}>
          <TouchableOpacity onPress={() => router.push("/openclaw/encryption")}>
            <Row
              label="Encryption"
              description="End-to-end encryption settings"
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13, color: encryptionEnabled ? theme.success : theme.textTertiary }}>
                    {encryptionEnabled ? "On" : "Off"}
                  </Text>
                  <ChevronRight size={14} color={theme.textTertiary} />
                </View>
              }
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/openclaw/notifications")}>
            <Row
              label="Notifications"
              description="Agent push notification preferences"
              right={<ChevronRight size={14} color={theme.textTertiary} />}
            />
          </TouchableOpacity>
        </Section>

        {/* API Keys */}
        <Section title="API Keys" icon={<Key size={14} color={theme.textTertiary} />}>
          <ApiUrlRow />
          <ApiKeyRow label="Asana PAT" field="asana_pat" />
          <ApiKeyRow label="Workspace ID" field="default_workspace_id" />
          <ApiKeyRow label="Project ID" field="default_project_id" />
          <ApiKeyRow label="Gemini API Key" field="gemini_api_key" />
          <ApiKeyRow label="Claude API Key" field="claude_api_key" />
          <ApiKeyRow label="OpenAI API Key" field="openai_api_key" />
          <ApiKeyRow label="ElevenLabs API Key" field="elevenlabs_api_key" />
        </Section>

        {/* Inference Backend — GB10 (local Nemotron) vs local backend + OpenRouter */}
        <InferenceSection />

        {/* AI Provider */}
        <Section title="AI Provider" icon={<Cpu size={14} color={theme.textTertiary} />}>
          <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
            {llmOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  setDefaultLlm(opt.id);
                  api.updateSettings({ default_llm: opt.id });
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
        </Section>

        {/* Voice */}
        <Section title="Voice" icon={<Mic size={14} color={theme.textTertiary} />}>
          <Row label="Voice Input" description="ElevenLabs STT — speak to send" right={<Switch value={voiceInputEnabled} onValueChange={setVoiceInput} />} />
          <Row label="Voice Output" description="ElevenLabs TTS — listen to responses" right={<Switch value={voiceOutputEnabled} onValueChange={setVoiceOutput} />} />
          {voiceOutputEnabled && (
            <View style={{ padding: 12, gap: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: theme.textSecondary }}>Voice Profile</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {([
                  { id: "auto" as VoiceProfileOption, label: "Auto", desc: "Detect from content" },
                  { id: "general" as VoiceProfileOption, label: "Sarah", desc: "Warm & friendly" },
                  { id: "technical" as VoiceProfileOption, label: "Daniel", desc: "Clear & precise" },
                  { id: "warning" as VoiceProfileOption, label: "Charlotte", desc: "Expressive" },
                  { id: "discovery" as VoiceProfileOption, label: "Lily", desc: "Curious & light" },
                  { id: "success" as VoiceProfileOption, label: "Gigi", desc: "Upbeat & bright" },
                  { id: "professional" as VoiceProfileOption, label: "Liam", desc: "Professional" },
                ]).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setVoiceProfile(v.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: voiceProfile === v.id ? theme.primary : theme.background,
                      borderWidth: 1,
                      borderColor: voiceProfile === v.id ? theme.primary : theme.border,
                      alignItems: "center",
                      minWidth: 72,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: voiceProfile === v.id ? "#FFFFFF" : theme.text }}>{v.label}</Text>
                    <Text style={{ fontSize: 10, color: voiceProfile === v.id ? "rgba(255,255,255,0.7)" : theme.textTertiary, marginTop: 1 }}>{v.desc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ fontSize: 12, fontWeight: "500", color: theme.textTertiary, marginTop: 2 }}>Nigerian Voices</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {([
                  { id: "fisayo" as VoiceProfileOption, label: "Fisayo", desc: "Young & vibrant" },
                  { id: "dayo" as VoiceProfileOption, label: "Dayo", desc: "Confident" },
                  { id: "olaniyi" as VoiceProfileOption, label: "Olaniyi", desc: "Warm & calming" },
                  { id: "paulina" as VoiceProfileOption, label: "Paulina", desc: "Calm & conversational" },
                  { id: "dr_abebe" as VoiceProfileOption, label: "Dr. Abebe", desc: "Crisp narrator" },
                  { id: "muyiwa" as VoiceProfileOption, label: "Muyiwa", desc: "Casual & informative" },
                  { id: "victor" as VoiceProfileOption, label: "Victor", desc: "Deep & narrative" },
                ]).map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setVoiceProfile(v.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: voiceProfile === v.id ? theme.primary : theme.background,
                      borderWidth: 1,
                      borderColor: voiceProfile === v.id ? theme.primary : theme.border,
                      alignItems: "center",
                      minWidth: 72,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: voiceProfile === v.id ? "#FFFFFF" : theme.text }}>{v.label}</Text>
                    <Text style={{ fontSize: 10, color: voiceProfile === v.id ? "rgba(255,255,255,0.7)" : theme.textTertiary, marginTop: 1 }}>{v.desc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </Section>

        {/* Slack Integration */}
        <Section title="Slack Integration" icon={<MessageSquareDashed size={14} color={theme.textTertiary} />}>
          <SlackSettingsSection />
        </Section>

        {/* StreamIO */}
        <Section title="StreamIO" icon={<Radio size={14} color={theme.textTertiary} />}>
          <StreamSettingsSection />
          <StreamAuthUpgrade />
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={14} color={theme.textTertiary} />}>
          <Row label="Push Notifications" description="Task updates and reminders" right={<Switch value={notificationsEnabled} onValueChange={setNotifications} />} />
        </Section>

        {/* Nerve */}
        <Section title="Nerve" icon={<Server size={14} color={theme.textTertiary} />}>
          <NerveUrlRow />
        </Section>

        {/* Appearance */}
        <Section title="Appearance" icon={<Palette size={14} color={theme.textTertiary} />}>
          <View style={{ padding: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Theme
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {themes.map((t) => {
                const isActive = activeThemeKey === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => { Haptics.selectionAsync().catch(() => {}); setTheme(t.key); }}
                    activeOpacity={0.7}
                    style={{
                      width: 72,
                      height: 64,
                      borderRadius: 10,
                      backgroundColor: t.colors.background,
                      borderWidth: isActive ? 2 : 1,
                      borderColor: isActive ? t.colors.primary : theme.border,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      paddingBottom: 6,
                      overflow: "hidden",
                    }}
                  >
                    {/* Color preview dots */}
                    <View style={{ flexDirection: "row", gap: 3, marginBottom: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary }} />
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.success }} />
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.error }} />
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: "600", color: t.colors.text }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    {isActive && (
                      <View style={{ position: "absolute", top: 4, right: 4 }}>
                        <Check size={12} color={t.colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Section>

        {/* Data */}
        <Section title="Data" icon={<Trash2 size={14} color={theme.textTertiary} />}>
          <Row label="Cache Size" right={<Text style={{ fontSize: 14, color: theme.textSecondary }}>{cacheSize}</Text>} />
          <Row
            label="Clear Cache"
            description="Remove cached conversations and tasks"
            right={
              <TouchableOpacity onPress={handleClearCache}>
                <Text style={{ fontSize: 13, color: theme.error }}>Clear</Text>
              </TouchableOpacity>
            }
          />
        </Section>

        {/* About */}
        <Section title="About" icon={<Info size={14} color={theme.textTertiary} />}>
          <Row label="Version" right={<Text style={{ fontSize: 14, color: theme.textSecondary }}>1.0.0</Text>} />
          <Row label="Built with" right={<Text style={{ fontSize: 14, color: theme.textSecondary }}>Expo + React Native</Text>} />
          <Row
            label="Onboarding"
            description="Run the setup flow again"
            right={
              <TouchableOpacity onPress={async () => {
                await AsyncStorage.removeItem("onboarding_completed");
                router.replace("/onboarding");
              }}>
                <Text style={{ fontSize: 13, color: theme.primary }}>Run</Text>
              </TouchableOpacity>
            }
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
