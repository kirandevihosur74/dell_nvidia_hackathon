# OpenClaw Mobile Channel Integration Spec

> **Status:** Draft
> **Date:** 2026-03-17
> **Author:** Auto-generated from architecture review
> **App:** Asana Copilot Mobile (React Native / Expo)
> **Target:** OpenClaw Gateway (`ws://127.0.0.1:18789`)

---

## 1. Executive Summary

This spec defines the requirements and implementation plan to make the existing Asana Copilot mobile app a **first-class OpenClaw channel** — a dedicated native client that connects directly to the OpenClaw Gateway, replacing WhatsApp, Telegram, and other third-party messaging apps as the primary way to interact with an OpenClaw agent.

The app retains all existing Asana Copilot functionality (task board, specialists, activity feed) and gains a new OpenClaw communication layer that bridges the agent's capabilities with the existing task management UI.

### Key Design Principles

- **Local-first, remote-capable**: Connect to Gateway on LAN or via Tailscale when remote
- **Offline-resilient**: Queue messages and actions when Gateway is unreachable
- **Secure by default**: E2E encryption on top of transport security
- **Agent-native UI**: Purpose-built for AI agent interaction, not a chat app clone
- **Bidirectional Asana bridge**: OpenClaw agent can drive the task board; board actions can trigger agent workflows

---

## 2. Architecture Overview

### 2.1 Current Architecture

```
Mobile App → REST/SSE (localhost:8000) → Asana Copilot Backend → Asana API
```

### 2.2 Target Architecture

```
                                    ┌─────────────────────┐
                                    │   Asana Copilot API  │
                                    │   (localhost:8000)   │
                                    └──────────▲──────────┘
                                               │ REST/SSE
                                               │
┌──────────────────────────────────────────────┐
│              Mobile App                       │
│                                               │
│  ┌─────────────┐   ┌──────────────────────┐  │
│  │ Asana Module │   │  OpenClaw Module     │  │
│  │ (existing)   │   │  (new)               │  │
│  │             │◄──►│                      │  │
│  │ - Board     │    │ - Gateway Client     │  │
│  │ - Tasks     │    │ - Session Manager    │  │
│  │ - Activity  │    │ - Tool Viewer        │  │
│  │ - Specialists│   │ - Skill Browser      │  │
│  └─────────────┘   │ - Media Handler      │  │
│                     │ - E2E Encryption     │  │
│                     └──────────▲───────────┘  │
└──────────────────────────────┬───────────────┘
                               │ WSS
                               │
              ┌────────────────▼────────────────┐
              │       OpenClaw Gateway           │
              │    (ws://127.0.0.1:18789)        │
              │    or Tailscale Funnel URL        │
              │                                  │
              │  - Sessions    - Tools           │
              │  - Channels    - Skills          │
              │  - Pairing     - Events          │
              └──────────────────────────────────┘
```

### 2.3 Connection Strategy

| Scenario | Transport | Auth |
|----------|-----------|------|
| Same LAN | `ws://127.0.0.1:18789` | Pairing code |
| Remote (Tailscale mesh) | `wss://<tailscale-ip>:18789` | Tailscale identity |
| Remote (Funnel) | `wss://<funnel-url>` | Password + pairing |

---

## 3. Feature Requirements

### 3.1 Gateway Communication Layer

#### 3.1.1 WebSocket Client

**Priority:** P0 (Critical)

- [ ] Implement persistent WebSocket connection to OpenClaw Gateway
- [ ] Support both `ws://` (local) and `wss://` (remote) protocols
- [ ] Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- [ ] Connection health monitoring with heartbeat/ping-pong
- [ ] Graceful degradation when Gateway is unreachable
- [ ] Support Gateway protocol messages: `sessions.patch`, `node.list`, `node.describe`, `node.invoke`
- [ ] Handle block streaming and tool streaming from the agent runtime

**Implementation Notes:**
- Replace or augment the existing `sseClient.ts` with a new `gatewayClient.ts`
- Use `react-native` compatible WebSocket (built-in `WebSocket` API)
- Store connection state in a new Zustand store (`gatewayStore.ts`)

