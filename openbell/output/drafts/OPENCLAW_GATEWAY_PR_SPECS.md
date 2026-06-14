# OpenClaw Gateway PR Specifications

Two PRs to add cloud-assisted discovery and relay to OpenClaw Gateway.

All cloud features are **opt-in and backend-agnostic** — the Gateway reads `cloud.apiUrl` and `cloud.relayUrl` from its config. No specific backend is hardcoded. Any server implementing the Cloud Relay Protocol (defined below) is compatible.

---

## Cloud Relay Protocol Specification

The protocol defines a set of HTTP and WebSocket endpoints that any backend can implement to support invite codes, gateway registry, and connection relay for OpenClaw-compatible mobile apps.

### Invite Code Endpoints (No Auth Required)

#### Register Invite Code
```
POST {cloud.apiUrl}/api/v1/invite/register
Content-Type: application/json

Request:
{
  "code": "CLAW-7X9K",
  "gatewayName": "Felix's MacBook",
  "url": "ws://10.243.184.142:18789"
}

Response: 201 Created
{
  "success": true,
  "code": "CLAW-7X9K",
  "expiresAt": "2026-03-27T12:10:00Z"
}

Errors: 409 (code collision), 429 (rate limited), 400 (invalid format)
```

#### Resolve Invite Code
```
GET {cloud.apiUrl}/api/v1/invite/{code}

Response: 200 OK
{
  "success": true,
  "gatewayName": "Felix's MacBook",
  "url": "ws://10.243.184.142:18789"
}

Errors: 404 (invalid/expired/used), 429 (rate limited)
Side effect: code is consumed (one-time use)
```

### Gateway Registry Endpoints (Bearer JWT Auth Required)

#### Register Gateway
```
POST {cloud.apiUrl}/api/v1/gateways/register
Authorization: Bearer <jwt>
Content-Type: application/json

Request:
{
  "gatewayId": "unique-gateway-id",
  "name": "Felix's MacBook",
  "host": "10.243.184.142",
  "port": 18789,
  "provider": "openclaw",
  "metadata": { "os": "darwin", "openclawVersion": "1.2.0" }
}

Response: 201 Created
Idempotent: calling again with same gatewayId updates the record.
```

#### Heartbeat
```
POST {cloud.apiUrl}/api/v1/gateways/heartbeat
Authorization: Bearer <jwt>
Content-Type: application/json

Request:
{ "gatewayId": "unique-gateway-id" }

Response: 200 OK
Frequency: every 30 seconds. Gateway marked "offline" if stale > 60s.
```

#### List User's Gateways
```
GET {cloud.apiUrl}/api/v1/gateways/mine
Authorization: Bearer <jwt>

Response: 200 OK
{
  "success": true,
  "gateways": [{
    "gatewayId": "...",
    "name": "Felix's MacBook",
    "host": "10.243.184.142",
    "port": 18789,
    "provider": "openclaw",
    "status": "online",
    "lastHeartbeat": "2026-03-27T12:00:30Z"
  }]
}
```

#### Remove Gateway
```
DELETE {cloud.apiUrl}/api/v1/gateways/{gatewayId}
Authorization: Bearer <jwt>

Response: 204 No Content
```

### WebSocket Relay

```
Connect: WSS {cloud.relayUrl}/gateway-relay
Auth handshake: { token: "<jwt>", role: "gateway"|"mobile", gatewayId: "<id>" }
```

**Events:**
- `relay:message` — bidirectional, carries Gateway protocol messages as-is
- `relay:status` — `{gatewayId, online}` notification to mobile clients

**Rooms:** Gateway joins `gateway:{gatewayId}`, mobile joins `mobile:{gatewayId}`. Server passes `relay:message` events between the two rooms.

### Authentication

The protocol supports any OAuth2/JWT provider. The backend validates Bearer tokens however it chooses (Kinde, Auth0, Firebase, custom). The Gateway and mobile app must authenticate with the same provider so `userId` matches on both sides.

---

## Gateway Configuration

All cloud features are configured in the Gateway config file:

```yaml
# gateway.yaml
cloud:
  enabled: false                              # Opt-in (default: false)
  apiUrl: ""                                  # Cloud backend HTTP URL (required if enabled)
  relayUrl: ""                                # Cloud backend WebSocket URL (defaults to wss:// of apiUrl)

  auth:
    provider: "kinde"                         # OAuth provider type
    domain: ""                                # OAuth domain (e.g., your-app.kinde.com)
    clientId: ""                              # OAuth client ID for the Gateway
    redirectPort: 0                           # Ephemeral port for OAuth callback (0 = auto)

  heartbeat:
    interval: 30000                           # ms between heartbeats (default: 30s)

  relay:
    enabled: true                             # Accept relayed connections (default: true if cloud enabled)
    reconnectDelay: 5000                      # ms between reconnect attempts
```

