// Transparent auth hook — auto-creates guest session on first invocation
import { useEffect, useCallback } from 'react';
import { useStreamIOAuthStore } from '@/stores/streamio/authStore';
import {
  streamIOLoginAsGuest,
  initiateStreamIOLogin,
  streamIOLogout,
  isStreamIOAuthenticated,
} from '@/services/streamio/authService';

export function useStreamIOAuth() {
  const { currentAuth, isAuthenticated, isLoading } = useStreamIOAuthStore();

  // Auto-create guest session if not authenticated
  useEffect(() => {
    let mounted = true;

    async function ensureAuth() {
      if (isAuthenticated || isLoading) return;

      const hasExistingAuth = await isStreamIOAuthenticated();
      if (hasExistingAuth || !mounted) return;

      // Transparent guest auth — no user interaction required
      await streamIOLoginAsGuest();
    }

    ensureAuth();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading]);

  const upgradeToKinde = useCallback(async () => {
    await initiateStreamIOLogin();
  }, []);

  const logout = useCallback(async () => {
    await streamIOLogout();
  }, []);

  return {
    auth: currentAuth,
    isAuthenticated,
    isLoading,
    isGuest: currentAuth?.authToken === 'guest-token',
    upgradeToKinde,
    logout,
  };
}
