// Screen capture service — ReplayKit Broadcast Upload Extension
// On iOS, system-wide screen capture requires a Broadcast Upload Extension.
// This service manages the JS-side coordination. The native extension must be
// set up via expo prebuild + a config plugin (e.g., @videosdk.live/expo-ios-screen-share).
//
// Architecture:
//   Broadcast Extension captures frames → App Group shared memory →
//   Main app reads frames → FFmpeg encode → Upload to server
//
// This file provides the JS interface; actual native capture happens in the extension.

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';

// The native module will be registered by the broadcast extension config plugin
const ScreenCaptureModule = NativeModules.StreamIOScreenCapture || null;
const eventEmitter = ScreenCaptureModule
  ? new NativeEventEmitter(ScreenCaptureModule)
  : null;

export type CaptureStatus = 'idle' | 'preparing' | 'capturing' | 'error';

let captureStatus: CaptureStatus = 'idle';
let frameCallback: ((frameData: ArrayBuffer) => void) | null = null;

export function isCaptureAvailable(): boolean {
  return Platform.OS === 'ios' && ScreenCaptureModule != null;
}

export async function startScreenCapture(): Promise<boolean> {
  if (!ScreenCaptureModule) {
    console.warn('Screen capture not available — native module missing (requires dev client)');
    useStreamIOStreamStore.getState().setError('Screen capture requires a dev client build');
    return false;
  }

  try {
    captureStatus = 'preparing';
    useStreamIOStreamStore.getState().setScreenCaptureActive(true);

    // This triggers the iOS RPSystemBroadcastPickerView to appear
    await ScreenCaptureModule.startBroadcast();
    captureStatus = 'capturing';
    return true;
  } catch (error: any) {
    captureStatus = 'error';
    useStreamIOStreamStore.getState().setScreenCaptureActive(false);
    useStreamIOStreamStore.getState().setError(`Screen capture failed: ${error.message}`);
    return false;
  }
}

export async function stopScreenCapture(): Promise<void> {
  if (!ScreenCaptureModule) return;

  try {
    await ScreenCaptureModule.stopBroadcast();
  } catch {
    // Ignore stop errors
  } finally {
    captureStatus = 'idle';
    useStreamIOStreamStore.getState().setScreenCaptureActive(false);
  }
}

export function onFrameReceived(callback: (frameData: ArrayBuffer) => void): () => void {
  frameCallback = callback;

  if (!eventEmitter) return () => {};

  const subscription = eventEmitter.addListener('onScreenFrame', (event: any) => {
    if (frameCallback && event.frameData) {
      frameCallback(event.frameData);
    }
  });

  return () => {
    frameCallback = null;
    subscription.remove();
  };
}

export function getCaptureStatus(): CaptureStatus {
  return captureStatus;
}

// App Group identifier for sharing data between main app and broadcast extension
export const APP_GROUP_ID = 'group.ai.streamio.mobile';
