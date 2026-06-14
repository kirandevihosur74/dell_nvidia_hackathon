// AI Chat service — WebSocket streaming + REST fallback
// Ported from Electron's conversationCommand + Constella Horizon's AIConnectionManager

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { AIMessage, AIRequest, AIResponse } from '@/types/streamio';
import { streamIOApiClient } from '@/services/streamio/apiClient';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';

type MessageCallback = (chunk: string, isComplete: boolean) => void;

let ws: WebSocket | null = null;
let messageCallback: MessageCallback | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// ─── WebSocket Connection ───────────────────────────────────────────

export function connectWebSocket(onMessage: MessageCallback): void {
  if (ws?.readyState === WebSocket.OPEN) return;

  messageCallback = onMessage;
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const url = `${StreamIOAPIConfig.wsURL}${StreamIOAPIConfig.endpoints.chatWS}${token ? `?token=${token}` : ''}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk' || data.type === 'response') {
        messageCallback?.(data.content || '', data.isComplete || data.type === 'response');
      } else if (data.type === 'error') {
        messageCallback?.(`Error: ${data.message || 'Unknown error'}`, true);
      }
    } catch {
      // Raw text chunk
      messageCallback?.(event.data, false);
    }
  };

  ws.onerror = () => {
    // Will trigger onclose
  };

  ws.onclose = () => {
    ws = null;
    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectTimer = setTimeout(() => {
        if (messageCallback) connectWebSocket(messageCallback);
      }, delay);
    }
  };
}

export function disconnectWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = MAX_RECONNECT; // prevent reconnect
  messageCallback = null;
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isWebSocketConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

// Send message via WebSocket
export function sendMessageWS(request: AIRequest): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    messageCallback?.('WebSocket not connected', true);
    return;
  }
  ws.send(JSON.stringify({
    type: 'chat',
    messages: request.messages,
    imageBytes: request.imageBytes,
    smarterAnalysisEnabled: request.smarterAnalysisEnabled,
  }));
}

// ─── REST Fallback ──────────────────────────────────────────────────

export async function sendMessageREST(
  message: string,
  imageBase64?: string,
  conversationId?: string,
): Promise<AIResponse> {
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const body: any = { message };
  if (imageBase64) body.image = imageBase64;
  if (conversationId) body.conversationId = conversationId;

  const response = await streamIOApiClient.post<{
    success: boolean;
    data: {
      response: string;
      messageId?: string;
    };
  }>('/api/v1/ai/chat', body, headers);

  return {
    content: response.data?.response || '',
    isComplete: true,
  };
}

// ─── Conversation CRUD ──────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  type: 'general' | 'screenshare';
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function createConversation(title?: string): Promise<Conversation> {
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await streamIOApiClient.post<{ success: boolean; data: any }>(
    '/api/v1/conversations',
    { title: title || 'New Chat', type: 'general' },
    headers,
  );

  const conv = res.data;
  return {
    id: conv._id || conv.id,
    title: conv.title,
    type: conv.type || 'general',
    messageCount: conv.messageCount || 0,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return streamIOApiClient.get<Conversation[]>('/api/v1/conversations', headers);
}

export async function getConversation(id: string): Promise<{
  conversation: Conversation;
  messages: AIMessage[];
}> {
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return streamIOApiClient.get(`/api/v1/conversations/${id}`, headers);
}

export async function deleteConversation(id: string): Promise<void> {
  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  await streamIOApiClient.delete(`/api/v1/conversations/${id}`, headers);
}
