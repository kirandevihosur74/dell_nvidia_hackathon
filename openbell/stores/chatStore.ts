import { create } from "zustand";
import type { Message, Conversation } from "@/types/chat";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  specialist: string;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (token: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setSpecialist: (specialist: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  streamingContent: "",
  isStreaming: false,
  specialist: "copilot",

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setSpecialist: (specialist) => set({ specialist }),
  reset: () =>
    set({
      activeConversationId: null,
      messages: [],
      streamingContent: "",
      isStreaming: false,
    }),
}));
