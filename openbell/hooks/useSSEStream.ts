import { useRef, useCallback } from "react";
import { streamChat } from "@/services/sseClient";
import { useChatStore } from "@/stores/chatStore";
import type { SSEEvent, ToolCall } from "@/types/chat";

export function useSSEStream() {
  const abortRef = useRef<AbortController | null>(null);
  const { appendStreamingContent, setIsStreaming, setStreamingContent, addMessage } =
    useChatStore();

  const send = useCallback(
    async (message: string, conversationId: string | null, llmProvider: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamingContent("");

      let fullContent = "";
      let resolvedConversationId = conversationId;
      const toolCalls: ToolCall[] = [];

      try {
        await streamChat(
          message,
          conversationId,
          llmProvider,
          (event: SSEEvent) => {
            switch (event.type) {
              case "token":
                fullContent += event.content || "";
                appendStreamingContent(event.content || "");
                break;
              case "tool_call":
                toolCalls.push({
                  name: event.tool_name || "",
                  args: event.tool_args || {},
                });
                break;
              case "tool_result":
                if (toolCalls.length > 0) {
                  toolCalls[toolCalls.length - 1].result =
                    event.tool_result || {};
                }
                break;
              case "done":
                resolvedConversationId = event.conversation_id || conversationId;
                addMessage({
                  id: Date.now().toString(),
                  role: "assistant",
                  content: fullContent,
                  timestamp: new Date().toISOString(),
                  toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                });
                break;
              case "error":
                addMessage({
                  id: Date.now().toString(),
                  role: "assistant",
                  content: `Error: ${event.message}`,
                  timestamp: new Date().toISOString(),
                });
                break;
            }
          },
          controller.signal
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          addMessage({
            id: Date.now().toString(),
            role: "assistant",
            content: `Connection error: ${err.message}`,
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }

      return resolvedConversationId;
    },
    [appendStreamingContent, setIsStreaming, setStreamingContent, addMessage]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [setIsStreaming]);

  return { send, cancel };
}