**When `cloud.enabled` is `false`** (default): no cloud features load, no network calls, no relay. The Gateway operates exactly as it does today.

**When `cloud.enabled` is `true`**: on startup, if stored auth exists, the Gateway registers, starts heartbeat, and connects to the relay.

---

## PR 1: `openclaw invite` — Shareable Invite Codes

### Summary

Add an `openclaw invite` command that generates a short invite code and registers it with the configured cloud backend. Mobile users type the code to discover and connect to the Gateway — useful for remote setup over phone/text.

The invite code is **purely a discovery mechanism** — it resolves to the Gateway's WebSocket URL. Authentication uses the existing device public key + `openclaw devices approve` flow. No secrets pass through the cloud.

### Prerequisites

- `cloud.enabled: true` in Gateway config
- `cloud.apiUrl` configured

### How It Works

```
User runs:     openclaw invite
Gateway:       Generates CLAW-7X9K
               POST {cloud.apiUrl}/api/v1/invite/register
               Prints code + expiry

Mobile user:   Types CLAW-7X9K
Mobile app:    GET {cloud.apiUrl}/api/v1/invite/CLAW-7X9K
               → receives {url, gatewayName}
               → connects with device Ed25519 public key
               → "Waiting for Approval..."

User runs:     openclaw devices approve <requestId>
               → Mobile connected → chat begins
```

### Implementation

#### 1. Code Generation

Generate a 4-character alphanumeric code prefixed with `CLAW-`:
- Characters: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (exclude ambiguous: `0/O, 1/I/L`)
- Example output: `CLAW-7X9K`

```typescript
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CLAW-${code}`;
}
```

#### 2. Cloud Registration

```typescript
const config = loadGatewayConfig();
if (!config.cloud?.enabled || !config.cloud?.apiUrl) {
  console.error('Cloud not configured. Set cloud.apiUrl in gateway.yaml');
  process.exit(1);
}

const code = generateInviteCode();
const gatewayUrl = getGatewayWebSocketUrl();
const gatewayName = getGatewayDisplayName();

const response = await fetch(`${config.cloud.apiUrl}/api/v1/invite/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, gatewayName, url: gatewayUrl }),
});

if (response.status === 409) {
  // Code collision — retry with new code (max 3 attempts)
}
if (response.status === 429) {
  console.error('Rate limited. Try again later.');
}
```

#### 3. Terminal Output

```
$ openclaw invite

  Invite Code: CLAW-7X9K
  Expires in:  10 minutes

  Share this code with the mobile app user.
  They enter it in: Onboarding → Enter Invite Code

  After they connect, approve the device:
    openclaw devices list
    openclaw devices approve <requestId>
```

If `cloud.enabled` is `false`:
```
$ openclaw invite

  Cloud features not enabled.
  Configure cloud.apiUrl in gateway.yaml, or use QR pairing:
    openclaw pair
```

#### 4. Edge Cases

- **Code collision:** Regenerate and retry (max 3 attempts)
- **No cloud config:** Print error, suggest QR pairing
- **Network error:** Print error, suggest QR pairing
- **Codes auto-expire:** 10 minutes server-side TTL. No Gateway cleanup needed.

### Files to Change

| File | Change |
|------|--------|
| New command handler | `openclaw invite` command |
| Gateway config schema | Add `cloud` config section (if not already present) |

---

## PR 2: Cloud Relay — `openclaw login` + Heartbeat + Relay

### Summary

Enable Gateways to register with a user's cloud account so mobile clients can discover and connect from anywhere — without Tailscale, without same-network. The configured cloud backend brokers the WebSocket connection.

Three features:
1. **`openclaw login`** — OAuth authentication
2. **Heartbeat** — Keep Gateway "online" in the registry
3. **Relay** — Accept relayed mobile connections via cloud WebSocket

### Prerequisites

- `cloud.enabled: true` in Gateway config
- `cloud.apiUrl`, `cloud.relayUrl`, and `cloud.auth.*` configured

### Part 1: `openclaw login`

#### Flow

1. User runs `openclaw login`
2. Gateway starts a temporary local HTTP server on an ephemeral port
3. Opens browser to OAuth authorize URL:
   ```
   https://{cloud.auth.domain}/oauth2/auth?
     client_id={cloud.auth.clientId}&
     redirect_uri=http://localhost:{port}/callback&
     response_type=code&
     scope=openid profile email
   ```
4. User signs in
5. Redirect to `http://localhost:{port}/callback?code=...`
6. Gateway exchanges code for access + refresh tokens
7. Tokens stored at `~/.openclaw/cloud-auth.json` (permissions `0600`)

#### Stored Credentials

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "expiresAt": "2026-03-28T12:00:00Z",
  "userId": "kp_abc123",
  "email": "user@example.com"
}
```

#### Token Refresh

```typescript
async function getValidToken(): Promise<string> {
  const stored = loadStoredAuth();
  if (!stored) throw new Error('Not logged in. Run: openclaw login');

  if (new Date(stored.expiresAt) < new Date()) {
    const refreshed = await refreshToken(stored.refreshToken);
    storeAuth(refreshed);
    return refreshed.accessToken;
  }

  return stored.accessToken;
}
```

#### Additional Commands

- `openclaw logout` — Clear stored credentials, stop heartbeat/relay
- `openclaw cloud status` — Show login status, registration, connected relay clients

### Part 2: Gateway Registration + Heartbeat

#### On Startup (if auth exists)

```typescript
const config = loadGatewayConfig();
if (config.cloud?.enabled && hasStoredAuth()) {
  const token = await getValidToken();

  // Register
  await fetch(`${config.cloud.apiUrl}/api/v1/gateways/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      gatewayId: getGatewayId(),
      name: getGatewayDisplayName(),
      host: getBoundHost(),
      port: getBoundPort(),
      provider: 'openclaw',
      metadata: {
        os: process.platform,
        openclawVersion: getVersion(),
      },
    }),
  });

  // Start heartbeat
  setInterval(async () => {
    try {
      const t = await getValidToken();
      await fetch(`${config.cloud.apiUrl}/api/v1/gateways/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ gatewayId: getGatewayId() }),
      });
    } catch {
      // Log, don't crash. Will retry next interval.
    }
  }, config.cloud.heartbeat?.interval || 30_000);
}
```

### Part 3: Relay WebSocket

#### Connection

```typescript
import { io } from 'socket.io-client';

