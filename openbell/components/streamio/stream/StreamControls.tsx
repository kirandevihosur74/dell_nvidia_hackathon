import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { spacing } from '@/constants/spacing';
import {
  Play,
  Square,
  MonitorUp,
  Camera,
  Layers,
  Share2,
  Copy,
  Settings,
  Cpu,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { HLSStatus } from '@/types/streamio';

interface StreamControlsProps {
  status: HLSStatus;
  captureSource: 'screen' | 'camera' | 'both';
  streamUrl: string | null;
  publicUrl: string | null;
  cameraPosition: 'front' | 'back';
  isBusy: boolean;
  inferenceEnabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onCaptureSourceChange: (source: 'screen' | 'camera' | 'both') => void;
  onFlipCamera: () => void;
  onSettings: () => void;
}

export const StreamControls: React.FC<StreamControlsProps> = ({
  status,
  captureSource,
  streamUrl,
  publicUrl,
  cameraPosition,
  isBusy,
  inferenceEnabled = false,
  onStart,
  onStop,
  onCaptureSourceChange,
  onFlipCamera,
  onSettings,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const isStreaming = status === 'streaming';

  const handleStartStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isStreaming) {
      Alert.alert('Stop Stream', 'Are you sure you want to stop streaming?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: onStop },
      ]);
    } else {
      onStart();
    }
  };

  const handleShare = async () => {
    const url = publicUrl || streamUrl;
    if (!url) return;
    try {
      await Share.share({ message: `Watch my live stream: ${url}`, url });
    } catch {
      // User cancelled
    }
  };

  const handleCopy = async () => {
    const url = publicUrl || streamUrl;
    if (!url) return;
    try {
      const ClipboardModule = require('expo-clipboard');
      await ClipboardModule.setStringAsync(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Clipboard not available
    }
  };

  return (
    <View style={styles.container}>
      {/* Capture Source Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>Capture Source</Text>
        <View style={styles.sourceRow}>
          <SourceButton
            icon={<MonitorUp size={18} color={captureSource === 'screen' ? '#FFFFFF' : theme.textSecondary} />}
            label="Screen"
            active={captureSource === 'screen'}
            onPress={() => onCaptureSourceChange('screen')}
            disabled={isStreaming}
          />
          <SourceButton
            icon={<Camera size={18} color={captureSource === 'camera' ? '#FFFFFF' : theme.textSecondary} />}
            label="Camera"
            active={captureSource === 'camera'}
            onPress={() => onCaptureSourceChange('camera')}
            disabled={isStreaming}
          />
          <SourceButton
            icon={<Layers size={18} color={captureSource === 'both' ? '#FFFFFF' : theme.textSecondary} />}
            label="Both"
            active={captureSource === 'both'}
            onPress={() => onCaptureSourceChange('both')}
            disabled={isStreaming}
          />
        </View>
      </View>

      {/* Stream Settings — elevated as secondary button */}
      <TouchableOpacity
        style={[styles.settingsButton, { borderColor: theme.primary, backgroundColor: theme.primary + '0A' }]}
        onPress={onSettings}
        activeOpacity={0.7}
      >
        <Settings size={18} color={theme.primary} />
        <Text style={[styles.settingsButtonText, { color: theme.primary }]}>Stream Settings</Text>
      </TouchableOpacity>

      {/* Go Live / Stop */}
      <View style={styles.mainControl}>
        <TouchableOpacity
          style={[
            styles.goLiveButton,
            isStreaming
              ? { borderWidth: 1.5, borderColor: theme.error, backgroundColor: 'transparent' }
              : { backgroundColor: theme.primary },
          ]}
          onPress={handleStartStop}
          activeOpacity={0.7}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={isStreaming ? theme.error : '#FFFFFF'} />
          ) : (
            <>
              {isStreaming ? (
                <Square size={20} color={theme.error} />
              ) : (
                <Play size={20} color="#FFFFFF" />
              )}
              <Text style={[
                styles.goLiveText,
                isStreaming ? { color: theme.error } : { color: '#FFFFFF' },
              ]}>
                {isStreaming ? 'Stop Stream' : 'Go Live'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {!isStreaming && (
          <Text style={[styles.goLiveHint, { color: theme.textTertiary }]}>
            {inferenceEnabled
              ? 'You\'ll be live with AI inference overlay'
              : 'You\'ll be live on your HLS endpoint'}
          </Text>
        )}
      </View>

      {/* Stream URL & Sharing */}
      {isStreaming && (publicUrl || streamUrl) && (
        <View style={[styles.urlSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.urlLabel, { color: theme.textTertiary }]}>Stream URL</Text>
          <View style={styles.urlRow}>
            <Text style={[styles.urlText, { color: theme.text }]} numberOfLines={1}>
              {publicUrl || streamUrl}
            </Text>
            <TouchableOpacity onPress={handleCopy} style={styles.urlAction}>
              <Copy size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.urlAction}>
              <Share2 size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

function SourceButton({
  icon,
  label,
  active,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <TouchableOpacity
      style={[
        styles.sourceButton,
        { backgroundColor: theme.card, borderColor: theme.border },
        active && { backgroundColor: theme.primary, borderColor: theme.primary },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={[styles.sourceLabel, { color: theme.textSecondary }, active && { color: '#FFFFFF' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourceLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  settingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  mainControl: {
    gap: 6,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  goLiveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  goLiveHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  urlSection: {
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Menlo',
  },
  urlAction: {
    padding: 6,
  },
});
