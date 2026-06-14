import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useStreamIOAuth } from '@/hooks/streamio/useStreamIOAuth';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { Radio, Camera, Monitor, Layers, Check } from 'lucide-react-native';
import type { CapturePreference, QualityPreset } from '@/types/streamio';

interface StreamFirstRunSetupProps {
  visible: boolean;
  onComplete: () => void;
}

const CAPTURE_OPTIONS: { value: CapturePreference; label: string; description: string; Icon: any }[] = [
  { value: 'screen', label: 'Screen', description: 'Share your screen', Icon: Monitor },
  { value: 'camera', label: 'Camera', description: 'Use front or back camera', Icon: Camera },
  { value: 'both', label: 'Both (PiP)', description: 'Screen + camera overlay', Icon: Layers },
];

const QUALITY_OPTIONS: { value: QualityPreset; label: string; resolution: string; bitrate: string }[] = [
  { value: 'low', label: 'Low', resolution: '640x480', bitrate: '0.5 Mbps' },
  { value: 'medium', label: 'Medium', resolution: '1280x720', bitrate: '1.5 Mbps' },
  { value: 'high', label: 'High', resolution: '1920x1080', bitrate: '3.0 Mbps' },
];

export default function StreamFirstRunSetup({ visible, onComplete }: StreamFirstRunSetupProps) {
  const { theme } = useThemeStore();
  const { setStreamioFirstRunComplete } = useSettingsStore();
  const { isAuthenticated } = useStreamIOAuth();
  const setCaptureSource = useStreamIOStreamStore((s) => s.setCaptureSource);
  const setConfig = useStreamIOStreamStore((s) => s.setConfig);

  const [step, setStep] = useState<'capture' | 'quality'>('capture');
  const [selectedCapture, setSelectedCapture] = useState<CapturePreference>('camera');
  const [selectedQuality, setSelectedQuality] = useState<QualityPreset>('medium');

  const handleComplete = () => {
    // Apply selections
    setCaptureSource(selectedCapture === 'both' ? 'both' : selectedCapture);

    const qualityMap: Record<QualityPreset, { resolution: string; bitrate: number }> = {
      low: { resolution: '640x480', bitrate: 500000 },
      medium: { resolution: '1280x720', bitrate: 1500000 },
      high: { resolution: '1920x1080', bitrate: 3000000 },
      custom: { resolution: '1280x720', bitrate: 1500000 },
    };

    const q = qualityMap[selectedQuality];
    setConfig({ resolution: q.resolution, bitrate: q.bitrate });

    setStreamioFirstRunComplete(true);
    onComplete();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Radio size={32} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>Stream Setup</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === 'capture'
              ? 'Choose your default capture source'
              : 'Select stream quality'}
          </Text>
        </View>

        {step === 'capture' && (
          <View style={styles.options}>
            {CAPTURE_OPTIONS.map(({ value, label, description, Icon }) => {
              const selected = selectedCapture === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedCapture(value)}
                >
                  <Icon size={28} color={selected ? theme.primary : theme.textTertiary} />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      {description}
                    </Text>
                  </View>
                  {selected && <Check size={20} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 'quality' && (
          <View style={styles.options}>
            {QUALITY_OPTIONS.map(({ value, label, resolution, bitrate }) => {
              const selected = selectedQuality === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedQuality(value)}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>
                      {resolution} · {bitrate}
                    </Text>
                  </View>
                  {selected && <Check size={20} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          {step === 'quality' && (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.border }]}
              onPress={() => setStep('capture')}
            >
              <Text style={[styles.backButtonText, { color: theme.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.primary }]}
            onPress={() => {
              if (step === 'capture') {
                setStep('quality');
              } else {
                handleComplete();
              }
            }}
          >
            <Text style={styles.nextButtonText}>
              {step === 'capture' ? 'Next' : 'Get Started'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 40,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  options: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 'auto',
    gap: 12,
    paddingBottom: 16,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
