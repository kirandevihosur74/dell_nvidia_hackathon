export type LLMProvider = "gemini" | "claude" | "openai";

export interface UserSettings {
  asana_pat: string;
  gemini_api_key: string;
  claude_api_key: string;
  openai_api_key: string;
  elevenlabs_api_key: string;
  default_llm: LLMProvider;
  default_workspace_id: string;
  default_project_id: string;
  voice_input_enabled: boolean;
  voice_output_enabled: boolean;
  voice_auto_play: boolean;
  notifications_enabled: boolean;
  dark_mode: "system" | "light" | "dark";
}
