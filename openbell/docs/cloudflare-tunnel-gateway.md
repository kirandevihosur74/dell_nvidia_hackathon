# OpenClaw Gateway Remote Access via Cloudflare Tunnels

## Overview

This document outlines how to enable ClawMobile users to securely access an OpenClaw gateway running on their home LAN from anywhere via the internet, using Cloudflare Tunnels.

## Architecture

```
┌──────────────┐         ┌─────────────────────┐         ┌──────────────────┐
│  ClawMobile  │◄──HTTPS──►  Cloudflare Edge   │◄──Tunnel──►  User's Home    │
│  (phone)     │         │  (proxy + TLS)      │         │  Machine         │
│              │         │                     │         │                  │
│  Connects to │         │  Routes traffic to  │         │  cloudflared     │
│  user's      │         │  the correct tunnel │         │  ↕               │
│  subdomain   │         │                     │         │  OpenClaw Gateway│
└──────────────┘         └─────────────────────┘         │  (localhost:3000)│
                                                         └──────────────────┘
```

**How it works:**
1. User installs `cloudflared` on their home machine alongside OpenClaw
2. `cloudflared` establishes an outbound-only encrypted connection to Cloudflare's edge
3. Cloudflare assigns a hostname (e.g., `<user-id>.gateway.clawmobile.app`)
4. The mobile app connects to that hostname — Cloudflare routes traffic through the tunnel to the home machine
5. No ports are opened on the user's router, no firewall changes needed

## Prerequisites

- A Cloudflare account (free tier works)
- A domain managed by Cloudflare DNS (e.g., `clawmobile.app`)
- Cloudflare Zero Trust (free for up to 50 users)

## Setup Components

### 1. Cloudflare Account & Domain Configuration

Register the gateway domain in Cloudflare and enable Zero Trust.

```bash
# One-time setup by ClawMobile team
# Add DNS zone for clawmobile.app in Cloudflare dashboard
# Enable Zero Trust at https://one.dash.cloudflare.com
```

### 2. Backend Registry Service

A lightweight API that manages tunnel provisioning per user.

**Responsibilities:**
- Authenticate ClawMobile users
- Provision a unique tunnel + subdomain per user
- Store the mapping: `user_id → tunnel_id → subdomain`
- Provide the mobile app with the user's gateway URL
- Revoke tunnels on user deletion or deauthorization

**API Endpoints:**

```
POST   /api/v1/tunnels/provision    # Create tunnel for authenticated user
GET    /api/v1/tunnels/me           # Get current user's gateway URL
DELETE /api/v1/tunnels/me           # Tear down user's tunnel
POST   /api/v1/tunnels/verify       # Health check — is the tunnel online?
```

**Tunnel provisioning via Cloudflare API:**

```bash
# Create a named tunnel
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gateway-{user_id}",
    "tunnel_secret": "{generated_secret_base64}"
  }'

# Create DNS CNAME for the tunnel
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "{user_id}.gateway",
    "content": "{tunnel_id}.cfargotunnel.com",
    "proxied": true
  }'
```

### 3. Home Machine Installer

A bundled installer the user downloads that sets up both OpenClaw and the tunnel.

**What the installer does:**

```
1. Install OpenClaw gateway (if not present)
2. Download cloudflared binary
3. Authenticate with ClawMobile backend to get tunnel credentials
4. Write cloudflared config
5. Register cloudflared as a system service
6. Start the tunnel
7. Display a pairing code for the mobile app
```

**cloudflared config file** (`~/.cloudflared/config.yml`):

```yaml
tunnel: {tunnel_id}
credentials-file: ~/.cloudflared/{tunnel_id}.json

ingress:
  - hostname: {user_id}.gateway.clawmobile.app
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
      connectTimeout: 10s
  - service: http_status:404
```

**Install cloudflared as a service:**

```bash
# macOS
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared

# Linux
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Windows
cloudflared service install
net start cloudflared
```

### 4. Mobile App Integration

**Pairing flow:**

```
1. User completes onboarding in ClawMobile
2. User runs installer on home machine → gets pairing code
3. User enters pairing code in mobile app (or scans QR)
4. App calls backend: POST /api/v1/tunnels/verify {pairing_code}
5. Backend returns gateway URL: https://{user_id}.gateway.clawmobile.app
6. App saves gateway URL and connects via existing gateway provider
```

**Gateway URL resolution in the app:**

