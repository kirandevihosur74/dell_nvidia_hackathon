import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, NativeModules, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { MonitorUp, Camera as CameraIcon, SwitchCamera } from 'lucide-react-native';
import { sharedCameraRef } from '@/services/streamio/cameraRef';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { InferenceOverlay } from './InferenceOverlay';
import { ChatOverlay } from './ChatOverlay';

// ─── Camera module loading ──────────────────────────────────────────
let _cameraModule: { type: 'expo' | 'vision'; mod: any } | null = null;
let _loadAttempted = false;

function loadCameraModule(): { type: 'expo' | 'vision'; mod: any } | null {
  if (_cameraModule) return _cameraModule;
  if (_loadAttempted) return null;
  _loadAttempted = true;

  // 1. Try expo-camera
  if (NativeModules.ExpoCamera || NativeModules.ExpoCameraView || NativeModules.ExponentCamera) {
    try {
      const expoCam = require('expo-camera');
      if (expoCam?.CameraView) {
        _cameraModule = { type: 'expo', mod: expoCam };
        return _cameraModule;
      }
    } catch {}
  }

  // 2. Try react-native-vision-camera
  if (NativeModules.CameraView) {
    try {
      const vc = require('react-native-vision-camera');
      if (vc?.Camera) {
        _cameraModule = { type: 'vision', mod: vc };
        return _cameraModule;
      }
    } catch {}
  }

  return null;
}

function getDeviceLabel(device: any, fallbackPosition: string): string {
  if (!device) return fallbackPosition === 'front' ? 'Front' : 'Rear';
  const pos = device.position as string;
  const types = (device.physicalDevices || []) as string[];
  const type = types[0] || device.deviceType || '';
  if (pos === 'front') return 'Front';
  if (type.includes('ultra-wide')) return 'Ultra Wide';
  if (type.includes('telephoto')) return 'Telephoto';
  if (type.includes('wide')) return 'Wide';
  return pos === 'back' ? 'Rear' : device.name || 'Camera';
}

function getDeviceShortLabel(device: any, fallbackPosition: string): string {
  if (!device) return fallbackPosition === 'front' ? 'F' : 'R';
  const pos = device.position as string;
  const types = (device.physicalDevices || []) as string[];
  const type = types[0] || device.deviceType || '';
  if (pos === 'front') return 'Front';
  if (type.includes('ultra-wide')) return 'Ultra';
  if (type.includes('telephoto')) return 'Tele';
  if (type.includes('wide')) return 'Wide';
  return 'Cam';
}

interface StreamPreviewProps {
  captureSource: 'screen' | 'camera' | 'both';
  isStreaming: boolean;
  cameraPosition?: 'front' | 'back';
  onFlipCamera?: () => void;
  inferenceEnabled?: boolean;
  fullscreen?: boolean;
  cameraActive?: boolean;
}

