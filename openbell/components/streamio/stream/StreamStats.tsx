import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { spacing } from '@/constants/spacing';
import { Clock, Layers, Users, Wifi, Cpu } from 'lucide-react-native';

interface StreamStatsProps {
  duration: string;
  segmentCount: number;
  viewerCount: number;
  bitrate: string;
  resolution: string;
  transcodingMode: string;
}

export const StreamStats: React.FC<StreamStatsProps> = ({
  duration,
  segmentCount,
  viewerCount,
  bitrate,
  resolution,
  transcodingMode,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const inferenceStatus = useStreamIOInferenceStore((s) => s.status);
  const budget = useStreamIOInferenceStore((s) => s.budget);
  const showInference = inferenceStatus === 'active' || inferenceStatus === 'paused';

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.row}>
        <StatItem icon={<Clock size={16} color={theme.primary} />} label="Duration" value={duration} />
        <StatItem icon={<Layers size={16} color={theme.primary} />} label="Segments" value={String(segmentCount)} />
      </View>
      <View style={styles.row}>
        <StatItem icon={<Users size={16} color={theme.success} />} label="Viewers" value={String(viewerCount)} />
        <StatItem icon={<Wifi size={16} color="#8B5CF6" />} label="Bitrate" value={bitrate} />
      </View>
      {showInference && (
        <View style={styles.row}>
          <StatItem
            icon={<Cpu size={16} color={theme.primary} />}
            label="AI Cost"
            value={`$${budget.estimatedCost.toFixed(3)}`}
          />
          <StatItem
            icon={<Cpu size={16} color={theme.primary} />}
            label="Tokens"
            value={budget.tokensUsed.toLocaleString()}
          />
        </View>
      )}
      <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.infoText, { color: theme.textTertiary }]}>
          {resolution} | {transcodingMode === 'onDevice' ? 'On-Device' : 'Server-Side'}
          {showInference ? ' | AI Active' : ''}
        </Text>
      </View>
    </View>
  );
};

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View style={styles.statItem}>
      {icon}
      <View>
        <Text style={[styles.statLabel, { color: theme.textTertiary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  infoRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    fontSize: 12,
  },
});
