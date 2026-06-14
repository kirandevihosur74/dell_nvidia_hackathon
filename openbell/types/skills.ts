export interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: SkillParameter[];
  examples: string[];
  isFavorite: boolean;
}

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  description: string;
  required: boolean;
  default?: unknown;
  options?: string[];
}

export interface SkillInvocation {
  skillId: string;
  parameters: Record<string, unknown>;
  timestamp: string;
}

export type SkillCategory =
  | "automation"
  | "communication"
  | "development"
  | "productivity"
  | "system"
  | "custom"
  | "all";
