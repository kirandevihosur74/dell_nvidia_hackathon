// Agent card — individual agent toggle for the viewer panel
//
// Shows agent icon, name, status indicator, and toggle switches
// for annotations visibility, chat visibility, and overlay visibility.

import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { ViewerAgentToggle, AgentRuntimeState } from '@/types/streamio/inference';

interface AgentCardProps {
  name: string;
  color: string;
  status: AgentRuntimeState['status'];
  toggle: ViewerAgentToggle;
  framesProcessed: number;
  onToggleAnnotations: (value: boolean) => void;
  onToggleChat: (value: boolean) => void;
  onToggleOverlay: (value: boolean) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  color,
  status,
  toggle,
  framesProcessed,
  onToggleAnnotations,
  onToggleChat,
  onToggleOverlay,
}) => {
  const { theme } = useThemeStore();

  const statusColor =
    status === 'active' ? theme.success :
    status === 'error' ? theme.error :
    status === 'rate_limited' ? theme.warning :
    theme.textTertiary;

  const statusLabel =
    status === 'active' ? 'Active' :
    status === 'error' ? 'Error' :
    status === 'rate_limited' ? 'Rate Limited' :
    'Idle';

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Header: colored dot + name + status */}
      <View style={styles.header}>
        <View style={[styles.colorDot, { backgroundColor: color }]} />
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={[styles.stats, { color: theme.textTertiary }]}>
        {framesProcessed} frames processed
      </Text>

      {/* Toggles */}
      <View style={styles.toggles}>
        <ToggleRow
          label="Annotations"
          value={toggle.annotationsVisible}
          onValueChange={onToggleAnnotations}
        />
        <ToggleRow
          label="Chat"
          value={toggle.chatVisible}
          onValueChange={onToggleChat}
        />
        <ToggleRow
          label="Overlay"
          value={toggle.overlayVisible}
          onValueChange={onToggleOverlay}
        />
      </View>
    </View>
  );
};

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { theme } = useThemeStore();

  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#FFFFFF"
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  stats: {
    fontSize: 11,
  },
  toggles: {
    gap: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    fontSize: 13,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
});