#### 3.1.2 Session Management

**Priority:** P0

- [ ] Create and manage named sessions with the Gateway
- [ ] Support `sessions_list`, `sessions_history`, `sessions_send` protocol messages
- [ ] Per-session configuration (model, thinking level, verbose mode)
- [ ] Session context compaction handling
- [ ] Session persistence across app restarts (resume last active session)

#### 3.1.3 Multi-Gateway Support

**Priority:** P1

- [ ] Gateway registry: store multiple Gateway configurations (name, host, port, auth method)
- [ ] Gateway switcher UI in settings or quick-access menu
- [ ] Per-gateway session state isolation
- [ ] Connection status indicator per gateway (connected, connecting, offline)
- [ ] Auto-discovery of Gateways on local network (mDNS/Bonjour optional)

**Data Model:**
```typescript
interface GatewayConfig {
  id: string;
  name: string;                    // e.g., "Home Mac", "Work Server"
  host: string;                    // IP or Tailscale hostname
  port: number;                    // default 18789
  authMethod: 'pairing' | 'tailscale' | 'password';
  tailscaleIdentity?: string;
  isPaired: boolean;
  lastConnected?: Date;
}
```

### 3.2 Authentication & Security

#### 3.2.1 Pairing Flow

**Priority:** P0

- [ ] Implement pairing code entry screen (shown on first connect to new Gateway)
- [ ] Display incoming pairing code when Gateway initiates pairing
- [ ] Store approved pairing state in `expo-secure-store`
- [ ] Support re-pairing / unpairing from settings
- [ ] Manual credential configuration as fallback (host + password entry)

**UX Flow:**
1. User adds new Gateway (enters host/IP)
2. App connects → Gateway returns pairing challenge
3. App displays pairing code OR prompts for code shown on Gateway device
4. User confirms on both ends → pairing persisted
5. Subsequent connections auto-authenticate

#### 3.2.2 Tailscale Native Integration

**Priority:** P1

- [ ] Integrate Tailscale SDK for iOS and Android
- [ ] Zero-config discovery of Gateway on Tailscale network
- [ ] Identity-based authentication (no passwords when on Tailscale mesh)
- [ ] Handle Tailscale login/logout within the app
- [ ] Fallback to Funnel URL + password when Tailscale is unavailable

**Dependencies:**
- `@anthropic-ai/tailscale-react-native` or equivalent Tailscale SDK
- Tailscale iOS/Android SDK (native modules, may require custom Expo config plugin)

#### 3.2.3 End-to-End Encryption

**Priority:** P1

- [ ] Implement Signal Protocol or Noise Protocol for E2E encryption
- [ ] Key exchange during pairing flow
- [ ] Per-session encryption keys with forward secrecy
- [ ] Key storage in `expo-secure-store` (hardware-backed on iOS/Android)
- [ ] Visual key verification (safety numbers / QR code)
- [ ] Encrypt all message content, media, and tool results
- [ ] Transport layer: WSS (TLS) as baseline; E2E as additional layer

**Implementation Notes:**
- Consider `libsignal-protocol-javascript` or `@stablelib/noise`
- Key rotation on session boundaries
- Encrypted local message cache (SQLite with SQLCipher or encrypted AsyncStorage)

### 3.3 Messaging & Media

#### 3.3.1 Rich Text Messaging

**Priority:** P0

- [ ] Send/receive text messages through Gateway protocol
- [ ] Markdown rendering in message bubbles (already partially exists)
- [ ] Code block syntax highlighting
- [ ] Link previews with metadata extraction
- [ ] Message status indicators (sent, delivered, read, error)
- [ ] Message retry on failure
- [ ] Typing indicators (agent thinking/processing state)

#### 3.3.2 Media Support

**Priority:** P1

