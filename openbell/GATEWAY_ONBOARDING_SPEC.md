# Gateway Onboarding — Zero-Friction First Chat Experience

**Date:** 2026-03-25
**Status:** Planned
**Goal:** Reduce download → first chat from 6 manual steps to 1-2 taps

---

## Current Flow (6 steps, ~3 minutes)

1. Download app from TestFlight / App Store
2. Open app → onboarding screen (API key setup)
3. Navigate to OpenClaw tab → tap "Tap to manage"
4. Open GatewayPicker → tap "+" to add new gateway
5. Manually enter: name, host (Tailscale hostname or IP), port (18789), auth method, password, provider type
6. Connect → pair → discover agents → start chatting

**Biggest friction:** Step 5 — users must know their Tailscale hostname/IP, the correct port, and enter it without typos. Non-technical users will abandon here.

---

## Solution 1: QR Code Pairing (Recommended First)

**Effort:** Low-Medium
**Impact:** Eliminates all manual entry — scan and chat

### How It Works

1. Gateway (running on user's machine) displays a QR code in its terminal/web UI
2. User opens ClawMobile → taps "Scan to Connect" on the onboarding screen
3. App scans QR → auto-configures gateway → connects → discovers agents
4. User is chatting within 10 seconds of scanning

### QR Code Payload

```json
{
  "type": "clawmobile-gateway",
  "version": 1,
  "name": "Felix's MacBook",
  "host": "felix-macbook.tail1234.ts.net",
  "port": 18789,
  "auth": "password",
  "password": "mypass123",
  "provider": "openclaw"
}
```

Encoded as a URL for deep linking:
```
clawmobile://gateway?name=Felix%27s+MacBook&host=felix-macbook.tail1234.ts.net&port=18789&auth=password&pwd=mypass123&provider=openclaw
```

### Implementation

**Gateway side:**
- Generate QR code containing the connection payload (JSON or deep link URL)
- Display in terminal (`qrcode-terminal` npm package) or web dashboard
- QR refreshes every 5 minutes with a new password/token for security
- Command: `clawd pair` or accessible from Gateway web UI

**Mobile side:**
- Add `expo-camera` barcode scanner (already in dependencies)
- New `ScanGatewayScreen` — camera view with QR overlay
- Parse QR payload → create `GatewayConfig` → auto-connect
- Add "Scan to Connect" button on onboarding screen and GatewayPicker
- Deep link handler for `clawmobile://gateway?...` URLs (works from Safari, Messages, etc.)

**Files to create/modify:**
- `app/scan-gateway.tsx` — QR scanner screen
- `services/gateway/qrPairing.ts` — parse QR payload, validate, create config
- `app/onboarding/index.tsx` — add "Scan to Connect" button
- `components/openclaw/GatewayPicker.tsx` — add scan option alongside manual "+"
- `app.json` — register `clawmobile://` URL scheme

---

## Solution 2: Tailscale Auto-Discovery

**Effort:** Medium
**Impact:** Zero-tap for Tailscale users — gateways appear automatically

### How It Works

1. User has Tailscale installed on both their phone and their computer
2. App queries the Tailscale local API to discover other devices on the tailnet
3. App probes discovered devices on port 18789 for an OpenClaw Gateway
4. Available Gateways appear in a "Discovered" section of the GatewayPicker
5. User taps one → connects immediately

### Tailscale Local API

```
GET http://127.0.0.1:41112/localapi/v0/status
```

Returns:
```json
{
  "Peer": {
    "nodekey:abc123": {
      "HostName": "felix-macbook",
      "DNSName": "felix-macbook.tail1234.ts.net",
      "Online": true,
      "TailscaleIPs": ["100.64.1.2"]
    }
  }
}
```

### Implementation

**Mobile side:**
- `services/gateway/tailscaleDiscovery.ts` — query local Tailscale API, probe peers for Gateway
- Probe: `GET http://{peer}:18789/health` or custom discovery endpoint on the Gateway
- Cache discovered gateways, refresh on pull-to-refresh
- Show "Discovered on Tailscale" section in GatewayPicker with one-tap connect
- Fallback gracefully if Tailscale isn't installed (just don't show the section)

**Gateway side:**
- Expose a `/discovery` endpoint that returns:
  ```json
  {
    "name": "Felix's MacBook",
    "provider": "openclaw",
    "port": 18789,
    "auth": "password",
    "version": "1.0.0"
  }
  ```
- This endpoint is unauthenticated (just metadata, no sensitive data)

**Considerations:**
- Tailscale local API access may require special permissions on iOS
- The Tailscale iOS app must be running for the local API to be available
- Not all users have Tailscale — this is an enhancement, not the primary flow

---

## Solution 3: Invite Code (6-digit)

**Effort:** Medium
**Impact:** Works without Tailscale — shareable over text/voice

### How It Works

1. User runs `clawd invite` on their machine
2. Gateway generates a 6-character code (e.g., `CLAW-7X9K`) and registers it with `api.streamio.ai`
3. User opens ClawMobile → types the invite code
4. App resolves the code to connection details via the cloud relay
5. App connects to the Gateway

### Flow

```
Gateway                          Cloud (api.streamio.ai)              Mobile App
   |                                      |                              |
   |-- POST /invite/register ------------>|                              |
   |   { code: "CLAW-7X9K",              |                              |
   |     host: "felix.ts.net",           |                              |
   |     port: 18789, ... }              |                              |
   |                                      |                              |
   |                                      |<-- GET /invite/CLAW-7X9K ---|
   |                                      |                              |
   |                                      |--- { host, port, auth } --->|
   |                                      |                              |
   |<------------------------------------- WebSocket connect ------------|
```

