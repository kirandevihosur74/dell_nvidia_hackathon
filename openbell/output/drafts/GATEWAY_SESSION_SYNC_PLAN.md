# Gateway Session Sync — Implementation Plan

## Goal
Reflect the gateway's subagent sessions in the mobile app's session tab bar instead of maintaining a separate client-side session list. When the gateway delegates to a subagent, the client detects it, shows the relay banner, and routes the user to the correct session.

## Gateway Protocol

### `sessions.list` RPC
```ts
gatewayClient.request("sessions.list", { limit: 1000 })
// Returns: { sessions: Session[] }
```

### Session shape (from gateway)
```ts
interface GatewaySessionInfo {
  sessionKey: string;     // e.g. "agent:main:subagent:0146da98-6fa0-4929-aca6-b4afe852d2d6"
  key?: string;           // alias for sessionKey
  label?: string;         // e.g. "Sales Engineer"
  displayName?: string;   // e.g. "Sales Engineer"
  model?: string;
  thinking?: string;
  totalTokens?: number;
  contextTokens?: number;
  updatedAt?: number;
  parentId?: string;
}
```

### Session key patterns
- Main: `agent:main:main` or `agent:<name>:main`
- Subagent: `agent:main:subagent:<uuid>` (regex: `/^((?:agent:[^:]+)):subagent:.+$/`)
- Cron: `agent:main:cron:<name>`

### Existing restricted methods (already proxied via ws-proxy)
- `sessions.patch` — update model, thinkingLevel
- `sessions.delete` — delete a session
- `sessions.reset` — clear session history
- `sessions.compact` — compact session

## Implementation Steps

### 1. Add `syncGatewaySessions()` to SessionManager
- Call `sessions.list` via `gatewayClient.request`
- Filter for subagent sessions using the key pattern
- Map to `GatewaySession` objects with proper `gatewayId`, `name` (from label/displayName)
- Merge with local sessions, preferring gateway data
- Call on connection and periodically (every 30s)

### 2. Update session tab bar to use gateway session keys
- Currently uses client-side session IDs like "Sales Engineer"
- Needs to use gateway session keys like "agent:main:subagent:0146da98..."
- When user taps a subagent tab, switch `activeSessionId` to the gateway key
- `chat.send` to that key routes directly to the gateway's subagent

### 3. Detect delegation in real-time via streaming events
- When `chat_token` arrives with a `sessionKey` matching a subagent pattern, show the banner
- The gateway already streams tokens for subagent sessions — we just need to listen
- Use `shouldSuppressForRelay` logic in reverse: instead of suppressing, show banner

### 4. Show subagent responses in the correct tab
- Messages from subagent sessions should appear under that tab, not main
- Filter messages by `sessionKey` when displaying a subagent tab
- The gateway's `chat_done` for a subagent includes the sessionKey

### 5. Custom system prompts as context injection
- When user customizes a subagent's prompt in the app, store it locally
- On the first `chat.send` to that gateway session, prepend the custom prompt
- This preserves user customization while using the gateway's session routing
- The injected prompt is NOT displayed in chat bubbles — only the user's actual message is shown in the UI

## Key Benefits
- No more competing delegation systems
- Banner shows in real-time as gateway delegates
- Session tabs reflect actual gateway state
- User can switch to subagent tab to see its conversation
- Custom prompts still work via context injection
