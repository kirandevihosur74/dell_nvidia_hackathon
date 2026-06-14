// Shared camera ref — allows stream service to capture frames from the camera
// StreamPreview sets this ref when the Camera component mounts

import { createRef, RefObject } from 'react';

// The ref type matches VisionCamera's Camera component
export const sharedCameraRef: RefObject<any> = createRef();

// ─── Serialized takePhoto queue ─────────────────────────────────────
// AVFoundation crashes when two takePhoto() calls overlap (-11803).
// This serializes calls so they wait for the previous one to finish
// instead of silently skipping.

let photoQueue: Promise<void> = Promise.resolve();

export async function safelyTakePhoto(): Promise<string | null> {
  let release: () => void;
  const prevQueue = photoQueue;
  photoQueue = new Promise((r) => { release = r; });

  // Wait for the previous capture to finish
  await prevQueue;

  const camera = sharedCameraRef.current;
  if (!camera) {
    release!();
    return null;
  }

  try {
    const photo = await camera.takePhoto({
      qualityPrioritization: 'speed',
      flash: 'off',
      enableShutterSound: false,
    });
    if (!photo?.path) return null;

    const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || result);
      };
      reader.readAsDataURL(blob);
    });
    return base64;
  } finally {
    release!();
  }
}
