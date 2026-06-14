import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

let _apiBaseOverride: string | null = null;
let _initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!_initPromise) {
    _initPromise = AsyncStorage.getItem("api_base_url")
      .then((saved) => {
        if (saved) _apiBaseOverride = saved;
      })
      .catch(() => {});
  }
  return _initPromise;
}

// Kick off init immediately on module load
ensureInit();

async function getApiBase(): Promise<string> {
  await ensureInit();
  return _apiBaseOverride || ENV_API_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  _apiBaseOverride = url;
  await AsyncStorage.setItem("api_base_url", url);
}

export async function getApiBaseUrl(): Promise<string> {
  return getApiBase();
}

const API_BASE = ENV_API_URL;

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("auth_token");
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const baseUrl = await getApiBase();
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || err.message || "API error");
    }
    return res.json();
  } catch (err) {
    // Debug: include the URL in the error so we can see what's being fetched
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${msg} [URL: ${url}]`);
  }
}

export const api = {
  // Conversations
  listConversations: () => request<Array<Record<string, string>>>("/conversations"),
  createConversation: (data: { title?: string; llm_provider?: string }) =>
    request<{ id: string }>("/conversations", { method: "POST", body: JSON.stringify(data) }),
  getMessages: (id: string) => request<Array<Record<string, unknown>>>(`/conversations/${id}/messages`),
  deleteConversation: (id: string) =>
    request<{ deleted: boolean }>(`/conversations/${id}`, { method: "DELETE" }),

  // Settings
  getSettings: () => request<Record<string, string>>("/settings"),
  updateSettings: (data: Record<string, string>) =>
    request<{ updated: boolean }>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Board
  getBoardTasks: (projectId?: string) =>
    request<{ columns: { open: Array<Record<string, unknown>>; completed: Array<Record<string, unknown>> } }>(
      `/board/tasks${projectId ? `?project_id=${projectId}` : ""}`
    ),
  moveTask: (taskId: string, completed: boolean) =>
    request<Record<string, unknown>>(`/board/tasks/${taskId}/move`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    }),
  deleteTask: (taskId: string) =>
    request<{ success: boolean }>(`/board/tasks/${taskId}`, { method: "DELETE" }),

  // Health
  health: () => request<{ status: string }>("/health"),
};

export { API_BASE };