- [ ] **Image sending**: Camera capture + photo library picker → upload to Gateway
- [ ] **Image receiving**: Render inline images from agent responses (screenshots, generated images)
- [ ] **File sending**: Document picker for PDFs, text files, etc.
- [ ] **File receiving**: Download and preview files from agent (with share sheet)
- [ ] **Audio clips**: Record and send voice memos (distinct from voice input)
- [ ] **Video**: Receive and play video content from agent
- [ ] Media compression before upload (configurable quality)
- [ ] Media cache with LRU eviction policy
- [ ] Progress indicators for uploads/downloads

**Dependencies:**
- `expo-image-picker` (already available via Expo)
- `expo-document-picker`
- `expo-file-system` for download management
- `expo-av` (already installed) for audio/video playback

#### 3.3.3 Interactive Cards & Rich Previews

**Priority:** P1

- [ ] **Web preview cards**: When agent browses a page, show title + image + URL card
- [ ] **GitHub cards**: PR status, issue details, commit info with status badges
- [ ] **Calendar cards**: Event details with accept/decline actions
- [ ] **Email cards**: Subject, sender, preview text with reply action
- [ ] **File cards**: File icon, name, size with open/download action
- [ ] **Map cards**: Location pins when agent references addresses
- [ ] **Generic structured card**: JSON schema → rendered card (extensible)
- [ ] Cards are tappable with contextual actions (open in browser, copy, share)

**Implementation:**
- Define a `ToolResultCard` component system with registered renderers
- Agent tool results include a `type` field that maps to a card renderer
- Fallback to formatted JSON for unrecognized tool result types

### 3.4 Tool Execution Feedback

#### 3.4.1 Real-Time Tool Progress

**Priority:** P0

- [ ] Display active tool name and status when agent executes tools
- [ ] Progress indicators for long-running tools (browser navigation, file operations)
- [ ] Streaming output for shell command execution
- [ ] Collapsible tool execution log (expand to see full details)
- [ ] Tool execution timeline view (ordered list of tools run in a turn)
- [ ] Error states with retry affordance

**UX Pattern:**
```
┌──────────────────────────────────┐
│ 🔧 Running: browser.navigate    │
│ ┌──────────────────────────────┐ │
│ │ Navigating to github.com... │ │
│ │ ████████░░░░ 65%             │ │
│ └──────────────────────────────┘ │
│ ▶ 2 previous tools completed     │
└──────────────────────────────────┘
```

#### 3.4.2 Tool Result Rendering

**Priority:** P1

- [ ] Render tool results as interactive cards (see 3.3.3)
- [ ] Screenshot results displayed inline as images
- [ ] Terminal output rendered in monospace with ANSI color support
- [ ] File content results with syntax highlighting
- [ ] Diff views for file modifications
- [ ] Tabular data rendered as formatted tables

### 3.5 Slash Commands & Skill Browser

#### 3.5.1 Slash Command UI

**Priority:** P1

- [ ] Command palette triggered by `/` in chat input
- [ ] Autocomplete dropdown with command descriptions
- [ ] Quick-action buttons for frequent commands in a toolbar
- [ ] Support all OpenClaw commands: `/status`, `/think`, `/verbose`, `/usage`, `/skills`, etc.
- [ ] Visual feedback for command execution (distinct from regular messages)
- [ ] Command history (recent commands easily re-invocable)

**Supported Commands:**
| Command | UI Element | Description |
|---------|-----------|-------------|
| `/status` | Status card | Show agent status, model, memory usage |
| `/think` | Toggle button | Enable/disable extended thinking |
| `/verbose` | Toggle button | Toggle verbose mode |
| `/usage` | Usage card | Token/cost usage breakdown |
| `/skills` | Skill browser | Open skill catalog |
| `/sessions` | Session list | View/switch sessions |

#### 3.5.2 Skill Browser & Invocation

**Priority:** P2

- [ ] Skill catalog screen (list all available OpenClaw skills)
- [ ] Skill detail view: name, description, required parameters, examples
- [ ] Invoke skill directly from catalog with parameter form
- [ ] Invoke skills via chat (mention or slash command)
- [ ] Skill search and filtering
- [ ] Favorite/pin frequently used skills
- [ ] Skill execution status and result display

