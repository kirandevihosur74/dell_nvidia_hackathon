// Share Service — stub for ClawMobile
//
// Provides sharing utilities for stream URLs. Uses Clipboard and Linking APIs.

import * as Clipboard from 'expo-clipboard';
import { Linking, Share } from 'react-native';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { streamIOApiClient } from '@/services/streamio/apiClient';

type SharePlatform = 'twitter' | 'whatsapp' | 'telegram' | 'email' | 'sms' | 'linkedin' | 'reddit' | 'facebook';

/**
 * Make a stream publicly accessible. Returns the public URL or null on failure.
 */
export async function makeStreamPublic(streamId: string): Promise<string | null> {
  try {
    const res = await streamIOApiClient.post<{ publicUrl?: string }>(
      `${StreamIOAPIConfig.endpoints.streams}/${streamId}/publish`,
      {},
    );
    const url = res?.publicUrl || null;
    if (url) {
      useStreamIOStreamStore.getState().setPublicUrl(url);
    }
    return url;
  } catch (err: any) {
    console.warn('[ShareService] makeStreamPublic failed:', err.message);
    return null;
  }
}

/**
 * Revoke public access to a stream.
 */
export async function makeStreamPrivate(streamId: string): Promise<void> {
  try {
    await streamIOApiClient.post(`${StreamIOAPIConfig.endpoints.streams}/${streamId}/unpublish`, {});
    useStreamIOStreamStore.getState().setPublicUrl(null);
  } catch (err: any) {
    console.warn('[ShareService] makeStreamPrivate failed:', err.message);
  }
}

/**
 * Copy text to the system clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the native share sheet with a URL and optional message.
 */
export async function shareUrl(url: string, message?: string): Promise<void> {
  try {
    await Share.share({ url, message: message || url });
  } catch {
    // User cancelled or share failed
  }
}

/**
 * Get platform-specific share URLs for a given stream URL.
 */
export function getShareUrls(url: string, message?: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message || url);

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedMessage}`,
    whatsapp: `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`,
    email: `mailto:?subject=${encodedMessage}&body=${encodedUrl}`,
    sms: `sms:?body=${encodedMessage}%20${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedMessage}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
  };
}

/**
 * Open a platform-specific share URL.
 */
export async function openSharePlatform(
  platform: SharePlatform,
  url: string,
  message?: string,
): Promise<void> {
  const urls = getShareUrls(url, message);
  const shareUrl = urls[platform];
  if (shareUrl) {
    try {
      await Linking.openURL(shareUrl);
    } catch {
      console.warn(`[ShareService] Could not open ${platform} share URL`);
    }
  }
}
