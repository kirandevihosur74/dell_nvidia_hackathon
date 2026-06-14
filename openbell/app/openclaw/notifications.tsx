import { View, Text, Switch, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { Bell, Clock, ChevronLeft, CheckCircle, AlertTriangle, MessageSquare, Zap } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import {
  loadPreferences,
  savePreferences,
  CATEGORY_META,
  type NotificationPreferences,
  type NotificationCategory,
} from "@/services/openclawPushPrefs";

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  "check-circle": CheckCircle,
  clock: Clock,
  "alert-triangle": AlertTriangle,
  "message-square": MessageSquare,
  zap: Zap,
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    loadPreferences().then(setPrefs);
  }, []);

  const updatePrefs = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!prefs) return;
      const updated = { ...prefs, ...updates };
      setPrefs(updated);
      await savePreferences(updated);
    },
    [prefs]
  );

  const toggleCategory = useCallback(
    async (category: NotificationCategory) => {
      if (!prefs) return;
      const updated = {
        ...prefs,
        categories: {
          ...prefs.categories,
          [category]: !prefs.categories[category],
        },
      };
      setPrefs(updated);
      await savePreferences(updated);
    },
    [prefs]
  );

  if (!prefs) return null;

  const categories = Object.entries(CATEGORY_META) as [NotificationCategory, typeof CATEGORY_META[NotificationCategory]][];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text }}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        {/* Master Toggle */}
        <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Bell size={20} color={theme.primary} />
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.text }}>Push Notifications</Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary }}>Receive alerts from your agent</Text>
              </View>
            </View>
            <Switch value={prefs.enabled} onValueChange={(v) => updatePrefs({ enabled: v })} />
          </View>
        </View>

        {/* Categories */}
        {prefs.enabled && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              Categories
            </Text>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
              {categories.map(([key, meta], index) => {
                const Icon = CATEGORY_ICONS[meta.icon] || Bell;
                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderBottomWidth: index < categories.length - 1 ? 0.5 : 0,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <Icon size={18} color={theme.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: theme.text }}>{meta.label}</Text>
                        <Text style={{ fontSize: 11, color: theme.textTertiary }}>{meta.description}</Text>
                      </View>
                    </View>
                    <Switch
                      value={prefs.categories[key]}
                      onValueChange={() => toggleCategory(key)}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Quiet Hours */}
        {prefs.enabled && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
              Quiet Hours
            </Text>
            <View style={{ backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Clock size={18} color={theme.textSecondary} />
                  <View>
                    <Text style={{ fontSize: 14, color: theme.text }}>Quiet Hours</Text>
                    <Text style={{ fontSize: 11, color: theme.textTertiary }}>Mute notifications during set hours</Text>
                  </View>
                </View>
                <Switch
                  value={prefs.quietHoursEnabled}
                  onValueChange={(v) => updatePrefs({ quietHoursEnabled: v })}
                />
              </View>
              {prefs.quietHoursEnabled && (
                <View style={{ flexDirection: "row", padding: 14, gap: 16 }}>
                  <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11, color: theme.textTertiary }}>START</Text>
                    <View style={{ backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.border }}>
                      <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>
                        {prefs.quietHoursStart}
                      </Text>
                    </View>
                  </View>
                  <View style={{ justifyContent: "center", paddingTop: 16 }}>
                    <Text style={{ fontSize: 14, color: theme.textTertiary }}>to</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11, color: theme.textTertiary }}>END</Text>
                    <View style={{ backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: theme.border }}>
                      <Text style={{ fontSize: 18, fontWeight: "600", color: theme.text, fontVariant: ["tabular-nums"] }}>
                        {prefs.quietHoursEnd}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Info */}
        <Text style={{ fontSize: 12, color: theme.textTertiary, lineHeight: 18, paddingHorizontal: 4 }}>
          When your ClawMobile.app agent completes tasks, sends reminders, or detects alerts, you'll receive notifications here. Notifications are delivered via WebSocket when the app is open, or via push when backgrounded.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
