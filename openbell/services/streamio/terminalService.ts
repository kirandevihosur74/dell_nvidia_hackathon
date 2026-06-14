// Terminal service — Remote shell via WebSocket
//
// On iOS, native shell access is not possible. Instead, we connect
// to a remote shell server via WebSocket. The server spawns a PTY
// and forwards input/output over the WebSocket connection.
//
// Also supports a local "command interface" mode for sending
// slash commands to the StreamIO backend.

import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';

export interface TerminalSession {
  id: string;
  type: 'remote' | 'command';
  title: string;
  isConnected: boolean;
}

type DataCallback = (data: string) => void;
type ExitCallback = (code: number) => void;

let ws: WebSocket | null = null;
let dataCallback: DataCallback | null = null;
let exitCallback: ExitCallback | null = null;
let sessionId: string | null = null;

// ─── Remote Shell ───────────────────────────────────────────────────

export function connectRemoteShell(
  onData: DataCallback,
  onExit: ExitCallback,
  options?: { cols?: number; rows?: number; shell?: string },
): string {
  const id = `term_${Date.now()}`;
  sessionId = id;
  dataCallback = onData;
  exitCallback = onExit;

  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const url = `${StreamIOAPIConfig.wsURL}/api/terminal/ws${token ? `?token=${token}` : ''}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    // Send initial configuration
    ws?.send(JSON.stringify({
      type: 'init',
      cols: options?.cols || 80,
      rows: options?.rows || 24,
      shell: options?.shell || '/bin/bash',
    }));
    onData('\x1b[32mConnected to remote shell\x1b[0m\r\n');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'data') {
        dataCallback?.(msg.data);
      } else if (msg.type === 'exit') {
        exitCallback?.(msg.code || 0);
      }
    } catch {
      // Raw text output
      dataCallback?.(event.data);
    }
  };

  ws.onerror = () => {
    onData('\x1b[31mConnection error\x1b[0m\r\n');
  };

  ws.onclose = (event) => {
    onData(`\x1b[33mDisconnected (code ${event.code})\x1b[0m\r\n`);
    exitCallback?.(event.code);
    ws = null;
  };

  return id;
}

export function writeToShell(data: string): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
  }
}

export function resizeShell(cols: number, rows: number): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  }
}

export function disconnectShell(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
  sessionId = null;
  dataCallback = null;
  exitCallback = null;
}

export function isShellConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

// ─── Command Interface Mode ─────────────────────────────────────────

export interface CommandResult {
  output: string;
  exitCode: number;
  timestamp: string;
}

const commandHistory: string[] = [];

export async function executeRemoteCommand(command: string): Promise<CommandResult> {
  commandHistory.push(command);
  if (commandHistory.length > 200) commandHistory.shift();

  const token = useStreamIOAuthStore.getState().currentAuth?.authToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${StreamIOAPIConfig.baseURL}/api/terminal/exec`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      return {
        output: `Error: HTTP ${response.status}`,
        exitCode: 1,
        timestamp: new Date().toISOString(),
      };
    }

    const data = await response.json();
    return {
      output: data.output || '',
      exitCode: data.exitCode ?? 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      output: `Error: ${error.message}`,
      exitCode: 1,
      timestamp: new Date().toISOString(),
    };
  }
}

export function getCommandHistory(): string[] {
  return [...commandHistory];
}

export function clearCommandHistory(): void {
  commandHistory.length = 0;
}