**UX Flow:**
1. User opens skill browser (tab or command)
2. Browse/search skills organized by category
3. Tap skill → see description + parameters
4. Fill parameters → "Run" → result appears in chat
5. Or type `/skillname param1 param2` in chat

### 3.6 Asana Board ↔ OpenClaw Bridge

#### 3.6.1 Agent-Driven Board Updates

**Priority:** P0

- [ ] OpenClaw agent can create tasks on the Asana board via tool calls
- [ ] Agent can update task status (move between columns)
- [ ] Agent can assign, tag, and set due dates on tasks
- [ ] Board UI updates in real-time when agent modifies tasks
- [ ] Activity feed captures agent-initiated task operations
- [ ] Conflict resolution when user and agent modify the same task

**Implementation:**
- New `asanaBridge` service that listens for OpenClaw tool call events related to task management
- Maps OpenClaw tool results to existing `apiClient` task endpoints
- Zustand store subscription triggers board re-fetch on agent task mutations

#### 3.6.2 Board-to-Agent Actions

**Priority:** P1

- [ ] "Ask agent about this task" action on task context menu
- [ ] "Delegate to agent" action that sends task details to OpenClaw for autonomous work
- [ ] Board changes trigger optional agent notifications ("Task X moved to Done")
- [ ] Agent can suggest task breakdowns that appear as sub-tasks on the board
- [ ] Quick-chat from task detail sheet (pre-filled context about the task)

#### 3.6.3 Unified Activity Feed

**Priority:** P1

- [ ] Activity feed shows both Asana operations and OpenClaw agent actions
- [ ] Activity type icons distinguish human vs. agent actions
- [ ] Filter activity by source (Asana, OpenClaw, or both)
- [ ] Tappable activities that navigate to relevant chat message or board task

### 3.7 Push Notifications

#### 3.7.1 Proactive Agent Notifications

**Priority:** P0

- [ ] Agent can push notifications when app is backgrounded or closed
- [ ] Notification categories:
  - **Task updates**: "Build finished", "PR merged", "Deploy complete"
  - **Reminders**: "Meeting in 10 min", "Follow up on email"
  - **Alerts**: "Server CPU spike detected", "CI pipeline failed"
  - **Responses**: Agent finished processing a long-running request
- [ ] Notification tap deep-links to relevant chat message or board task
- [ ] Notification actions (mark done, snooze, reply from notification)
- [ ] Notification preferences: per-category enable/disable, quiet hours

#### 3.7.2 Notification Transport

**Priority:** P1

- [ ] **Local push**: When on same network, Gateway pushes directly via WebSocket → local notification API
- [ ] **Remote push**: When app is killed, route through Expo Push / APNs / FCM
- [ ] Register push token with Gateway on connect
- [ ] Encrypted notification payloads (E2E encrypted content in push body)
- [ ] Badge count management (unread messages + pending notifications)

### 3.8 Offline Support

#### 3.8.1 Message Queue

**Priority:** P1

- [ ] Queue outgoing messages when Gateway is unreachable
- [ ] Persist queue to AsyncStorage (survive app restart)
- [ ] Flush queue in order when connection is restored
- [ ] Visual indicator on queued messages ("pending", "sending", "sent")
- [ ] Retry failed messages with user confirmation

#### 3.8.2 Offline Cache

**Priority:** P1

- [ ] Cache recent conversation history locally (encrypted)
- [ ] Cache board state for offline viewing
- [ ] Cache skill catalog for offline browsing
- [ ] Cache media/attachments with configurable storage limit
- [ ] Sync delta on reconnect (only fetch messages since last sync)

---

## 4. Data Models

### 4.1 New TypeScript Types

