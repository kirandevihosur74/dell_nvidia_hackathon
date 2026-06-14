import * as SecureStore from "expo-secure-store";
import type { SSEEvent } from "@/types/chat";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Stream chat via SSE using XMLHttpRequest (React Native compatible).
 * RN's fetch doesn't support ReadableStream, so we use XHR with onprogress.
 */
export function streamChat(
  message: string,
  conversationId: string | null,
  llmProvider: string,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const token = await SecureStore.getItemAsync("auth_token").catch(() => null);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/chat/stream`);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    let lastIndex = 0;

    xhr.onprogress = () => {
      const text = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;

      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // skip malformed events
          }
        }
      }
    };

    xhr.onload = () => {
      // Process any remaining data
      const text = xhr.responseText.substring(lastIndex);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // skip
          }
        }
      }
      resolve();
    };

    xhr.onerror = () => {
      reject(new Error("Network request failed"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Request timed out"));
    };

    // Handle abort
    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("AbortError"));
      });
    }

    xhr.timeout = 120000; // 2 min timeout
    xhr.send(
      JSON.stringify({
        message,
        conversation_id: conversationId,
        llm_provider: llmProvider,
      })
    );
  });
}
