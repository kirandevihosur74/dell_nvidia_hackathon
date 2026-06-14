// Profile Manager — CRUD operations and persistence for per-gateway user profiles.
//
// Profiles are stored in AsyncStorage as a GatewayProfileMap keyed by gatewayId.
// On first access for a gateway with no profiles, a "default" profile is auto-created
// to ensure backward compatibility with existing sessions/messages.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GatewayProfile, GatewayProfileMap } from "@/types/gateway";

const STORAGE_KEY = "openclaw_gateway_profiles";

const AVATAR_COLORS = [
  "#3B82F6", "#22C55E", "#F97316", "#A855F7",
  "#EC4899", "#14B8A6", "#EAB308", "#6366F1",
  "#EF4444", "#06B6D4",
];

let profileMap: GatewayProfileMap = {};
let loaded = false;

// ─── Persistence ────────────────────────────────────────────────────

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      profileMap = JSON.parse(raw);
    }
  } catch {
    // Start fresh if corrupted
    profileMap = {};
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileMap));
}

// ─── Public API ─────────────────────────────────────────────────────

/** Get all profiles for a gateway. Auto-creates default if none exist. */
export async function getProfiles(gatewayId: string): Promise<GatewayProfile[]> {
  await ensureLoaded();
  if (!profileMap[gatewayId]) {
    await ensureDefaultProfile(gatewayId);
  }
  return profileMap[gatewayId].profiles;
}

/** Get the active profile ID for a gateway. */
export async function getActiveProfileId(gatewayId: string): Promise<string> {
  await ensureLoaded();
  if (!profileMap[gatewayId]) {
    await ensureDefaultProfile(gatewayId);
  }
  return profileMap[gatewayId].activeProfileId;
}

/** Get a specific profile by ID. */
export async function getProfile(gatewayId: string, profileId: string): Promise<GatewayProfile | null> {
  const profiles = await getProfiles(gatewayId);
  return profiles.find((p) => p.id === profileId) || null;
}

/** Get the active profile for a gateway. */
export async function getActiveProfile(gatewayId: string): Promise<GatewayProfile> {
  const activeId = await getActiveProfileId(gatewayId);
  const profile = await getProfile(gatewayId, activeId);
  // Fallback to first profile if active was deleted
  if (!profile) {
    const profiles = await getProfiles(gatewayId);
    return profiles[0];
  }
  return profile;
}

/** Create a new profile for a gateway. */
export async function createProfile(
  gatewayId: string,
  displayName: string,
  avatarColor?: string,
): Promise<GatewayProfile> {
  await ensureLoaded();
  if (!profileMap[gatewayId]) {
    await ensureDefaultProfile(gatewayId);
  }

  const existingCount = profileMap[gatewayId].profiles.length;
  const color = avatarColor || AVATAR_COLORS[existingCount % AVATAR_COLORS.length];

  const profile: GatewayProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    displayName,
    avatarColor: color,
    createdAt: new Date().toISOString(),
    isDefault: false,
  };

  profileMap[gatewayId].profiles.push(profile);
  await persist();
  return profile;
}

/** Update a profile's display name or avatar color. */
export async function updateProfile(
  gatewayId: string,
  profileId: string,
  updates: Partial<Pick<GatewayProfile, "displayName" | "avatarColor">>,
): Promise<GatewayProfile | null> {
  await ensureLoaded();
  const entry = profileMap[gatewayId];
  if (!entry) return null;

  const profile = entry.profiles.find((p) => p.id === profileId);
  if (!profile) return null;

  if (updates.displayName !== undefined) profile.displayName = updates.displayName;
  if (updates.avatarColor !== undefined) profile.avatarColor = updates.avatarColor;

  await persist();
  return profile;
}

/** Set the active profile for a gateway. */
export async function setActiveProfile(gatewayId: string, profileId: string): Promise<void> {
  await ensureLoaded();
  if (!profileMap[gatewayId]) return;

  const exists = profileMap[gatewayId].profiles.some((p) => p.id === profileId);
  if (!exists) return;

  profileMap[gatewayId].activeProfileId = profileId;
  await persist();
}

/** Delete a profile. Cannot delete the default profile. Returns true if deleted. */
export async function deleteProfile(gatewayId: string, profileId: string): Promise<boolean> {
  await ensureLoaded();
  const entry = profileMap[gatewayId];
  if (!entry) return false;

  const profile = entry.profiles.find((p) => p.id === profileId);
  if (!profile || profile.isDefault) return false;

  entry.profiles = entry.profiles.filter((p) => p.id !== profileId);

  // If the deleted profile was active, switch to default
  if (entry.activeProfileId === profileId) {
    const defaultProfile = entry.profiles.find((p) => p.isDefault);
    entry.activeProfileId = defaultProfile?.id || entry.profiles[0]?.id || "default";
  }

  await persist();
  return true;
}

/** Initialize profiles for all known gateways (call on app startup). */
export async function migrateExistingGateways(gatewayIds: string[]): Promise<void> {
  await ensureLoaded();
  let changed = false;
  for (const id of gatewayIds) {
    if (!profileMap[id]) {
      profileMap[id] = {
        profiles: [makeDefaultProfile()],
        activeProfileId: "default",
      };
      changed = true;
    }
  }
  if (changed) await persist();
}

// ─── Internal ───────────────────────────────────────────────────────

function makeDefaultProfile(): GatewayProfile {
  return {
    id: "default",
    displayName: "Me",
    avatarColor: AVATAR_COLORS[0],
    createdAt: new Date().toISOString(),
    isDefault: true,
  };
}

async function ensureDefaultProfile(gatewayId: string): Promise<void> {
  profileMap[gatewayId] = {
    profiles: [makeDefaultProfile()],
    activeProfileId: "default",
  };
  await persist();
}
