// StreamIO Auth service — Kinde OAuth (implicit) + email/password + guest mode
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { StreamIOAuth } from '@/types/streamio';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';

const KINDE_DOMAIN = StreamIOAPIConfig.external.kindeDomain;
const CLIENT_ID = StreamIOAPIConfig.external.kindeClientId;
const REDIRECT_URI = Linking.createURL('auth/streamio-callback');

// All keys prefixed with streamio: to prevent collisions
const STORAGE_KEYS = {
  accessToken: 'streamio:access_token',
  refreshToken: 'streamio:refresh_token',
  expiresAt: 'streamio:expires_at',
  userEmail: 'streamio:user_email',
};

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ─── Kinde OAuth (implicit flow for mobile) ────────────────────────

export async function initiateStreamIOLogin(): Promise<void> {
  useStreamIOAuthStore.getState().setLoading(true);

  try {
    const state = generateRandomString(32);
    const nonce = generateRandomString(16);

    const authURL =
      `${KINDE_DOMAIN}/oauth2/auth` +
      `?response_type=token` +
      `&client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=openid%20profile%20email` +
      `&state=${state}` +
      `&nonce=${nonce}`;

    const result = await WebBrowser.openAuthSessionAsync(authURL, REDIRECT_URI);

    if (result.type === 'success' && result.url) {
      await handleAuthRedirect(result.url);
    }
  } catch (error) {
    console.error('[StreamIO] Auth error:', error);
    throw error;
  } finally {
    useStreamIOAuthStore.getState().setLoading(false);
  }
}

async function handleAuthRedirect(url: string): Promise<void> {
  const parsed = Linking.parse(url);

  let accessToken = (parsed.queryParams?.access_token ||
    parsed.queryParams?.token) as string | undefined;

  if (!accessToken && url.includes('#')) {
    const fragment = url.split('#')[1];
    const fragmentParams = new URLSearchParams(fragment);
    accessToken = fragmentParams.get('access_token') || undefined;
  }

  const code = parsed.queryParams?.code as string | undefined;
  if (!accessToken && code) {
    throw new Error('Kinde returned an authorization code. Please try email/password login.');
  }

  if (!accessToken) {
    throw new Error('No access token received from Kinde');
  }

  await storeKindeToken(accessToken);
}

async function storeKindeToken(accessToken: string): Promise<void> {
  let email = '';
  let expiresAt = new Date();

  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    email = payload.email || '';
    expiresAt = payload.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
  } catch {
    expiresAt.setHours(expiresAt.getHours() + 24);
  }

  if (!email) {
    try {
      const res = await fetch(`${KINDE_DOMAIN}/oauth2/v2/user_profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        email = info.email || info.preferred_email || '';
      }
    } catch {}
  }

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.accessToken, accessToken],
    [STORAGE_KEYS.expiresAt, expiresAt.toISOString()],
    ...(email ? [[STORAGE_KEYS.userEmail, email]] : []),
  ] as [string, string][]);

  const auth: StreamIOAuth = {
    email: email || 'user@kinde',
    authToken: accessToken,
    isAuthenticated: true,
    expiresAt: expiresAt.toISOString(),
    subscriptionTier: 'free',
  };

  useStreamIOAuthStore.getState().setAuth(auth);
}

// ─── Email/Password Auth (via StreamIO backend) ──────────────────

export async function streamIOLoginWithEmail(email: string, password: string): Promise<void> {
  useStreamIOAuthStore.getState().setLoading(true);

  try {
    const response = await fetch(
      `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.auth}/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Login failed');
    }

    const { accessToken, refreshToken, user } = data.data;

    let expiresAt = new Date();
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      expiresAt = new Date(payload.exp * 1000);
    } catch {
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.accessToken, accessToken],
      [STORAGE_KEYS.refreshToken, refreshToken],
      [STORAGE_KEYS.expiresAt, expiresAt.toISOString()],
      [STORAGE_KEYS.userEmail, user?.email || email],
    ]);

    const auth: StreamIOAuth = {
      email: user?.email || email,
      authToken: accessToken,
      isAuthenticated: true,
      expiresAt: expiresAt.toISOString(),
      subscriptionTier: 'free',
    };

    useStreamIOAuthStore.getState().setAuth(auth);
  } finally {
    useStreamIOAuthStore.getState().setLoading(false);
  }
}

// ─── Token Management ───────────────────────────────────────────

export async function getStreamIOAccessToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.expiresAt);

  if (!token) return null;

  if (expiresAt && new Date(expiresAt) < new Date()) {
    const refreshed = await refreshStreamIOAccessToken();
    if (refreshed) {
      return AsyncStorage.getItem(STORAGE_KEYS.accessToken);
    }
    return null;
  }

  return token;
}

export async function refreshStreamIOAccessToken(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return false;

  try {
    // Try Kinde token refresh
    const kindeResponse = await fetch(`${KINDE_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (kindeResponse.ok) {
      const data = await kindeResponse.json();
      if (data.access_token) {
        let expiresAt = new Date();
        try {
          const payload = JSON.parse(atob(data.access_token.split('.')[1]));
          expiresAt = new Date(payload.exp * 1000);
        } catch {
          expiresAt.setHours(expiresAt.getHours() + 24);
        }

        await AsyncStorage.multiSet([
          [STORAGE_KEYS.accessToken, data.access_token],
          ...(data.refresh_token
            ? [[STORAGE_KEYS.refreshToken, data.refresh_token]]
            : []),
          [STORAGE_KEYS.expiresAt, expiresAt.toISOString()],
        ] as [string, string][]);

        const store = useStreamIOAuthStore.getState();
        if (store.currentAuth) {
          store.setAuth({
            ...store.currentAuth,
            authToken: data.access_token,
            expiresAt: expiresAt.toISOString(),
          });
        }
        return true;
      }
    }

    // Fallback: try StreamIO backend refresh
    const response = await fetch(
      `${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.auth}/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
    );

    const data = await response.json();
    if (!response.ok || !data.success) return false;

    const { accessToken, refreshToken: newRefreshToken } = data.data;

    let expiresAt = new Date();
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      expiresAt = new Date(payload.exp * 1000);
    } catch {
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.accessToken, accessToken],
      [STORAGE_KEYS.refreshToken, newRefreshToken || refreshToken],
      [STORAGE_KEYS.expiresAt, expiresAt.toISOString()],
    ]);

    const store = useStreamIOAuthStore.getState();
    if (store.currentAuth) {
      store.setAuth({
        ...store.currentAuth,
        authToken: accessToken,
        expiresAt: expiresAt.toISOString(),
      });
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Guest / Logout ─────────────────────────────────────────────

export async function streamIOLoginAsGuest(): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const auth: StreamIOAuth = {
    email: 'guest@streamio.ai',
    authToken: 'guest-token',
    isAuthenticated: true,
    expiresAt: expiresAt.toISOString(),
    subscriptionTier: 'free',
  };

  useStreamIOAuthStore.getState().setAuth(auth);
}

export async function streamIOLogout(): Promise<void> {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);

  if (refreshToken) {
    fetch(`${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.auth}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }

  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  useStreamIOAuthStore.getState().logout();
}

export async function isStreamIOAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.expiresAt);

  if (!token) return false;
  if (expiresAt && new Date(expiresAt) < new Date()) return false;
  return true;
}
