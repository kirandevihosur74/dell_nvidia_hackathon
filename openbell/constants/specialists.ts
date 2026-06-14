export interface Specialist {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const specialists: Specialist[] = [
  {
    id: "copilot",
    name: "Asana Copilot",
    icon: "bot",
    description: "General task management assistant",
  },
  {
    id: "task-manager",
    name: "Task Manager",
    icon: "check-square",
    description: "Deep task operations and bulk actions",
  },
  {
    id: "project-planner",
    name: "Project Planner",
    icon: "calendar",
    description: "Project-level planning and organization",
  },
  {
    id: "workspace-admin",
    name: "Workspace Admin",
    icon: "settings",
    description: "Workspace management and team operations",
  },
];
