import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Activity, Brain, BarChart2, Zap, FolderCode } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";

interface CommandToolbarProps {
  onCommand: (command: string) => void;
  onWorkspace?: () => void;
}

const quickCommands = [
  { command: "/status", label: "Status", Icon: Activity },
  { command: "/think", label: "Think", Icon: Brain },
  { command: "/usage", label: "Usage", Icon: BarChart2 },
  { command: "/skills", label: "Skills", Icon: Zap },
];

export function CommandToolbar({ onCommand, onWorkspace }: CommandToolbarProps) {
  const { theme } = useThemeStore();

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 8 }}
      >
        {onWorkspace && (
          <TouchableOpacity
            onPress={onWorkspace}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: theme.background,
              borderWidth: 1,
              borderColor: theme.border,
              gap: 4,
            }}
            activeOpacity={0.6}
          >
            <FolderCode size={12} color={theme.textSecondary} />
            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: "500" }}>
              Workspace
            </Text>
          </TouchableOpacity>
        )}
        {quickCommands.map(({ command, label, Icon }) => (
          <TouchableOpacity
            key={command}
            onPress={() => onCommand(command)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: theme.background,
              borderWidth: 1,
              borderColor: theme.border,
              gap: 4,
            }}
            activeOpacity={0.6}
          >
            <Icon size={12} color={theme.textSecondary} />
            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: "500" }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
