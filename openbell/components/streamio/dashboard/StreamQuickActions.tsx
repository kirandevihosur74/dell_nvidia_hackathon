import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useRouter } from 'expo-router';
import { Radio, Terminal } from 'lucide-react-native';

export function StreamQuickActions() {
  const { theme } = useThemeStore();
  const router = useRouter();

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: theme.card }]}
        onPress={() => router.push('/(tabs)/stream')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#3B82F6' + '18' }]}>
          <Radio size={18} color="#3B82F6" />
        </View>
        <Text style={[styles.actionLabel, { color: theme.text }]}>Start Stream</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.action, { backgroundColor: theme.card }]}
        onPress={() => router.push('/(tabs)/terminal')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: '#8B5CF6' + '18' }]}>
          <Terminal size={18} color="#8B5CF6" />
        </View>
        <Text style={[styles.actionLabel, { color: theme.text }]}>Open Terminal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
