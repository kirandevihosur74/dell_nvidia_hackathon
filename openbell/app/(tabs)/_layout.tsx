import { Tabs } from "expo-router";
import {
  MessageSquare,
  MessageSquareDashed,
  LayoutGrid,
  Bell,
  Settings,
  Cog,
  Zap,
  Radio,
  Terminal,
  KanbanSquare,
  FileBarChart,
  Rocket,
} from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import ScrollableTabBar from "@/components/ui/ScrollableTabBar";

function OpenClawIcon({ size, color }: { size: number; color: string }) {
  return <Cog size={size} color={color} />;
}

export default function TabLayout() {
  const { theme } = useThemeStore();

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
      }}
    >
      {/* Visible tabs — order: Onboarding, Report, OpenClaw, Chat, Settings */}
      <Tabs.Screen
        name="onboarding"
        options={{
          title: "Onboarding",
          tabBarIcon: ({ color, size }) => <Rocket size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarIcon: ({ color, size }) => <FileBarChart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="openclaw"
        options={{
          title: "OpenClaw",
          tabBarIcon: ({ color, size }) => <OpenClawIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => <MessageSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />

      {/* Disabled tabs — kept registered but hidden from the tab bar (href: null) */}
      <Tabs.Screen
        name="messenger"
        options={{
          href: null,
          title: "Messenger",
          tabBarIcon: ({ color, size }) => <MessageSquareDashed size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          href: null,
          title: "Skills",
          tabBarIcon: ({ color, size }) => <Zap size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          href: null,
          title: "Board",
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kanban"
        options={{
          href: null,
          title: "Kanban",
          tabBarIcon: ({ color, size }) => <KanbanSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
          title: "Activity",
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stream"
        options={{
          href: null,
          title: "Stream",
          tabBarIcon: ({ color, size }) => <Radio size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="terminal"
        options={{
          href: null,
          title: "Terminal",
          tabBarIcon: ({ color, size }) => <Terminal size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
