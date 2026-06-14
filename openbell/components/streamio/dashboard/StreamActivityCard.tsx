import React from 'react';
import { View, Text } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Radio, Square, Milestone, Brain, Terminal } from 'lucide-react-native';
import type { StreamActivity, StreamActivityType } from '@/hooks/streamio/useStreamActivity';

const iconMap: Record<StreamActivityType, any> = {
  stream_started: Radio,
  stream_ended: Square,
  stream_milestone: Milestone,
  inference_event: Brain,
  terminal_command: Terminal,
};

const colorMap: Record<StreamActivityType, string> = {
  stream_started: '#10B981',
  stream_ended: '#6B7280',
  stream_milestone: '#F59E0B',
  inference_event: '#8B5CF6',
  terminal_command: '#3B82F6',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function StreamActivityCard({ activity }: { activity: StreamActivity }) {
  const { theme } = useThemeStore();
  const Icon = iconMap[activity.type];
  const color = colorMap[activity.type];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: color + '18',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{activity.title}</Text>
          <Text style={{ fontSize: 11, color: theme.textTertiary }}>{formatTime(activity.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
          {activity.detail}
        </Text>
      </View>
    </View>
  );
}
