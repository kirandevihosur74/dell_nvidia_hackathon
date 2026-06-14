# Multi-Persona Gateway Profiles — System Architecture Spec

## Context

The app currently assumes one operator per device. All sessions, messages, and gateway interactions are global — there's no concept of "who" on the device is using the gateway. When Felix and his fiance both want to use the same gateway, their conversations are co-mingled and the agent can't distinguish between them. This spec adds **per-gateway profiles** so any number of people can share a gateway with full conversation isolation.

---

## Data Model

### New: `GatewayProfile`
```typescript
interface GatewayProfile {
  id: string;            // "profile_<timestamp>_<random>"
  displayName: string;   // "Felix", "Amara" — visible to the agent
  avatarColor?: string;  // For visual identification in profile picker
  createdAt: string;
  isDefault: boolean;    // Exactly one per gateway
}
```

### New: `GatewayProfileMap` (persisted in AsyncStorage as `"openclaw_gateway_profiles"`)
```typescript
type GatewayProfileMap = {
  [gatewayId: string]: {
    profiles: GatewayProfile[];
    activeProfileId: string;
  };
};
```

### Modified: `GatewaySession` — add `profileId?: string`
### Modified: `OpenClawMessage` — add `profileId?: string`

### Persistence
| Data | Key | Change |
|------|-----|--------|
| Profiles | `openclaw_gateway_profiles` | **New** |
| Sessions | `openclaw_sessions` | Add `profileId` field |
| Messages | Existing per-session keys | No key change — isolation via session scoping |
| Device identity | `openclaw-device-identity-v2` | No change |
| Gateway tokens | `gateway_token_{gatewayId}` | No change |

---

## Profile Lifecycle

**Auto-creation on first launch:** For each gateway with no profiles, create a default: `{ id: "default", displayName: "Me", isDefault: true }`. Existing sessions with no `profileId` are treated as belonging to `"default"`.

**Explicit creation:** User taps "Add Profile" in gateway settings → enters display name + optional avatar color → profile created and associated with current gateway.

**Switching:** Instant, local-only operation:
1. Update `activeProfileId` in the profile map
2. Reload sessions filtered by new `profileId`
3. Set active session to new profile's last-used or "main"
4. No WebSocket reconnection needed

**Deletion:** Removes profile, its sessions, and cached messages. Cannot delete the default profile. If deleted profile was active, switches to default.

---

## Gateway Connection Changes

### Connect Handshake — No Change
Authentication stays device-scoped. The gateway trusts the device; the device manages who is using it. No re-pairing needed for new profiles.

### Chat Send — Profile Context Added
When sending `chat.send`, include profile info so the agent knows who it's talking to:
```typescript
params: {
  sessionKey: string;
  message: string | ContentBlock[];
  idempotencyKey: string;
  profile?: { id: string; displayName: string };  // NEW
}
```

### Session Key Namespacing
Session keys become `{profileId}:{sessionKey}` (e.g., `"profile_abc:main"`). This ensures two profiles using "main" don't collide on the gateway side. The default profile keeps un-namespaced keys (`"main"`) for backward compatibility.

---

## Session & Message Isolation

**Sessions:** `SessionManager` filters by active `profileId`. New sessions are stamped with `profileId`. Each profile has its own "main" session.

**Messages:** Already keyed by `(sessionId, gatewayId)`. Since sessions are profile-scoped, messages are inherently isolated. The `profileId` on messages is a denormalized safety net.

**Streaming events:** Incoming events include `sessionKey`, which is namespaced by profile. Events route to the correct profile's stream automatically.

---

## UI Flow

### Profile Picker
Lives in the **gateway header** (same bar as gateway name + connection status). Tappable avatar/name that opens a bottom sheet:
- List of profiles (avatar color + name)
- Active profile highlighted
- "Add Profile" at bottom

### Switching Experience
Tap avatar → bottom sheet → tap profile → dismisses → chat reloads with new profile's data. No spinner needed (all local).

### Profile Management
Settings > Gateway > [name] > Profiles: rename, change color, delete, set default.

---

## Migration — Zero Friction

1. On first run with no `openclaw_gateway_profiles` key, auto-create default profile per gateway
2. Existing sessions/messages with no `profileId` belong to `"default"` profile
3. Default profile uses un-namespaced session keys, preserving gateway-side history
4. No batch data transformation needed

---

## Security

**Profile isolation is a UX convenience, not a security boundary.** All profiles share the same device identity, gateway tokens, and AsyncStorage. This is appropriate for household sharing (family/partner). The device itself is the trust boundary.

Optional future enhancement: per-profile PIN/biometric lock.

---

## Store Changes (`gatewayStore.ts`)

New state:
```typescript
activeProfileId: string | null;
profiles: GatewayProfile[];
```

New actions:
```typescript
setActiveProfile(profileId: string): void;
addProfile(profile: GatewayProfile): void;
removeProfile(profileId: string): void;
updateProfile(id: string, updates: Partial<GatewayProfile>): void;
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `types/gateway.ts` | Add `GatewayProfile`, `GatewayProfileMap`; add `profileId?` to `GatewaySession` |
| `types/openclaw.ts` | Add `profileId?` to `OpenClawMessage` |
| `stores/gatewayStore.ts` | Add profile state + actions + migration logic |
| `services/gateway/sessionManager.ts` | Profile-aware filtering, namespaced session keys |
| `services/gateway/providers/openClawProvider.ts` | Add `profile` to `buildChatSend` |
| `hooks/useOpenClawStream.ts` | Stamp `profileId` on outgoing messages |
| **New:** `components/openclaw/ProfilePicker.tsx` | Bottom sheet for profile selection |
| **New:** `services/gateway/profileManager.ts` | Profile CRUD + persistence |

## Verification

1. Fresh install — auto-creates default profile, existing behavior unchanged
2. Add second profile — new sessions created, old sessions not visible
3. Switch profiles — sessions and messages swap instantly, no reconnection
4. Send message on profile B — agent sees profile B's display name
5. Switch back to profile A — profile A's history intact
6. Delete profile B — its sessions/messages removed, app switches to default
