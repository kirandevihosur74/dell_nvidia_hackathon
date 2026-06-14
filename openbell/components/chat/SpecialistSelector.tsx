import { ScrollView, TouchableOpacity, Text, View } from "react-native";
import { Bot, CheckSquare, CalendarDays, Settings } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";
import { specialists } from "@/constants/specialists";

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  bot: Bot,
  "check-square": CheckSquare,
  calendar: CalendarDays,
  settings: Settings,
};

export function SpecialistSelector() {
  const { theme } = useThemeStore();
  const { specialist, setSpecialist, setActiveConversation, setMessages, setStreamingContent } = useChatStore();

  const handleSelect = (id: string) => {
    if (id === specialist) return;
    setSpecialist(id);
    // Start a fresh conversation for this specialist
    setActiveConversation(null);
    setMessages([]);
    setStreamingContent("");
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 48, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" }}
    >
      {specialists.map((s) => {
        const isActive = specialist === s.id;
        const Icon = iconMap[s.icon] || Bot;

        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => handleSelect(s.id)}
            activeOpacity={0.7}
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
              {s.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