```typescript
// Gateway connection
interface GatewayConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  authMethod: 'pairing' | 'tailscale' | 'password';
  tailscaleHostname?: string;
  isPaired: boolean;
  pairingToken?: string;      // stored in secure store
  lastConnected?: string;
}

// OpenClaw message (extends existing Message type)
interface OpenClawMessage {
  id: string;
  sessionId: string;
  gatewayId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'error';
  toolCalls?: ToolCallEvent[];
  toolResults?: ToolResultCard[];
  media?: MediaAttachment[];
  encrypted: boolean;
}

// Tool execution events
interface ToolCallEvent {
  id: string;
  toolName: string;
  status: 'running' | 'completed' | 'error';
  progress?: number;           // 0-100
  input?: Record<string, any>;
  output?: any;
  startedAt: string;
  completedAt?: string;
  cardType?: string;           // maps to card renderer
}

// Rich result cards
interface ToolResultCard {
  type: 'web_preview' | 'github_pr' | 'github_issue' | 'calendar_event'
        | 'email' | 'file' | 'terminal' | 'diff' | 'table' | 'generic';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  actions?: CardAction[];
  data: Record<string, any>;
}

interface CardAction {
  label: string;
  type: 'open_url' | 'copy' | 'share' | 'reply' | 'run_skill';
  payload: string;
}

// Media
interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  uri: string;
  mimeType: string;
  size: number;
  thumbnail?: string;
  uploadStatus: 'pending' | 'uploading' | 'complete' | 'error';
  uploadProgress?: number;
}

// Skills
interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: SkillParameter[];
  examples: string[];
  isFavorite: boolean;
}

interface SkillParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

// E2E Encryption
interface EncryptionKeyPair {
  gatewayId: string;
  publicKey: string;          // stored normally
  privateKey: string;         // stored in secure store
  createdAt: string;
  rotatedAt?: string;
}
```

### 4.2 New Zustand Stores

| Store | Purpose |
|-------|---------|
| `gatewayStore` | Connection state, active gateway, connection status per gateway |
| `openclawChatStore` | OpenClaw messages, sessions, streaming state (separate from Asana chat) |
| `skillStore` | Skill catalog, favorites, recent invocations |
| `encryptionStore` | Key state, verification status (keys themselves in secure store) |

---

## 5. New Files & Directory Structure

