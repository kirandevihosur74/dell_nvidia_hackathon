import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Bot, CheckSquare, CalendarDays, Settings } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useChatStore } from "@/stores/chatStore";

const specialistPrompts: Record<string, { title: string; subtitle: string; prompts: string[] }> = {
  copilot: {
    title: "Asana Copilot",
    subtitle: "Ask me anything about your Asana tasks",
    prompts: [
      "List my open tasks",
      "Create a task: Review PR #42",
      "What tasks are due this week?",
      "Show completed tasks",
      "Search for tasks about design",
      "Who is assigned to what?",
    ],
  },
  "task-manager": {
    title: "Task Manager",
    subtitle: "Deep task operations and bulk actions",
    prompts: [
      "Complete all overdue tasks",
      "Reassign tasks from Alex to Sarah",
      "Set due dates for unscheduled tasks",
      "Create 5 tasks for sprint planning",
      "Move tasks to next week",
      "Delete all completed tasks",
    ],
  },
  "project-planner": {
    title: "Project Planner",
    subtitle: "Project-level planning and organization",
    prompts: [
      "Plan a new feature launch",
      "Break down the Q2 roadmap into tasks",
      "What's the project status?",
      "Create milestones for the release",
      "Which tasks are blocking progress?",
      "Summarize this week's progress",
    ],
  },
  "workspace-admin": {
    title: "Workspace Admin",
    subtitle: "Workspace management and team operations",
    prompts: [
      "List all workspace members",
      "Show all projects in workspace",
      "Who has the most tasks?",
      "Find unassigned tasks",
      "Show team workload overview",
      "List tasks without due dates",
    ],
  },
};

const iconMap: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  copilot: Bot,
  "task-manager": CheckSquare,
  "project-planner": CalendarDays,
  "workspace-admin": Settings,
};

interface Props {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: Props) {
  const { theme } = useThemeStore();
  const { specialist } = useChatStore();

  const config = specialistPrompts[specialist] || specialistPrompts.copilot;
  const Icon = iconMap[specialist] || Bot;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
      <Icon size={48} color={theme.primary} />
      <Text style={{ fontSize: 20, fontWeight: "600", color: theme.text, marginTop: 16 }}>
        {config.title}
      </Text>
      <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 8, textAlign: "center" }}>
        {config.subtitle}
      </Text>

      <ScrollView
        contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 32 }}
      >
        {config.prompts.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => onSelect(p)}
            style={{
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