### Implementation

**Backend (api.streamio.ai):**
- `POST /api/v1/invite/register` — Gateway registers an invite code (expires in 10 minutes)
- `GET /api/v1/invite/:code` — Mobile app resolves code to connection details
- Store in Redis or in-memory with TTL
- Rate limit: 10 codes per Gateway per hour

**Gateway side:**
- `clawd invite` command generates code, registers with cloud, displays to user
- Code expires after 10 minutes or first use (one-time)

**Mobile side:**
- Invite code input on onboarding screen (large, centered, 6-character input)
- Resolves via API → auto-configures and connects
- Error handling: expired code, invalid code, Gateway offline

---

## Solution 4: Cloud Relay (Zero Config)

**Effort:** High
**Impact:** No Tailscale needed — works from anywhere with just an account

### How It Works

1. User signs up / signs in to ClawMobile (email or Apple Sign-In)
2. Gateway authenticates with the same account: `clawd login`
3. Gateway registers as available with `api.streamio.ai`
4. Mobile app sees "Your Gateways" — lists all Gateways linked to the account
5. User taps a Gateway → connection is brokered through the cloud relay
6. After initial connection, direct P2P via Tailscale/WireGuard (cloud relay is just for discovery + NAT traversal)

### Architecture

```
Gateway                    Cloud Relay                    Mobile App
   |                           |                              |
   |-- Register (auth) ------->|                              |
   |   "felix-macbook online"  |                              |
   |                           |<-- List My Gateways ---------|
   |                           |--- ["felix-macbook"] ------->|
   |                           |                              |
   |<-- Relay connect ---------|<-- Connect to felix ---------|
   |                           |                              |
   |<========= P2P tunnel (after relay handshake) ==========>|
```

### Implementation

**Backend (api.streamio.ai):**
- Gateway heartbeat endpoint: `POST /api/v1/gateways/heartbeat` (every 30s)
- Gateway list: `GET /api/v1/gateways/mine` (returns user's online gateways)
- WebSocket relay for initial connection establishment
- Upgrade to P2P after relay handshake

**Gateway side:**
- `clawd login` — authenticate with api.streamio.ai
- Background heartbeat process
- Accept relayed connections

**Mobile side:**
- "Your Gateways" section shows account-linked gateways
- One-tap connect through relay
- No IP addresses, no ports, no Tailscale required for basic usage

**Considerations:**
- Adds cloud dependency (Gateway must be online and heartbeating)
- Relay adds latency vs direct connection
- Privacy: all messages route through cloud relay unless P2P is established
- Highest effort but best UX

---

## Solution 5: Default Demo Gateway

**Effort:** Low
**Impact:** Immediate first chat — no setup at all

### How It Works

1. User downloads and opens the app
2. App ships with a pre-configured "Demo Gateway" pointing to a hosted OpenClaw instance
3. User can chat immediately with a demo agent
4. Banner: "You're using the demo. Add your own Gateway for full features."

### Implementation

- Host a lightweight OpenClaw instance on `demo.clawmobile.app` or similar
- Pre-configure in `pairingService.ts` → `loadGateways()` returns demo gateway if no saved gateways
- Demo agent has limited capabilities (no file access, no terminal, no tools)
- Prompt user to add their own Gateway after first conversation

**Considerations:**
- Hosting cost for the demo instance
- Demo agent capabilities must be limited (security)
- Users may think the demo IS the product — need clear messaging

---

## Recommended Build Order

| Order | Solution | Effort | Why |
|-------|----------|--------|-----|
| 1 | **QR Code Pairing** | Low-Medium | Fastest win. Eliminates ALL manual entry. Works today with Tailscale. |
| 2 | **Invite Code** | Medium | Works over text/voice — "just type CLAW-7X9K". No camera needed. |
| 3 | **Demo Gateway** | Low | Instant gratification for new users. Try before you configure. |
| 4 | **Tailscale Auto-Discovery** | Medium | Magic for Tailscale users — gateways just appear. |
| 5 | **Cloud Relay** | High | Ultimate zero-config. Build last when user base justifies infra cost. |

---

## Combined Onboarding Flow (Target State)

```
Download App
    |
    v
Welcome Screen
    |
    ├── "Scan QR Code" ──────> Camera → Scan → Connected (10 sec)
    |
    ├── "Enter Invite Code" ──> 6-char input → Resolve → Connected (15 sec)
    |
    ├── "Try Demo" ──────────> Instant chat with demo agent (0 sec)
    |
    ├── "Auto-Discovered" ───> [Tailscale gateways listed] → Tap → Connected (5 sec)
    |
    └── "Manual Setup" ──────> Current GatewayPicker form (advanced users)
```

Every path leads to a connected chat in under 15 seconds except manual setup.

---

## UX Principles

1. **First chat in under 30 seconds** — this is the north star metric
2. **No IP addresses in the happy path** — QR, invite codes, and auto-discovery hide networking
3. **Progressive disclosure** — show simple options first, manual setup for power users
4. **Works offline from Gateway** — Tailscale handles the networking, we handle the UX
5. **Fail gracefully** — if QR scan fails, offer invite code. If invite fails, offer manual. Always a path forward.
