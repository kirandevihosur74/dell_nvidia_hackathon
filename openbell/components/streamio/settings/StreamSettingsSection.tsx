import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { StreamIOAPIConfig } from '@/constants/streamio/config';
import { Wifi, WifiOff, Monitor, Camera, Layers, Brain } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { PipLayoutPicker } from '@/components/streamio/stream/PipLayoutPicker';
import * as CompositeService from '@/services/streamio/compositeService';

function SettingRow({ label, description, right }: { label: string; description?: string; right: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 15, color: theme.text }}>{label}</Text>
        {description && <Text style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>{description}</Text>}
      </View>
      {right}
    </View>
  );
}

export function StreamSettingsSection() {
  const { theme } = useThemeStore();
  const captureSource = useStreamIOStreamStore((s) => s.captureSource);
  const setCaptureSource = useStreamIOStreamStore((s) => s.setCaptureSource);
  const config = useStreamIOStreamStore((s) => s.config);
  const setConfig = useStreamIOStreamStore((s) => s.setConfig);
  const inferenceEnabled = useStreamIOStreamStore((s) => s.inferenceEnabled);
  const setInferenceEnabled = useStreamIOStreamStore((s) => s.setInferenceEnabled);

  const [connected, setConnected] = useState(false);
  const [pipLayout, setPipLayout] = useState(CompositeService.getCompositeConfig().layout);

  const handleLayoutChange = (layout: CompositeService.CompositeLayout) => {
    setPipLayout(layout);
    CompositeService.setCompositeConfig({ layout });
  };

  // Check StreamIO backend connectivity
  useEffect(() => {
    fetch(`${StreamIOAPIConfig.baseURL}${StreamIOAPIConfig.endpoints.health}`)
      .then((r) => setConnected(r.ok))
      .catch(() => setConnected(false));
  }, []);

  const captureOptions: { value: 'screen' | 'camera' | 'both'; label: string; Icon: any }[] = [
    { value: 'screen', label: 'Screen', Icon: Monitor },
    { value: 'camera', label: 'Camera', Icon: Camera },
    { value: 'both', label: 'Both', Icon: Layers },
  ];

  const resolutionOptions = [
    { label: '720p', value: '1280x720' },
    { label: '1080p', value: '1920x1080' },
  ];

  const bitrateOptions = [
    { label: '0.5 Mbps', value: 500000 },
    { label: '1.0 Mbps', value: 1000000 },
    { label: '1.5 Mbps', value: 1500000 },
    { label: '3.0 Mbps', value: 3000000 },
  ];

  const fpsOptions = [
    { label: '24', value: 24 },
    { label: '30', value: 30 },
  ];

  return (
    <View>
      {/* Connection Status */}
      <SettingRow
        label="StreamIO Backend"
        description={StreamIOAPIConfig.baseURL}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {connected ? (
              <Wifi size={16} color={theme.success} />
            ) : (
              <WifiOff size={16} color={theme.textTertiary} />
            )}
            <Text style={{ fontSize: 13, color: connected ? theme.success : theme.textTertiary }}>
              {connected ? 'Connected' : 'Offline'}
            </Text>
          </View>
        }
      />

      {/* Capture Source */}
      <View style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginBottom: 8 }}>
          Capture Source
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {captureOptions.map(({ value, label, Icon }) => (
            <TouchableOpacity
              key={value}
              onPress={() => setCaptureSource(value)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: captureSource === value ? theme.primary : theme.background,
                gap: 4,
              }}
            >
              <Icon size={16} color={captureSource === value ? '#FFFFFF' : theme.textSecondary} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: captureSource === value ? '#FFFFFF' : theme.textSecondary,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* PiP Layout (only when capture source is "both") */}
      {captureSource === 'both' && (
        <View style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
          <PipLayoutPicker selected={pipLayout} onSelect={handleLayoutChange} />
        </View>
      )}

      {/* Resolution */}
      <View style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginBottom: 8 }}>
          Resolution
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {resolutionOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setConfig({ resolution: opt.value })}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: config.resolution === opt.value ? theme.primary : theme.background,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: config.resolution === opt.value ? '#FFFFFF' : theme.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bitrate */}
      <View style={{ padding: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, marginBottom: 8 }}>
          Bitrate
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {bitrateOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setConfig({ bitrate: opt.value })}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: config.bitrate === opt.value ? theme.primary : theme.background,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: config.bitrate === opt.value ? '#FFFFFF' : theme.textSecondary,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Inference Toggle */}
      <SettingRow
        label="AI Inference"
        description="Enable multi-agent AI overlay during streams"
        right={<Switch value={inferenceEnabled} onValueChange={setInferenceEnabled} />}
      />
    </View>
  );
}