```
mobile/
├── services/
│   ├── gateway/
│   │   ├── gatewayClient.ts          # WebSocket connection manager
│   │   ├── gatewayProtocol.ts        # Message serialization/deserialization
│   │   ├── sessionManager.ts         # Session lifecycle management
│   │   ├── pairingService.ts         # Pairing flow logic
│   │   └── discoveryService.ts       # LAN/Tailscale gateway discovery
│   ├── encryption/
│   │   ├── e2eService.ts             # E2E encryption/decryption
│   │   ├── keyManager.ts             # Key generation, storage, rotation
│   │   └── keyVerification.ts        # Safety number generation/comparison
│   ├── tailscale/
│   │   └── tailscaleService.ts       # Tailscale SDK wrapper
│   ├── media/
│   │   ├── mediaService.ts           # Upload/download management
│   │   ├── mediaCache.ts             # LRU cache for media files
│   │   └── mediaCompression.ts       # Image/video compression
│   ├── bridge/
│   │   └── asanaBridge.ts            # OpenClaw ↔ Asana board bridge
│   └── offlineQueue.ts               # Enhanced offline message queue
├── stores/
│   ├── gatewayStore.ts               # Gateway connection state
│   ├── openclawChatStore.ts          # OpenClaw message state
│   ├── skillStore.ts                 # Skill catalog state
│   └── encryptionStore.ts            # Encryption key state
├── hooks/
│   ├── useGateway.ts                 # Gateway connection hook
│   ├── useOpenClawStream.ts          # Message streaming hook
│   ├── useToolProgress.ts            # Tool execution tracking
│   ├── useSkills.ts                  # Skill browsing/invocation
│   └── useAsanaBridge.ts             # Bridge hook for board ↔ agent
├── components/
│   ├── openclaw/
│   │   ├── GatewayStatusBar.tsx      # Connection status indicator
│   │   ├── PairingScreen.tsx         # Pairing code entry/display
│   │   ├── GatewayPicker.tsx         # Multi-gateway switcher
│   │   ├── SessionSwitcher.tsx       # Session management UI
│   │   ├── CommandPalette.tsx        # Slash command autocomplete
│   │   ├── CommandToolbar.tsx        # Quick-action command buttons
│   │   ├── ToolProgressCard.tsx      # Active tool execution display
│   │   ├── ToolTimeline.tsx          # Ordered tool execution history
│   │   ├── SkillBrowser.tsx          # Skill catalog list
│   │   ├── SkillDetail.tsx           # Skill detail + invoke form
│   │   ├── EncryptionBadge.tsx       # E2E encryption status indicator
│   │   └── KeyVerification.tsx       # Safety number comparison UI
│   ├── cards/
│   │   ├── CardRenderer.tsx          # Card type → component router
│   │   ├── WebPreviewCard.tsx        # URL preview card
│   │   ├── GitHubPRCard.tsx          # Pull request card
│   │   ├── GitHubIssueCard.tsx       # Issue card
│   │   ├── CalendarCard.tsx          # Calendar event card
│   │   ├── EmailCard.tsx             # Email preview card
│   │   ├── FileCard.tsx              # File attachment card
│   │   ├── TerminalCard.tsx          # Shell output card (ANSI colors)
│   │   ├── DiffCard.tsx              # File diff card
│   │   ├── TableCard.tsx             # Tabular data card
│   │   └── GenericCard.tsx           # Fallback JSON card
│   ├── media/
│   │   ├── MediaPicker.tsx           # Image/file selection UI
│   │   ├── MediaPreview.tsx          # Inline media viewer
│   │   ├── AudioPlayer.tsx           # Audio playback component
│   │   └── UploadProgress.tsx        # Upload progress indicator
│   └── bridge/
│       ├── AgentTaskAction.tsx        # "Ask agent" / "Delegate" buttons
│       └── AgentActivityItem.tsx      # Agent action in activity feed
├── app/
│   ├── (tabs)/
│   │   ├── openclaw.tsx              # OpenClaw chat screen (new tab)
│   │   └── skills.tsx                # Skill browser screen (new tab)
│   ├── openclaw/
│   │   ├── [sessionId].tsx           # Session detail view
│   │   ├── gateways.tsx              # Gateway management screen
│   │   └── pairing.tsx               # Pairing flow screen
│   └── settings/
│       ├── encryption.tsx            # Encryption settings & key verify
│       └── notifications.tsx         # Notification preferences
├── types/
│   ├── gateway.ts                    # Gateway, session types
│   ├── openclaw.ts                   # OpenClaw message, tool types
│   ├── cards.ts                      # Card type definitions
│   └── encryption.ts                 # Encryption key types
└── constants/
    └── commands.ts                   # Slash command definitions
```

---

## 6. Implementation Plan

### Phase 1: Gateway Foundation (Weeks 1-3)

**Goal:** Establish basic WebSocket communication with OpenClaw Gateway.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 1.1 | Implement `gatewayClient.ts` WebSocket connection manager | P0 | 3d |
| 1.2 | Implement `gatewayProtocol.ts` message serialization | P0 | 2d |
| 1.3 | Implement `sessionManager.ts` session lifecycle | P0 | 2d |
| 1.4 | Create `gatewayStore.ts` Zustand store | P0 | 1d |
| 1.5 | Implement pairing flow (`pairingService.ts` + `PairingScreen.tsx`) | P0 | 3d |
| 1.6 | Add Gateway settings UI (add/edit/remove gateways) | P0 | 2d |
| 1.7 | Add `GatewayStatusBar.tsx` connection indicator | P0 | 1d |
| 1.8 | Basic text send/receive through Gateway | P0 | 2d |

**Milestone:** Can connect to local Gateway, pair, and exchange text messages.

### Phase 2: Chat Experience (Weeks 4-6)

