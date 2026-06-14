import { useState, useEffect } from 'react';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import * as CameraService from '@/services/streamio/cameraService';

export function useCamera() {
  const isCameraActive = useStreamIOStreamStore((s) => s.isCameraActive);
  const cameraPosition = useStreamIOStreamStore((s) => s.cameraPosition);
  const [devices, setDevices] = useState<CameraService.CameraDevice[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermission();
  }, []);

  async function checkPermission() {
    const status = await CameraService.getCameraPermission();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      loadDevices();
    }
  }

  async function requestPermission() {
    const granted = await CameraService.requestCameraPermission();
    setHasPermission(granted);
    if (granted) loadDevices();
    return granted;
  }

  async function loadDevices() {
    const cams = await CameraService.getAvailableCameras();
    setDevices(cams);
  }

  return {
    isCameraActive,
    cameraPosition,
    devices,
    hasPermission,
    requestPermission,
    togglePosition: CameraService.toggleCameraPosition,
    start: CameraService.startCamera,
    stop: CameraService.stopCamera,
  };
}
