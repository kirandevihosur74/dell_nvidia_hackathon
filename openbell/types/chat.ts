export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  llm_provider: string;
  created_at: string;
  updated_at: string;
}

export interface SSEEvent {
  type: "token" | "tool_call" | "tool_result" | "done" | "error";
  content?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  message?: string;
  conversation_id?: string;
}