**Goal:** Full chat experience with streaming, tool feedback, and commands.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 2.1 | Implement `useOpenClawStream.ts` for block/tool streaming | P0 | 3d |
| 2.2 | Create `openclawChatStore.ts` with message persistence | P0 | 2d |
| 2.3 | Add OpenClaw chat tab (`openclaw.tsx`) | P0 | 2d |
| 2.4 | Implement `ToolProgressCard.tsx` and `ToolTimeline.tsx` | P0 | 3d |
| 2.5 | Implement `CommandPalette.tsx` slash command autocomplete | P1 | 2d |
| 2.6 | Implement `CommandToolbar.tsx` quick-action buttons | P1 | 1d |
| 2.7 | Session switcher UI (`SessionSwitcher.tsx`) | P1 | 2d |
| 2.8 | Message status indicators (queued → sent → delivered) | P1 | 1d |

**Milestone:** Full chat with real-time streaming, tool progress, and slash commands.

### Phase 3: Rich Media & Cards (Weeks 7-9)

**Goal:** Send/receive media and render rich tool result cards.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 3.1 | Implement `mediaService.ts` upload/download manager | P1 | 3d |
| 3.2 | Add `MediaPicker.tsx` (camera, gallery, files) | P1 | 2d |
| 3.3 | Add `MediaPreview.tsx` inline rendering | P1 | 2d |
| 3.4 | Build `CardRenderer.tsx` card type routing system | P1 | 1d |
| 3.5 | Implement card components (WebPreview, GitHub, Terminal, Diff, etc.) | P1 | 5d |
| 3.6 | Implement `mediaCompression.ts` | P1 | 1d |
| 3.7 | Implement `mediaCache.ts` LRU cache | P1 | 2d |
| 3.8 | Audio recording and playback for voice memos | P1 | 2d |

**Milestone:** Rich media exchange and beautiful tool result rendering.

### Phase 4: Asana Bridge (Weeks 10-11)

**Goal:** Bidirectional integration between OpenClaw agent and Asana board.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 4.1 | Implement `asanaBridge.ts` — map OpenClaw tool calls to board actions | P0 | 3d |
| 4.2 | Real-time board updates when agent modifies tasks | P0 | 2d |
| 4.3 | "Ask agent" and "Delegate to agent" actions on task cards | P1 | 2d |
| 4.4 | Unified activity feed (merge Asana + OpenClaw activities) | P1 | 2d |
| 4.5 | Agent task suggestions appearing as sub-tasks | P1 | 2d |

**Milestone:** Agent can drive the board; board actions can trigger agent workflows.

### Phase 5: Security & Encryption (Weeks 12-14)

**Goal:** E2E encryption and Tailscale native integration.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 5.1 | Implement E2E encryption (`e2eService.ts`, `keyManager.ts`) | P1 | 5d |
| 5.2 | Key exchange during pairing flow | P1 | 2d |
| 5.3 | Encrypted local message storage | P1 | 2d |
| 5.4 | Safety number verification UI (`KeyVerification.tsx`) | P1 | 2d |
| 5.5 | Tailscale SDK integration (`tailscaleService.ts`) | P1 | 4d |
| 5.6 | Tailscale-based auto-discovery and auth | P1 | 2d |
| 5.7 | Encrypted push notification payloads | P1 | 2d |

**Milestone:** All communication is E2E encrypted; Tailscale provides zero-config remote access.

### Phase 6: Notifications & Offline (Weeks 15-16)

**Goal:** Proactive notifications and robust offline support.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 6.1 | Push notification registration with Gateway | P0 | 2d |
| 6.2 | Notification categories and deep linking | P0 | 2d |
| 6.3 | Notification actions (reply, snooze, mark done) | P1 | 2d |
| 6.4 | Quiet hours and per-category preferences | P1 | 1d |
| 6.5 | Enhanced offline queue with encrypted persistence | P1 | 2d |
| 6.6 | Delta sync on reconnect | P1 | 2d |
| 6.7 | Offline skill catalog browsing | P2 | 1d |

**Milestone:** Agent proactively reaches user; app works seamlessly offline.

### Phase 7: Skills & Polish (Weeks 17-18)

**Goal:** Skill browser and final polish.

