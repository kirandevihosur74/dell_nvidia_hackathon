# ClawMobile: Pain Point Analysis & Build Priorities

**Date:** 2026-03-24
**Sources:**
- Reddit Deep Dive: `~/Desktop/LeetcodeAI/output/drafts/reddit-deep-dive-openclaw-messaging-pain-points.md`
- Architecture Spec: `~/Desktop/LeetcodeAI/output/drafts/system-architecture-clawmobile-recall-ai-meeting-bot.md`
- ClawMobile codebase (current state)

---

## Part 1: What We've Already Built That Addresses Pain Points

| Pain Point | Severity | What ClawMobile Already Has | Status |
|---|---|---|---|
| **Silent Failures / "Connected But Dead"** (#1, 12 mentions) | Critical | Gateway connection status indicators, auto-reconnect with exponential backoff, toast notifications for connection state changes | Partially Solved — we show connection status, but need proactive health checks |
| **Security / Gateway Exposure** (#3, 7 mentions) | Critical | E2E encryption, Cloudflare Tunnel pairing (not raw WebSocket exposure), device identity registration, key management | Largely Solved — our tunnel-based approach avoids the "923 exposed gateways" problem |
| **Multi-Channel Resource Contention** (#4, 6 mentions) | High | Our Messenger tab + Slack integration uses a unified bridge model rather than raw channel plugins — agent messages route through our backend, not directly to channel APIs | Partially Solved — we centralize routing, but haven't stress-tested multi-channel |
| **API Cost Explosion** (#7, 4 mentions) | High | Context Meter (token tracking per session), inference budget monitoring in Stream tab | Partially Solved — we track costs but don't enforce limits or alerts |
| **Pairing System Friction** (#8, 4 mentions) | Medium | Onboarding flow with pairing code, gateway selector (local/tunnel/public) | Solved — our pairing UX is streamlined vs. raw OpenClaw |
| **Slack Auth & Routing Bugs** (#6, 5 mentions) | High | Slack integration via slackStore with workspace management, channel bridging | Partially Solved — we abstract over raw Slack config, but rely on upstream |
| **Telegram Config Complexity** (#5, 6 mentions) | Medium | Not directly addressed — we don't have native Telegram integration | Not Solved |
| **WhatsApp Ban Risk** (#2, 8 mentions) | Critical | Not addressed — we don't use WhatsApp as a channel | N/A (correct decision — community consensus says avoid it) |

---

## Part 2: What's NOT Built Yet — Prioritized Backlog

### Priority 1: Solve the "Silent Failure" Problem (Highest Impact)

**Why:** This is the #1 pain point (12 mentions, strongly negative). Users' biggest frustration across ALL messaging platforms is "looks connected, actually broken."

**What to build:**
- **Health Check Dashboard** — A unified view showing real-time status of every connected service (Gateway, Slack workspaces, inference pipeline, Asana). Not just "connected/disconnected" but active heartbeat verification.
- **Proactive Error Surfacing** — When a message send fails silently, surface it in the Activity tab with actionable diagnostics (e.g., "Slack delivery failed: missing_recipient_team_id — reconfigure workspace OAuth").
- **`openclaw doctor` equivalent** — A "Diagnose" button in Settings that runs connectivity checks across all integrations and reports issues.

**Effort:** Medium | **Impact:** Very High

---

### Priority 2: Meeting Bot Integration (Recall.ai) — Phase 1-2

**Why:** This is the major architectural differentiator. No competitor offers "paste a meeting URL, get live AI copilot." The architecture spec is complete and the backend infrastructure already exists from Executive Coach.

**What to build (in order):**
1. `MeetingBotInput` component — URL paste + routing mode selector
2. `BotStatusIndicator` — join/record/done/error states
3. Gateway context injection middleware (backend)
4. `MeetingTranscriptPanel` — live transcript display
5. `ActionItemsList` — confirmation UI before Asana push
6. Integration with existing OpenClaw and Stream tabs

**Effort:** Large | **Impact:** Very High (unique differentiator)

---

### Priority 3: Cost Controls & Budget Alerts

**Why:** #7 pain point. Users report $400-$3,600/month bills. We have a Context Meter and inference budget tracker, but no alerts or limits.

**What to build:**
- **Budget Alerts** — Configurable thresholds (e.g., "alert me at $10/day") with push notifications
- **Session Cost Summary** — End-of-session cost breakdown (tokens used, estimated cost per agent)
- **Rate Limiting UI** — Let users set max requests/minute per agent in the inference pipeline
- **Meeting Bot Cost Estimator** — Show estimated cost before deploying ($0.65/hr + inference) with a running meter during the meeting

**Effort:** Small-Medium | **Impact:** High

---

### Priority 4: Multi-Channel Message Reliability

**Why:** Pain points #4 (multi-channel contention) and #6 (Slack bugs) directly affect our Messenger + Slack integration layer.

**What to build:**
- **Message Delivery Receipts** — Track whether messages sent via agent->Messenger->Slack actually arrived. Show delivery status per message (sent/delivered/failed).
- **Channel Priority & Fallback** — If Slack delivery fails, offer to retry or route to Messenger instead.
- **Unified Inbox with Source Tags** — Activity tab should clearly show which channel each message came from and went to, making cross-channel debugging visible.

**Effort:** Medium | **Impact:** High

---

### Priority 5: Telegram Integration

**Why:** Community consensus is Telegram is the safest, most reliable channel for AI agents (15+ positive mentions, "the only channel designed for this"). We currently don't have it.

**What to build:**
- **Telegram Bridge** in Messenger tab — similar to our Slack bridge, but using the official Bot API
- **Simplified Config** — Abstract away the numeric user ID vs. @username confusion, group ID format changes, and allowFrom config that plague raw OpenClaw setups
- **Group Support** — Handle supergroup ID migration transparently

**Effort:** Medium | **Impact:** Medium-High (fills a gap the community explicitly wants)

---

### Priority 6: Offline Resilience & Message Queuing

**Why:** Multiple pain points relate to messages being lost or stuck. We have partial offline support, but it needs hardening.

**What to build:**
- **Offline Message Queue** with retry — messages composed offline get queued and sent when connectivity returns, with clear visual status
- **Meeting Bot Resilience** — If the app loses connection during a meeting, the bot should keep recording and sync when reconnected
- **Conflict Resolution** — When messages arrive out of order from multiple channels, merge intelligently

**Effort:** Medium | **Impact:** Medium

---

## Summary: Recommended Build Order

| Priority | Feature | Pain Points Addressed | Impact | Effort |
|---|---|---|---|---|
| **P1** | Health Check / Silent Failure Detection | #1 (12 mentions) | Very High | Medium |
| **P2** | Meeting Bot (Recall.ai) Phase 1-2 | Architecture spec (unique differentiator) | Very High | Large |
| **P3** | Cost Controls & Budget Alerts | #7 (4 mentions, $3.6K bills) | High | Small |
| **P4** | Multi-Channel Delivery Reliability | #4, #6 (11 mentions combined) | High | Medium |
| **P5** | Telegram Integration | #5 (6 mentions, community #1 rec) | Medium-High | Medium |
| **P6** | Offline Resilience | Message loss reports | Medium | Medium |

---

## Part 3: Concrete Solutions (Grounded in Current Codebase)

### Solution 1: Health Check System — Kill Silent Failures

**Problem:** Users see "connected" but messages vanish. Our `GatewayStatusBar` only shows WebSocket state — it doesn't verify the full pipeline (Gateway -> Agent -> Slack -> delivery).

**What we have today:**
- `GatewayStatusBar` with `friendlyError()` translation (5 error patterns recognized)
- Heartbeat ping/pong every 30s in `gatewayClient.ts` (keepalive only, no deep check)
- Toast store with success/error/warning/info types
- Activity tab with error-type activity items
- Slack bridge failures silently `console.warn()` with no user-facing notification
- Messenger `failMessage()` marks status as `"error"` but no toast/alert fires

**Solution: Three-Layer Health System**

**Layer 1 — Integration Health Store** (`stores/healthStore.ts`)
```
New Zustand store tracking health of every connected service:

interface ServiceHealth {
  id: string;                    // "gateway" | "slack:<teamId>" | "asana" | "inference"
  name: string;                  // "OpenClaw Gateway" | "Slack (Acme Corp)" | etc.
  status: "healthy" | "degraded" | "down" | "unchecked";
  lastChecked: string;           // ISO timestamp
  lastHealthy: string;           // ISO timestamp of last successful check
  error: string | null;          // Human-readable error if degraded/down
  latencyMs: number | null;      // Round-trip time of last health check
}
```

Health checks run on a 60s interval (configurable). Each service has a dedicated check:
- **Gateway:** Send `ping` via WebSocket, measure round-trip (already have heartbeat — extend it to report latency)
- **Slack workspaces:** `GET /workspaces/:teamId/health` — verify OAuth tokens still valid, workspace reachable
- **Asana:** `GET /api/v1/asana/me` — verify PAT still valid
- **Inference pipeline:** `GET /api/v1/inference/health` — verify Socket.IO namespace responding
- **Messenger:** Verify Gateway `messenger:` event subscription is active

**Layer 2 — Proactive Error Surfacing**

Extend existing patterns to close the silent failure gaps:

| Current Gap | Fix |
|---|---|
| Slack bridge `console.warn()` on failure | Add `toastStore.error("Slack bridge failed: ...")` + log to Activity tab as `"channel_error"` type |
| Messenger `failMessage()` is store-only | Fire `toastStore.error("Message failed to send")` with retry action button |
| Agent invocation errors update placeholder only | Add `toastStore.warning("Agent didn't respond — check gateway")` |
| No alert when heartbeat fails | After 2 missed pongs, fire `toastStore.warning("Gateway connection unstable")` |

**Layer 3 — "Diagnose" Button in Settings**

Add a "System Diagnostics" section to `app/(tabs)/settings.tsx`:
- Runs all health checks immediately (not waiting for interval)
- Shows a checklist UI: each service with green checkmark / red X / yellow warning
- For failed checks, shows the specific error + a "Fix" action (e.g., "Re-authenticate Slack" links to OAuth flow, "Check Gateway" links to GatewayPicker)
- Results can be shared (copy to clipboard as text) for support/debugging
- Equivalent of `openclaw doctor --fix` but in a mobile-native UI

**Files to create/modify:**
- NEW: `stores/healthStore.ts`
- NEW: `hooks/useHealthCheck.ts` (interval runner)
- NEW: `components/settings/SystemDiagnostics.tsx`
- MODIFY: `app/(tabs)/settings.tsx` (add Diagnostics section)
- MODIFY: `services/messenger/slackService.ts` (add toast on failures)
- MODIFY: `services/messenger/messengerService.ts` (add toast on `failMessage`)
- MODIFY: `services/gateway/gatewayClient.ts` (extend heartbeat to report latency + missed pong alerts)
- MODIFY: `app/(tabs)/activity.tsx` (add `"channel_error"` and `"health_alert"` activity types)

---

### Solution 2: Meeting Bot (Recall.ai) — Phase 1 Mobile UI

**Problem:** Users in live meetings can't leverage OpenClaw agents or the inference pipeline in real-time.

**What we have today:**
- Full OpenClaw chat with streaming, tool timeline, agent selection
- Stream tab with camera inference, pipeline builder, agent toggle panel
- Asana Bridge for confirmed task creation
- Backend at `api.streamio.ai` with existing Recall.ai infrastructure from Executive Coach
- E2E encryption for transcript storage
- Activity tab for event feed

**Solution: Additive Meeting Bot Layer**

**New Store:** `stores/meetingBotStore.ts`
```
interface MeetingBotState {
  botId: string | null;
  meetingUrl: string;
  platform: "zoom" | "meet" | "teams" | "webex" | "slack_huddle" | null;
  routingMode: "gateway" | "inference" | "both";
  status: "idle" | "deploying" | "joining" | "recording" | "done" | "error";
  statusError: string | null;
  transcript: TranscriptLine[];         // rolling buffer, last 50 lines
  actionItems: ActionItem[];            // detected by agents, pending user confirmation
  confirmedActionItems: string[];       // IDs pushed to Asana
  selectedAgentIds: string[];           // which agents receive meeting context
  costAccumulator: { minutes: number; recallCost: number; inferenceCost: number };
}
```

**New Components:**

1. `components/meeting/MeetingBotInput.tsx`
   - Text input for meeting URL with paste button
   - Auto-detect platform from URL (regex: zoom.us, meet.google.com, teams.microsoft.com, etc.)
   - `PlatformBadge` shows detected platform icon
   - `RoutingModeSelector` — three toggle buttons: Gateway | Inference | Both
   - Agent selector (reuse existing `AgentSelector` component)
   - Cost estimate display: "~$0.65/hr recording + ~$X.XX/hr inference"
   - "Deploy Bot" button → `POST /api/v1/recall/bot`

2. `components/meeting/BotStatusIndicator.tsx`
   - Pill-shaped indicator showing bot lifecycle state
   - Color-coded: gray (idle), blue (deploying/joining), green (recording), red (error), purple (done)
   - "Remove Bot" action when status is recording
   - Elapsed time counter during recording

3. `components/meeting/MeetingTranscriptPanel.tsx`
   - Scrollable list of transcript lines with speaker labels and timestamps
   - Auto-scroll to bottom, pause on user scroll-up
   - Search within transcript
   - Encryption badge (reuse from E2E components)

4. `components/meeting/ActionItemsList.tsx`
   - Cards for each detected action item: owner, description, due date
   - Swipe to confirm → pushes to Asana via existing bridge
   - Swipe to dismiss
   - Batch confirm/dismiss all
   - Source attribution: "Detected at 14:32 from [speaker name]'s statement"

**Integration Points (no existing code modified in behavior):**
- OpenClaw tab: Add `MeetingBotInput` as a collapsible panel above the chat input. When meeting is active, show `BotStatusIndicator` in the header bar alongside `GatewayStatusBar`.
- Stream tab: Meeting inference results appear in the existing `InferenceChatFeed` with a "Meeting" source badge (vs. "Camera" source badge). Existing camera streaming continues independently.
- Activity tab: New activity types `"meeting_started"`, `"meeting_action_item"`, `"meeting_ended"` with meeting-specific icons.
- Board tab: Action items confirmed from meetings appear as Asana tasks (via existing bridge — no board changes needed).

**New Service:** `services/meetingBotService.ts`
- `deployBot(meetingUrl, routingMode, agentIds)` → POST to backend
- `removeBot(botId)` → POST leave call
- `subscribeToBotEvents()` → listen for `meeting:status`, `meeting:transcript`, `meeting:action_item` events via Gateway WebSocket
- `confirmActionItem(itemId)` → POST confirm → Asana bridge
- URL validation with platform-specific regex patterns

**Backend work required (out of mobile scope but needed):**
- Extend `recallBotService` for ClawMobile client type
- Build `meetingContextMiddleware` for Gateway context injection
- Add `meeting:*` event types to Gateway WebSocket protocol
- Webhook handlers for Recall.ai status + transcript events

---

### Solution 3: Cost Controls & Budget Alerts

**Problem:** Users hit $400-$3,600/month bills. Our Context Meter tracks tokens but doesn't warn or limit.

**What we have today:**
- `ContextMeter` polling every 10s with color-coded bar (green/yellow/orange/red at 50/75/90%)
- `inferenceStore.budgetDisplay` with `tokensUsed`, `estimatedCost`, `requestsThisMinute`, `budgetRemaining`
- Per-agent token tracking via `incrementAgentTokens()`
- Toast store for alerts
- Push notification infrastructure in `notificationStore`
- Settings tab with configurable values

**Solution: Budget Alert System**

**Extend `stores/settingsStore.ts`:**
```
// New fields
budgetAlerts: {
  enabled: boolean;
  dailyLimitUsd: number;          // default: 10.00
  sessionWarningUsd: number;      // default: 2.00
  meetingWarningUsd: number;      // default: 5.00
  alertOnHighRate: boolean;       // alert if >$1/min sustained for 2+ min
}
```

**New: `hooks/useBudgetAlerts.ts`**
- Subscribe to `contextStore` and `inferenceStore` budget updates
- When `estimatedCost` crosses `sessionWarningUsd`: fire toast warning + optional push notification
- When daily aggregate crosses `dailyLimitUsd`: fire toast error + push notification + optionally pause inference pipeline
- When cost rate exceeds $1/min for 2+ minutes: fire toast with "High burn rate — $X.XX in last 2 min"
- Debounced (only alert once per threshold crossing per session)

**New: `components/settings/BudgetSettings.tsx`**
- Sliders for daily limit, session warning, meeting warning thresholds
- Toggle for high-rate alerts
- Toggle for auto-pause inference on daily limit

**Enhance existing `ContextMeter.tsx`:**
- Add cost rate indicator: "$0.03/min" in compact mode
- Flash animation when crossing warning threshold
- Tap expanded view shows: "Session: $1.42 | Today: $7.83 / $10.00 limit"

**Enhance existing `inferenceStore` budget display:**
- Add `dailyTotalCost` field, persisted to AsyncStorage daily
- Reset at midnight (or configurable reset time)
- `budgetRemaining` calculated from `dailyLimitUsd - dailyTotalCost`

**Session Cost Summary (end-of-session):**
- When a Gateway session ends or meeting bot stops, show a summary toast/modal:
  - Total tokens (input/output)
  - Total cost breakdown by agent
  - Duration
  - Cost per minute average
- Logged as activity item in Activity tab

---

### Solution 4: Multi-Channel Message Reliability

**Problem:** Messages get lost crossing Slack/Messenger bridges. No delivery receipts. Silent failures.

**What we have today:**
- Message status enum: `"optimistic" | "sent" | "delivered" | "error"`
- `confirmMessage()` replaces optimistic with server version
- `failMessage()` sets status to `"error"` — but only on immediate send failure
- Slack bridge operations silently `console.warn()` on failure
- No tracking of whether a Slack-bridged message actually reached Slack

**Solution: Delivery Pipeline Visibility**

**Extend `MessengerMessageStatus`:**
```
type MessengerMessageStatus =
  "optimistic" | "sent" | "delivered" | "bridged" | "bridge_failed" | "error";
```

New states:
- `"bridged"` — message confirmed delivered to bridged channel (Slack/Telegram)
- `"bridge_failed"` — message reached Messenger but failed to cross bridge

**New Gateway events to handle:**
- `messenger:message:bridged` — backend confirms cross-channel delivery
- `messenger:message:bridge_failed` — backend reports bridge delivery failure with reason

**UI changes in message bubbles:**
- Tiny status icon below message: single check (sent), double check (delivered), channel icon (bridged), red X (failed)
- Tap failed message → shows error reason + "Retry" or "Send via Messenger only" options

**Extend `slackService.ts` error handling:**
- Replace all `console.warn()` catch blocks with:
  1. `toastStore.error("Slack: [specific error]")` for user visibility
  2. Log to Activity tab as `"channel_error"` type
  3. Return structured error object (not null) so callers can show inline error state

**Channel Health in Messenger Tab:**
- Small status dot on each channel in the channel list
- Green: last message delivered successfully
- Yellow: no recent activity (stale)
- Red: last delivery failed
- Tap shows last error + "Diagnose" link to System Diagnostics

**Retry Queue for Bridge Failures:**
- Failed bridge deliveries queued in `offlineStore` as `"retry_bridge"` pending action type
- Auto-retry on next health check success for that channel
- Max 3 retries, then mark as permanently failed with user notification

---

### Solution 5: Telegram Integration

**Problem:** Community consensus says Telegram is the best channel for AI agents (official Bot API, zero ban risk). We don't have it.

**What we have today:**
- Slack bridge pattern: `slackStore` + `slackService` + `slackApi` — OAuth flow, channel discovery, bridging, history sync
- Messenger as the hub: all bridged messages flow through Messenger store
- Gateway WebSocket for event delivery

**Solution: Mirror the Slack Bridge Pattern for Telegram**

**New files (mirroring Slack structure):**
- `stores/telegramStore.ts` — bots, channels, bridges, user mappings
- `services/messenger/telegramService.ts` — bot connection, channel discovery, bridging
- `services/messenger/telegramApi.ts` — HTTP client for backend Telegram endpoints
- `types/telegram.ts` — TelegramBot, TelegramChat, TelegramBridge interfaces
- `components/settings/TelegramSettingsSection.tsx` — settings UI

**Store shape:**
```
interface TelegramState {
  bots: TelegramBot[];                  // connected bot tokens
  activeBotId: string | null;
  availableChats: TelegramChat[];       // groups, supergroups, private chats
  bridges: TelegramBridge[];            // chat <-> Messenger channel mappings
  isConnecting: boolean;
  connectionError: string | null;
}
```

**Connection flow (simpler than Slack — no OAuth needed):**
1. User enters Bot API token in Settings (obtained from @BotFather)
2. `telegramService.connectBot(token)` → `POST /api/v1/telegram/bots` to backend
3. Backend validates token via `getMe()`, stores it, starts polling
4. Returns bot info (username, id, can_join_groups)
5. Store updates with new bot

**Channel discovery:**
- `fetchAvailableChats()` → backend returns groups/supergroups the bot is a member of
- Handles supergroup ID migration transparently (backend normalizes `-100` prefix format)
- Shows chat type badge: "Group", "Supergroup", "Private"

**Bridging (same pattern as Slack):**
- `bridgeChat(telegramChatId, options)` → creates Messenger channel linked to Telegram chat
- Options: `syncDirection`, `syncReactions`, `syncThreads`
- Messages flow: Telegram → backend webhook → Gateway event → Messenger store
- Outbound: Messenger send → Gateway → backend → Telegram `sendMessage` API

**Key UX improvements over raw OpenClaw Telegram:**
- No numeric user ID confusion — backend resolves usernames to IDs automatically
- No `allowFrom` config — bridge whitelist managed per-chat in the store
- No manual pairing approval — bot membership in a group = approved
- No forum/topic thread ID breakage — backend tracks topic migrations

**Settings UI:**
- Add `<TelegramSettingsSection />` to Settings tab (alongside existing Slack section)
- Bot list with connection status, username, chat count
- "Add Bot" flow with token input + validation
- Per-bot chat browser with bridge toggle

---

### Solution 6: Offline Resilience & Message Queuing

**Problem:** Messages lost when connectivity drops. No visibility into queue state.

**What we have today:**
- `offlineStore` with `pendingActions` queue (typed: move/create/update/delete task)
- `useOfflineSync` hook: flushes queue when online, sequential processing
- `OfflineBanner` showing offline state + pending action count
- OpenClaw message queue with idempotency keys
- `offlineService` for conversation/message caching

**Solution: Unified Resilient Queue**

**Extend `offlineStore` pending action types:**
```
type PendingActionType =
  | "move_task" | "create_task" | "update_task" | "delete_task"  // existing
  | "send_message"         // Messenger message
  | "send_openclaw"        // OpenClaw chat message
  | "retry_bridge"         // failed bridge delivery
  | "confirm_action_item"  // meeting bot action item
  | "slack_operation";     // queued Slack bridge operation
```

**Enhanced `useOfflineSync` hook:**
- Priority ordering: `send_message` > `send_openclaw` > `confirm_action_item` > `retry_bridge` > task operations
- Per-action retry count with max (3 for messages, 5 for tasks)
- Exponential backoff per failed action (not just per flush cycle)
- Partial flush: if one action fails, skip it and continue with others (don't block queue)

**Enhanced `OfflineBanner`:**
- Show breakdown: "3 messages, 1 task, 1 bridge retry pending"
- Tap to expand and see individual queued items
- Swipe to manually remove stuck items
- Progress indicator during flush

**Messenger offline improvements:**
- When `failMessage()` fires and device is offline, auto-queue as `"send_message"` pending action
- When device comes back online, flush message queue before other actions
- Idempotency keys prevent duplicate delivery (already have this pattern in OpenClaw — extend to Messenger)

**Meeting bot resilience:**
- Bot runs server-side — app disconnect doesn't stop recording
- On reconnect: `GET /api/v1/recall/bot/:botId/catchup` returns missed transcript lines + action items
- Store merges catchup data with existing state
- If app was killed during meeting: next launch checks for active bot via `GET /api/v1/recall/bot/active`

---

## Implementation Order & Dependencies

```
Phase 1 (Weeks 1-2): Foundation
├── healthStore + useHealthCheck + SystemDiagnostics     [Solution 1, Layer 1+3]
├── Budget settings + useBudgetAlerts                     [Solution 3]
└── Fix silent failures (toast on Slack/Messenger errors) [Solution 1, Layer 2]

Phase 2 (Weeks 3-5): Meeting Bot MVP
├── meetingBotStore + meetingBotService                   [Solution 2]
├── MeetingBotInput + BotStatusIndicator                  [Solution 2]
├── MeetingTranscriptPanel + ActionItemsList              [Solution 2]
└── Backend: extend recallBotService + meetingContextMiddleware

Phase 3 (Weeks 6-7): Delivery Reliability
├── Extended message status types + bridge events         [Solution 4]
├── Delivery status UI in message bubbles                 [Solution 4]
├── Channel health indicators                             [Solution 4]
└── Unified offline queue                                 [Solution 6]

Phase 4 (Weeks 8-9): Telegram
├── telegramStore + telegramService + telegramApi         [Solution 5]
├── TelegramSettingsSection                               [Solution 5]
└── Backend: Telegram Bot API webhook handler + bridge service
```

---

## Key Insight

Our architecture already avoids the worst OpenClaw problems (exposed gateways, WhatsApp ban risk, raw channel plugin complexity) by design. The Cloudflare Tunnel pairing, E2E encryption, and centralized backend routing mean we're not just wrapping OpenClaw's broken defaults — we're building a proper mobile integration layer on top.

The biggest wins now are:
1. **Making failures visible instead of silent** — the universal #1 pain point
2. **Shipping the meeting bot** — a category-defining feature no one else has
