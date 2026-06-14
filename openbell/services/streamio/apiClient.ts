// StreamIO API client — all requests auto-attach JWT from StreamIO auth store

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class StreamIOAPIError extends Error {
  statusCode?: number;
  data?: any;

  constructor(message: string, statusCode?: number, data?: any) {
    super(message);
    this.name = 'StreamIOAPIError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

function getAuthHeaders(): Record<string, string> {
  const auth = useStreamIOAuthStore.getState().currentAuth;
  if (auth?.authToken && auth.authToken !== 'guest-token') {
    return { Authorization: `Bearer ${auth.authToken}` };
  }
  return {};
}

async function request<T>(
  endpoint: string,
  method: HTTPMethod = 'GET',
  body?: any,
  headers?: Record<string, string>,
  timeout?: number,
): Promise<T> {
  const url = `${StreamIOAPIConfig.baseURL}${endpoint}`;
  if (endpoint.includes('recall')) {
    console.log(`[StreamIO API] ${method} ${url}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeout || StreamIOAPIConfig.timeouts.standard,
  );

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.text().catch(() => null);
      // Try to extract a meaningful error message from the response body
      let detail = response.statusText || '';
      if (data) {
        try {
          const parsed = JSON.parse(data);
          detail = parsed.error || parsed.detail || parsed.message || detail;
        } catch {
          if (data.length < 200) detail = data;
        }
      }
      throw new StreamIOAPIError(
        `HTTP ${response.status}: ${detail}`,
        response.status,
        data,
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof StreamIOAPIError) throw error;
    throw new StreamIOAPIError((error as Error).message);
  }
}

async function requestVoid(
  endpoint: string,
  method: HTTPMethod = 'GET',
  body?: any,
  headers?: Record<string, string>,
): Promise<void> {
  const url = `${StreamIOAPIConfig.baseURL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new StreamIOAPIError(`HTTP ${response.status}`, response.status);
  }
}

async function uploadFile(
  endpoint: string,
  fileData: Blob | ArrayBuffer,
  fileName: string,
  mimeType: string,
  additionalFields?: Record<string, string>,
): Promise<any> {
  const url = `${StreamIOAPIConfig.baseURL}${endpoint}`;
  const formData = new FormData();

  if (additionalFields) {
    Object.entries(additionalFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  formData.append('file', {
    uri: fileData as any,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await fetch(url, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!response.ok) {
    throw new StreamIOAPIError(`Upload failed: ${response.status}`, response.status);
  }

  return response.json();
}

export const streamIOApiClient = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, 'GET', undefined, headers),

  post: <T>(endpoint: string, body?: any, headers?: Record<string, string>, timeout?: number) =>
    request<T>(endpoint, 'POST', body, headers, timeout),

  put: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, 'PUT', body, headers),

  patch: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, 'PATCH', body, headers),

  delete: (endpoint: string, headers?: Record<string, string>) =>
    requestVoid(endpoint, 'DELETE', undefined, headers),

  upload: uploadFile,
};