| # | Task | Priority | Est. |
|---|------|----------|------|
| 7.1 | Implement `skillStore.ts` and `useSkills.ts` | P2 | 2d |
| 7.2 | Build `SkillBrowser.tsx` catalog screen | P2 | 3d |
| 7.3 | Build `SkillDetail.tsx` with parameter form | P2 | 2d |
| 7.4 | Skill invocation from catalog and chat | P2 | 2d |
| 7.5 | Multi-gateway switching UX polish | P1 | 2d |
| 7.6 | Performance optimization (message virtualization, lazy media loading) | P1 | 3d |
| 7.7 | Accessibility audit and fixes | P1 | 2d |

**Milestone:** Feature-complete OpenClaw mobile channel.

---

## 7. Dependencies & New Packages

| Package | Purpose | Phase |
|---------|---------|-------|
| `libsignal-protocol-javascript` or `@stablelib/noise` | E2E encryption | 5 |
| `react-native-quick-crypto` | Fast native crypto primitives | 5 |
| `expo-image-picker` | Camera/gallery image selection | 3 |
| `expo-document-picker` | File selection | 3 |
| `expo-file-system` | File download/cache management | 3 |
| `react-native-tailscale` (or custom native module) | Tailscale SDK | 5 |
| `react-native-syntax-highlighter` | Code block highlighting in cards | 3 |
| `react-native-diff-view` or custom | Diff rendering in cards | 3 |
| `react-native-ansi` or custom | ANSI color rendering for terminal output | 3 |
| `@shopify/flash-list` | High-performance message list | 7 |

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Tailscale SDK not available for React Native / Expo | Blocks native Tailscale auth | Medium | Fallback to Tailscale Funnel URL + password auth; consider custom native module |
| E2E encryption perf on large media files | Slow media send/receive | Low | Stream encryption; compress before encrypt; skip E2E for non-sensitive media (user toggle) |
| Gateway protocol changes upstream | Breaks client compatibility | Medium | Abstract protocol behind `gatewayProtocol.ts`; version negotiation on connect |
| Expo managed workflow limits native module usage | Blocks Tailscale SDK, crypto libs | Medium | Use Expo dev client (custom builds) instead of Expo Go; already using EAS builds |
| WebSocket reliability on mobile networks | Dropped connections, lost messages | High | Aggressive reconnect; message deduplication; offline queue; ack-based delivery |
| Push notification delivery when app is killed | Missed proactive agent messages | Medium | Dual transport: WebSocket when connected, APNs/FCM when backgrounded; Gateway-side queue |

---

## 9. Success Criteria

- [ ] User can connect to OpenClaw Gateway from mobile app (local + remote)
- [ ] Full bidirectional text communication with agent through app
- [ ] Tool executions show real-time progress and rich result cards
- [ ] Agent can create/update tasks on the Asana board via chat
- [ ] User can delegate board tasks to the agent
- [ ] Push notifications arrive when app is backgrounded
- [ ] All messages are E2E encrypted
- [ ] App works offline with queued messages
- [ ] Slash commands accessible via command palette
- [ ] Skills browsable and invocable from dedicated UI
- [ ] Multiple Gateways configurable and switchable
- [ ] Pairing flow works for new device setup
- [ ] Media (images, files, audio) can be sent and received

---

## 10. Open Questions

1. **Gateway protocol stability**: Is the WebSocket protocol documented and versioned, or should we plan for frequent breaking changes?
2. **Push notification relay**: Does the Gateway support forwarding notifications to APNs/FCM, or do we need a relay service?
3. **Tailscale SDK licensing**: Are there licensing constraints for embedding Tailscale SDK in a mobile app?
4. **Encryption protocol choice**: Signal Protocol (battle-tested, complex) vs. Noise Protocol (simpler, sufficient for 1:1)? Recommend Noise given 1:1 only requirement.
5. **Message storage limits**: How much local encrypted storage is acceptable? Suggest 500MB default with configurable limit.
6. **Skill parameter validation**: Does the Gateway provide JSON Schema for skill parameters, or do we need to build validation client-side?