export const StreamPreview: React.FC<StreamPreviewProps> = ({
  captureSource,
  isStreaming,
  cameraPosition = 'front',
  onFlipCamera,
  inferenceEnabled = false,
  fullscreen = false,
  cameraActive = true,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const cam = loadCameraModule();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  const isVisionCamera = cam?.type === 'vision';
  const isExpoCamera = cam?.type === 'expo';
  const wantsCamera = captureSource === 'camera' || captureSource === 'both';

  // Request camera permission
  useEffect(() => {
    if (!cam || !wantsCamera) return;
    if (isExpoCamera) {
      const reqPerm = cam.mod.Camera?.requestCameraPermissionsAsync ?? cam.mod.requestCameraPermissionsAsync;
      if (reqPerm) {
        reqPerm().then((r: any) => setHasPermission(r.status === 'granted')).catch(() => setHasPermission(false));
      } else {
        setHasPermission(true);
      }
    } else {
      setHasPermission(true);
    }
  }, [cam, wantsCamera]);

  const allDevices = useMemo(() => {
    if (!isVisionCamera || !cam) return [];
    try { return cam.mod.Camera.getAvailableCameraDevices() as any[]; } catch { return []; }
  }, [isVisionCamera, cam]);

  const handleCycle = useCallback(() => {
    if (isVisionCamera && allDevices.length > 1) {
      setDeviceIndex((prev) => (prev + 1) % allDevices.length);
    } else if (onFlipCamera) {
      onFlipCamera();
    }
  }, [isVisionCamera, allDevices.length, onFlipCamera]);

  const handleLongPress = useCallback(() => {
    if (allDevices.length > 1) setShowPicker(true);
  }, [allDevices.length]);

  const handlePickDevice = useCallback((index: number) => {
    setDeviceIndex(index);
    setShowPicker(false);
  }, []);

  const device = allDevices.length > 0 ? allDevices[deviceIndex % allDevices.length] : null;

  useEffect(() => {
    if (device) {
      const fmt = device.formats?.[device.formats.length - 1];
      if (fmt) {
        const w = fmt.videoWidth || fmt.photoWidth;
        const h = fmt.videoHeight || fmt.photoHeight;
        if (w && h) useStreamIOStreamStore.getState().setActualResolution(`${w}x${h}`);
      } else if (device.photoWidth && device.photoHeight) {
        useStreamIOStreamStore.getState().setActualResolution(`${device.photoWidth}x${device.photoHeight}`);
      }
    }
  }, [device]);

  const deviceLabel = useMemo(() => getDeviceShortLabel(device, cameraPosition), [device, cameraPosition]);

  const useVisionCam = isVisionCamera && device && wantsCamera;
  const useExpoCam = isExpoCamera && wantsCamera && hasPermission;
  const showCamera = useVisionCam || useExpoCam;

  useEffect(() => {
    if (!isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(borderAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isStreaming]);

  const borderColorAnim = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.5)'],
  });

  const showFlipButton = (onFlipCamera || allDevices.length > 1) && wantsCamera;

  const VisionCameraView = isVisionCamera ? cam?.mod.Camera : null;
  const ExpoCameraView = isExpoCamera ? cam?.mod.CameraView : null;
  const expoFacing = cameraPosition === 'front' ? 'front' : 'back';

  return (
    <View style={[styles.wrapper, fullscreen && styles.wrapperFullscreen]}>
      <Animated.View
        style={[
          styles.container,
          fullscreen && styles.containerFullscreen,
          !isStreaming && !fullscreen && { borderWidth: 2, borderColor: borderColorAnim, borderStyle: 'dashed' },
        ]}
      >
        <View style={styles.previewArea}>
          {useVisionCam && VisionCameraView && (
            <VisionCameraView
              ref={cameraActive ? sharedCameraRef : undefined}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={cameraActive}
              photo={true}
              video={false}
            />
          )}

          {useExpoCam && ExpoCameraView && cameraActive && (
            <ExpoCameraView key={expoFacing} style={StyleSheet.absoluteFill} facing={expoFacing} />
          )}

          {isStreaming ? (
            <View style={[styles.liveContainer, showCamera && styles.overlayContainer]}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              {captureSource === 'screen' && !showCamera && (
                <>
                  <MonitorUp size={44} color={theme.primary} />
                  <Text style={[styles.captureLabel, { color: theme.textSecondary }]}>Screen Capture Active</Text>
                </>
              )}
            </View>
          ) : (
            <View style={[styles.idleContainer, showCamera && styles.overlayContainer]}>
              {captureSource === 'screen' && (
                <>
                  <MonitorUp size={40} color={theme.textTertiary} />
                  <Text style={[styles.idleText, { color: theme.textSecondary }]}>Screen Capture</Text>
                  <Text style={[styles.idleSubtext, { color: theme.textTertiary }]}>Your screen will be broadcast</Text>
                </>
              )}
              {wantsCamera && !showCamera && (
                <>
                  <CameraIcon size={40} color={theme.textTertiary} />
                  <Text style={[styles.idleText, { color: theme.textSecondary }]}>Camera Preview</Text>
                  <Text style={[styles.idleSubtext, { color: theme.textTertiary }]}>
                    {hasPermission === false ? 'Camera permission denied' : `${cameraPosition === 'front' ? 'Front' : 'Rear'} camera selected`}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* AI Inference overlays */}
        {isStreaming && inferenceEnabled && (
          <>
            <InferenceOverlay />
            <ChatOverlay fullscreen={fullscreen} />
          </>
        )}

        {/* Camera flip — rendered intentionally empty here, see overlay below */}

        {/* Camera picker popup (long-press) */}
        {showPicker && allDevices.length > 1 && (
          <View style={styles.pickerBackdrop}>
            <View style={[styles.pickerContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.pickerTitle, { color: theme.textSecondary }]}>Select Camera</Text>
              {allDevices.map((d: any, i: number) => {
                const label = getDeviceLabel(d, cameraPosition);
                const isSelected = i === deviceIndex;
                return (
                  <TouchableOpacity
                    key={d.id || i}
                    style={[styles.pickerItem, isSelected && { backgroundColor: theme.primary + '22' }]}
                    onPress={() => handlePickDevice(i)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pickerDot, isSelected && { backgroundColor: theme.primary }]} />
                    <Text style={[styles.pickerItemText, { color: isSelected ? theme.primary : theme.text }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Pressable style={styles.pickerDismiss} onPress={() => setShowPicker(false)} />
          </View>
        )}

        {/* PiP camera overlay */}
        {isStreaming && captureSource === 'both' && (
          <View style={[styles.pipOverlay, { backgroundColor: theme.card, borderColor: theme.primary }]}>
            <CameraIcon size={18} color="#FFFFFF" />
          </View>
        )}
      </Animated.View>

      {/* Camera flip overlay — positioned independently from Animated.View */}
      {showFlipButton && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              minWidth: 40,
              paddingHorizontal: 6,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleCycle}
            onLongPress={handleLongPress}
            delayLongPress={400}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <SwitchCamera size={16} color="#FFFFFF" />
            <Text style={styles.flipLabel}>{deviceLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  wrapperFullscreen: {
    flex: 1,
    borderRadius: 0,
    overflow: 'visible',
  },
  container: {
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  containerFullscreen: {
    flex: 1,
    aspectRatio: undefined,
    borderRadius: 0,
    overflow: 'visible',
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveContainer: {
    alignItems: 'center',
    gap: 10,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  captureLabel: {
    fontSize: 14,
  },
  idleContainer: {
    alignItems: 'center',
    gap: 6,
  },
  idleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  idleSubtext: {
    fontSize: 13,
  },
  flipButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 40,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  flipLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  pickerDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  pickerContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    minWidth: 150,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  pickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pipOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 60,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