const config = loadGatewayConfig();
const token = await getValidToken();
const relayUrl = config.cloud.relayUrl || config.cloud.apiUrl.replace('https://', 'wss://');

const relaySocket = io(`${relayUrl}/gateway-relay`, {
  auth: {
    token,
    role: 'gateway',
    gatewayId: getGatewayId(),
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: config.cloud.relay?.reconnectDelay || 5000,
});
```

#### Message Bridging

The relay is transparent — it tunnels the same Gateway protocol messages:

```typescript
// Receive from mobile (via relay) → process as normal client message
relaySocket.on('relay:message', (data) => {
  handleClientMessage(data, relayClientContext);
});

// Send to mobile (via relay)
function sendToRelayClient(message: any) {
  relaySocket.emit('relay:message', message);
}
```

The Gateway treats relay clients identically to direct WebSocket clients:
- Device identity (public key) required
- `openclaw devices approve` required
- Same chat, agent, and RPC capabilities

#### Lifecycle

- **Gateway start:** If cloud auth exists → register + heartbeat + relay connect
- **Gateway stop:** Heartbeat stops, relay disconnects. Server marks offline after 60s.
- **`openclaw logout`:** Clear auth, stop heartbeat, disconnect relay
- **Network loss:** Socket.IO auto-reconnects with configurable delay

### CLI Commands Summary

| Command | Action |
|---------|--------|
| `openclaw login` | OAuth flow, store JWT |
| `openclaw logout` | Clear auth, stop cloud services |
| `openclaw cloud status` | Show cloud registration, online/offline, relay clients |
| `openclaw invite` | Generate + register invite code (PR 1) |

### Dependencies

- `socket.io-client` — relay WebSocket (may already be in the project)
- OAuth2 library or manual flow implementation
- No changes to the core Gateway WebSocket protocol

### Security

- Stored tokens on disk: file permissions `0600`
- Relay is pass-through — backend never inspects Gateway protocol messages
- Device approval still required for relay clients
- Both Gateway and mobile must authenticate with the same OAuth provider

### Files to Change

| File | Change |
|------|--------|
| New command handlers | `openclaw login`, `openclaw logout`, `openclaw cloud status` |
| New service | Cloud service: auth management, heartbeat, relay Socket.IO client |
| Gateway startup | Load cloud service if `cloud.enabled` and auth exists |
| Gateway config schema | Add `cloud` config section |
| Message handler | Bridge relay messages to existing client message handler |

---

## Reference Implementation

A reference backend implementing this protocol is available as part of the ClawMobile project. Mobile apps can configure their cloud backend URL independently of the Gateway — they just need to point at the same server for invite codes and relay to work.

The protocol is intentionally simple:
- 2 REST endpoints for invite codes (no auth)
- 4 REST endpoints for gateway registry (Bearer JWT)
- 1 WebSocket namespace for relay (Bearer JWT + role)
- Any OAuth2/JWT provider works — the backend validates tokens, the protocol doesn't prescribe how
