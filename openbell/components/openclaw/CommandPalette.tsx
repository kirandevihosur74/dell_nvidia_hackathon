import { View, Text, TouchableOpacity, FlatList } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { Activity, BarChart2, Brain, List, Zap, Layers, Trash, Cpu, HelpCircle } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { filterCommands, type SlashCommand } from "@/constants/commands";

const ICON_MAP: Record<string, typeof Activity> = {
  activity: Activity,
  "bar-chart-2": BarChart2,
  brain: Brain,
  list: List,
  zap: Zap,
  layers: Layers,
  trash: Trash,
  cpu: Cpu,
  "help-circle": HelpCircle,
};

interface CommandPaletteProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
}

export function CommandPalette({ query, onSelect }: CommandPaletteProps) {
  const { theme } = useThemeStore();
  const commands = filterCommands(query);

  if (commands.length === 0) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(200)}
      exiting={FadeOut.duration(100)}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: 280,
        backgroundColor: theme.card,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>
          Commands
        </Text>
      </View>
      <FlatList
        data={commands}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const Icon = ICON_MAP[item.icon] || HelpCircle;
          return (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 12,
              }}
              activeOpacity={0.6}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: theme.primary + "15",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Icon size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: theme.text }}>
                  {item.command}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              {item.isToggle && (
                <View style={{ backgroundColor: theme.warning + "20", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: theme.warning }}>TOGGLE</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </Animated.View>
  );
}
