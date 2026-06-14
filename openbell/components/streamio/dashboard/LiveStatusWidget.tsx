import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOStreamStore } from '@/stores/streamio/streamStore';
import { Radio, Wifi, Clock, Layers } from 'lucide-react-native';
import { formatBitrate, formatDuration } from '@/services/streamio/streamService';

export function LiveStatusWidget() {
  const { theme } = useThemeStore();
  const status = useStreamIOStreamStore((s) => s.status);
  const duration = useStreamIOStreamStore((s) => s.duration);
  const segmentCount = useStreamIOStreamStore((s) => s.segmentCount);
  const viewerCount = useStreamIOStreamStore((s) => s.viewerCount);
  const throughputBps = useStreamIOStreamStore((s) => s.throughputBps);

  const isLive = status === 'streaming';

  if (!isLive) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.liveBadge}>
          <Radio size={12} color="#FFFFFF" />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Stream Active</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Clock size={14} color={theme.textTertiary} />
          <Text style={[styles.statValue, { color: theme.text }]}>{formatDuration(duration)}</Text>
        </View>
        <View style={styles.stat}>
          <Layers size={14} color={theme.textTertiary} />
          <Text style={[styles.statValue, { color: theme.text }]}>{segmentCount} segs</Text>
        </View>
        <View style={styles.stat}>
          <Wifi size={14} color={theme.textTertiary} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {throughputBps > 0 ? formatBitrate(Math.round(throughputBps * 8)) : '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
