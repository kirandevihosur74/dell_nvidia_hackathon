import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TerminalView } from '@/components/streamio/terminal/TerminalView';
import { useStreamIOTerminalStore } from '@/stores/streamio/terminalStore';
import { useThemeStore } from '@/stores/themeStore';
import { Clock, Settings as SettingsIcon } from 'lucide-react-native';

export default function TerminalScreen() {
  const { mode } = useStreamIOTerminalStore();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.breadcrumb, { color: theme.textTertiary }]}>COMMAND INTERFACE</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Terminal</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity hitSlop={8} style={styles.headerIconBtn}>
              <Clock size={20} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: theme.card }]}>
              <SettingsIcon size={18} color={theme.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TerminalView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    gap: 4,
  },
  breadcrumb: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    padding: 8,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
