// Camera service — wraps react-native-vision-camera for stream capture
// Requires dev client (not Expo Go) for actual camera access
//
// In Expo Go, all functions return safe defaults since native camera
// modules are not available.

import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';

export interface CameraDevice {
  id: string;
  name: string;
  position: 'front' | 'back';
  hasFlash: boolean;
  hasTorch: boolean;
}

let visionCamera: any = null;
let loadAttempted = false;

// Check if vision camera native module exists before requiring the JS wrapper.
// react-native-vision-camera's JS module crashes on import if the native module
// is missing (Expo Go), so we must check NativeModules first.
import { NativeModules } from 'react-native';

function getVisionCamera(): any {
  if (visionCamera) return visionCamera;
  if (loadAttempted) return null;
  loadAttempted = true;

  // Only attempt require if the native module is actually registered
  if (!NativeModules.CameraView) {
    console.warn('VisionCamera native module not found — camera features disabled (Expo Go)');
    return null;
  }

  try {
    const mod = require('react-native-vision-camera');
    if (mod?.Camera) {
      visionCamera = mod;
      return visionCamera;
    }
    return null;
  } catch {
    console.warn('react-native-vision-camera not available — camera features disabled');
    return null;
  }
}

export async function getCameraPermission(): Promise<'granted' | 'denied' | 'not-determined'> {
  const vc = getVisionCamera();
  if (!vc) return 'denied';
  try {
    const status = await vc.Camera.getCameraPermissionStatus();
    return status;
  } catch {
    return 'denied';
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  const vc = getVisionCamera();
  if (!vc) return false;
  try {
    const status = await vc.Camera.requestCameraPermission();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getMicrophonePermission(): Promise<'granted' | 'denied' | 'not-determined'> {
  const vc = getVisionCamera();
  if (!vc) return 'denied';
  try {
    const status = await vc.Camera.getMicrophonePermissionStatus();
    return status;
  } catch {
    return 'denied';
  }
}

export async function requestMicrophonePermission(): Promise<boolean> {
  const vc = getVisionCamera();
  if (!vc) return false;
  try {
    const status = await vc.Camera.requestMicrophonePermission();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getAvailableCameras(): Promise<CameraDevice[]> {
  const vc = getVisionCamera();
  if (!vc) return [];

  try {
    const devices = await vc.Camera.getAvailableCameraDevices();
    return devices.map((d: any) => ({
      id: d.id,
      name: d.name || `${d.position} camera`,
      position: d.position,
      hasFlash: d.hasFlash,
      hasTorch: d.hasTorch,
    }));
  } catch {
    return [];
  }
}

export function toggleCameraPosition() {
  const store = useStreamIOStreamStore.getState();
  store.setCameraPosition(store.cameraPosition === 'front' ? 'back' : 'front');
}

export function startCamera() {
  useStreamIOStreamStore.getState().setCameraActive(true);
}

export function stopCamera() {
  useStreamIOStreamStore.getState().setCameraActive(false);
}
