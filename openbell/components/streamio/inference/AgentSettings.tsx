// Agent settings — expandable per-agent configuration card
//
// Allows overriding: model, system prompt, temperature,
// max tokens, annotation color, and min interval.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { InferenceAgent, GeminiModel } from '@/types/streamio/inference';

interface AgentSettingsProps {
  agent: InferenceAgent;
  onUpdate: (updates: Partial<InferenceAgent>) => void;
}

export const AgentSettings: React.FC<AgentSettingsProps> = ({
  agent,
  onUpdate,
}) => {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Collapsed header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={[styles.colorDot, { backgroundColor: agent.color }]} />
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {agent.name}
        </Text>
        {expanded
          ? <ChevronUp size={16} color={theme.textTertiary} />
          : <ChevronDown size={16} color={theme.textTertiary} />
        }
      </TouchableOpacity>

      {/* Expanded settings */}
      {expanded && (
        <View style={styles.settings}>
          {/* Model selector */}
          <SettingRow label="Model">
            <View style={styles.modelToggle}>
              <ModelOption
                label="Flash"
                active={agent.model === 'gemini-2.0-flash'}
                onPress={() => onUpdate({ model: 'gemini-2.0-flash' })}
              />
              <ModelOption
                label="Pro"
                active={agent.model === 'gemini-2.0-pro'}
                onPress={() => onUpdate({ model: 'gemini-2.0-pro' })}
              />
            </View>
          </SettingRow>

          {/* Temperature slider (text input for simplicity) */}
          <SettingRow label={`Temperature: ${agent.temperature.toFixed(1)}`}>
            <View style={styles.sliderRow}>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.sliderDot,
                    {
                      backgroundColor: agent.temperature === val ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => onUpdate({ temperature: val })}
                />
              ))}
            </View>
          </SettingRow>

          {/* Max tokens */}
          <SettingRow label="Max Tokens">
            <View style={styles.tokenOptions}>
              {[100, 200, 500, 1000].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.tokenOption,
                    {
                      backgroundColor: agent.maxOutputTokens === val ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => onUpdate({ maxOutputTokens: val })}
                >
                  <Text style={[
                    styles.tokenOptionText,
                    { color: agent.maxOutputTokens === val ? '#FFFFFF' : theme.textSecondary },
                  ]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingRow>

          {/* Min interval */}
          <SettingRow label="Frame Interval">
            <View style={styles.tokenOptions}>
              {[3000, 6000, 9000, 12000].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.tokenOption,
                    {
                      backgroundColor: agent.minIntervalMs === val ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => onUpdate({ minIntervalMs: val })}
                >
                  <Text style={[
                    styles.tokenOptionText,
                    { color: agent.minIntervalMs === val ? '#FFFFFF' : theme.textSecondary },
                  ]}>
                    {val / 1000}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingRow>

          {/* Input type indicator */}
          {agent.inputType === 'frame+audio' && (
            <SettingRow label="Input">
              <View style={[styles.audioIndicator]}>
                <Text style={[styles.audioIndicatorText]}>
                  🎤 Video + Audio (STT)
                </Text>
              </View>
            </SettingRow>
          )}

          {/* System prompt */}
          <SettingRow label="System Prompt">
            <TextInput
              style={[styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.border }]}
              value={agent.systemPrompt}
              onChangeText={(text) => onUpdate({ systemPrompt: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={theme.textTertiary}
              placeholder="Agent instructions..."
            />
          </SettingRow>

          {/* Color picker (simple preset options) */}
          <SettingRow label="Color">
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  style={[
                    styles.colorOption,
                    { backgroundColor: hex },
                    agent.color === hex && styles.colorSelected,
                  ]}
                  onPress={() => onUpdate({ color: hex })}
                />
              ))}
            </View>
          </SettingRow>
        </View>
      )}
    </View>
  );
};

// ─── Sub-Components ──────────────────────────────────────────────────

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function ModelOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useThemeStore();
  return (
    <TouchableOpacity
      style={[
        styles.modelOption,
        { backgroundColor: active ? theme.primary : theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.modelOptionText, { color: active ? '#FFFFFF' : theme.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Constants ───────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  settings: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  settingRow: {
    gap: 6,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  modelOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  modelOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sliderDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  tokenOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  tokenOption: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  tokenOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 64,
    maxHeight: 120,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  audioIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5E9',
  },
});
