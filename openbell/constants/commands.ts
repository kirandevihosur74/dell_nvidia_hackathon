export interface SlashCommand {
  id: string;
  command: string;
  label: string;
  description: string;
  icon: string;
  category: "status" | "control" | "session" | "tools" | "meeting";
  isToggle?: boolean;
}

export const slashCommands: SlashCommand[] = [
  {
    id: "status",
    command: "/status",
    label: "Status",
    description: "Show agent status, model, and memory usage",
    icon: "activity",
    category: "status",
  },
  {
    id: "usage",
    command: "/usage",
    label: "Usage",
    description: "Token and cost usage breakdown",
    icon: "bar-chart-2",
    category: "status",
  },
  {
    id: "think",
    command: "/think",
    label: "Think",
    description: "Toggle extended thinking mode",
    icon: "brain",
    category: "control",
    isToggle: true,
  },
  {
    id: "verbose",
    command: "/verbose",
    label: "Verbose",
    description: "Toggle verbose output",
    icon: "list",
    category: "control",
    isToggle: true,
  },
  {
    id: "skills",
    command: "/skills",
    label: "Skills",
    description: "Browse available skills",
    icon: "zap",
    category: "tools",
  },
  {
    id: "sessions",
    command: "/sessions",
    label: "Sessions",
    description: "View and switch sessions",
    icon: "layers",
    category: "session",
  },
  {
    id: "clear",
    command: "/clear",
    label: "Clear",
    description: "Clear the current session context",
    icon: "trash",
    category: "session",
  },
  {
    id: "model",
    command: "/model",
    label: "Model",
    description: "View or change the active model",
    icon: "cpu",
    category: "control",
  },
  {
    id: "help",
    command: "/help",
    label: "Help",
    description: "Show available commands",
    icon: "help-circle",
    category: "status",
  },
  // Meeting Bot commands
  {
    id: "meeting-deploy",
    command: "/meeting deploy",
    label: "Deploy Bot",
    description: "Deploy a meeting bot to a video call",
    icon: "bot",
    category: "meeting",
  },
  {
    id: "meeting-stop",
    command: "/meeting stop",
    label: "Stop Bot",
    description: "Remove the active meeting bot",
    icon: "square",
    category: "meeting",
  },
  {
    id: "meeting-transcript",
    command: "/meeting transcript",
    label: "Transcript",
    description: "View the live meeting transcript",
    icon: "file-text",
    category: "meeting",
  },
  {
    id: "meeting-items",
    command: "/meeting items",
    label: "Action Items",
    description: "View detected meeting action items",
    icon: "check-square",
    category: "meeting",
  },
];

export function filterCommands(query: string): SlashCommand[] {
  if (!query.startsWith("/")) return [];
  const search = query.slice(1).toLowerCase();
  if (!search) return slashCommands;
  return slashCommands.filter(
    (cmd) =>
      cmd.command.slice(1).startsWith(search) ||
      cmd.label.toLowerCase().startsWith(search)
  );
}