```typescript
// services/gateway/tunnelRegistry.ts

export async function getGatewayUrl(userId: string): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/v1/tunnels/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const { gatewayUrl, status } = await response.json();

  if (status !== "online") {
    throw new Error("Gateway is offline. Ensure your home machine is running.");
  }

  return gatewayUrl; // https://{user_id}.gateway.clawmobile.app
}
```

**Connection status handling:**

```typescript
// The app should handle these tunnel states:
type TunnelStatus = "online" | "offline" | "not_provisioned";

// online          → gateway reachable, proceed normally
// offline         → tunnel exists but cloudflared is not running on home machine
// not_provisioned → user hasn't set up the home machine yet, show setup instructions
```

### 5. Security Layers

**Authentication (applied at Cloudflare edge):**

Each tunnel request must carry a valid ClawMobile auth token. Enforce this via Cloudflare Access:

```
Cloudflare Zero Trust → Access → Applications:
  - Application URL: *.gateway.clawmobile.app
  - Policy: Require valid JWT from ClawMobile backend
  - Session duration: 24 hours
```

**Additional protections:**
- **Cloudflare Access Service Token**: Mobile app includes a service token header; Cloudflare rejects requests without it before they reach the tunnel
- **Origin validation**: `cloudflared` config can restrict to `localhost:3000` only — no lateral access to other home network services
- **Rate limiting**: Cloudflare WAF rules to prevent abuse
- **WebSocket support**: Cloudflare Tunnels natively support WebSocket connections (needed for real-time gateway communication)

### 6. Monitoring & Health Checks

**Backend cron job** (runs every 5 minutes):

```
For each provisioned tunnel:
  1. GET https://{user_id}.gateway.clawmobile.app/health
  2. Update tunnel status in database (online/offline)
  3. If offline for > 24 hours, send push notification to user
```

**Cloudflare Tunnel metrics:**
- Available via Cloudflare API: `GET /accounts/{id}/cfd_tunnel/{tunnel_id}/connections`
- Shows active connections, uptime, and connector version

## User Experience Flow

```
┌─────────────────────────────────────────────────────────┐
│                    FIRST-TIME SETUP                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. User downloads ClawMobile → completes onboarding    │
│                        ↓                                │
│  2. App shows "Connect Your Gateway" screen             │
│     with download link for home machine installer       │
│                        ↓                                │
│  3. User runs installer on home machine                 │
│     → OpenClaw + cloudflared installed                  │
│     → Tunnel provisioned automatically                  │
│     → Pairing code displayed                            │
│                        ↓                                │
│  4. User enters pairing code in mobile app              │
│                        ↓                                │
│  5. App verifies tunnel → saves gateway URL             │
│                        ↓                                │
│  6. Connected. Gateway accessible from anywhere.        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Cost Estimate

| Component | Free Tier | Paid (at scale) |
|---|---|---|
| Cloudflare Tunnels | Unlimited tunnels | Unlimited tunnels |
| Cloudflare Zero Trust | 50 users | $7/user/month (Access) |
| Cloudflare DNS | Free | Free |
| Backend registry | Self-hosted | ~$20/month (small VPS) |
| Domain | ~$10/year | ~$10/year |

**At 1,000 users**: ~$7,000/month for Zero Trust Access, or free if using custom JWT validation instead of Cloudflare Access policies.

**Recommendation**: Use custom JWT validation at the `cloudflared` origin level instead of Cloudflare Access to avoid per-user costs. Cloudflare Access is optional — the tunnel itself is free regardless of user count.

## Alternatives Considered

| Solution | Why not |
|---|---|
| ngrok | Per-tunnel costs at scale, less control over auth |
| Tailscale | Requires VPN app on user's phone — poor consumer UX |
| Palo Alto Prisma | Enterprise pricing, minimum seat counts |
| Self-hosted WireGuard relay | Significant engineering + ops burden |
| Port forwarding | Requires router config, exposes home IP, UPnP unreliable |

## Implementation Phases

**Phase 1 — Manual setup (MVP)**
- User installs `cloudflared` manually via CLI instructions
- User copies tunnel URL into ClawMobile Settings
- No backend registry, no pairing code

**Phase 2 — Automated installer**
- Bundled installer for macOS/Windows/Linux
- Pairing code flow
- Backend registry API

**Phase 3 — Full production**
- Cloudflare Access or custom JWT auth at edge
- Health monitoring and push notifications
- Auto-update for `cloudflared` via installer
- Admin dashboard for tunnel management
