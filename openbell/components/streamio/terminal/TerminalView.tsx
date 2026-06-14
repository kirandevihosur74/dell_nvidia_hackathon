// Terminal view — command interface + remote shell
// Redesigned to match Pencil Terminal - Redesign spec

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOTerminalStore, createEntryId } from '@/stores/streamio/terminalStore';
import * as TerminalService from '@/services/streamio/terminalService';
import {
  Play,
  Square,
  Activity,
  Trash2,
  Copy,
  Maximize2,
  Mic,
  CheckCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export const TerminalView: React.FC = () => {
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { theme } = useThemeStore();
  const {
    mode,
    isConnected,
    entries,
    outputBuffer,
    inputText,
    setInputText,
    addEntry,
    appendOutput,
    clearEntries,
    navigateHistory,
    setConnected,
    setMode,
    setSessionId,
  } = useStreamIOTerminalStore();

  const handleSubmit = useCallback(async () => {
    const cmd = inputText.trim();
    if (!cmd) return;
    setInputText('');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (mode === 'command') {
      const result = await TerminalService.executeRemoteCommand(cmd);
      addEntry({
        id: createEntryId(),
        command: cmd,
        output: result.output,
        exitCode: result.exitCode,
        timestamp: result.timestamp,
      });
    } else {
      TerminalService.writeToShell(cmd + '\n');
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, mode]);

  const handleQuickCmd = (action: string) => {
    switch (action) {
      case 'start':
        setInputText('streamio start');
        break;
      case 'stop':
        setInputText('streamio stop');
        break;
      case 'status':
        setInputText('streamio status --verbose');
        break;
      case 'clear':
        clearEntries();
        break;
    }
  };

  const canRun = inputText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, mode === 'command' && styles.segmentActive]}
          onPress={() => setMode('command')}
        >
          <Text style={[styles.segmentLabel, mode === 'command' && styles.segmentLabelActive]}>
            COMMAND
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, mode === 'remote' && styles.segmentActive]}
          onPress={() => setMode('remote')}
        >
          <Text style={[styles.segmentLabel, mode === 'remote' && styles.segmentLabelActive]}>
            REMOTE
          </Text>
        </TouchableOpacity>
      </View>

      {/* Terminal Card */}
      <View style={styles.terminalCard}>
        {/* Terminal Header Bar */}
        <View style={styles.termHeader}>
          <View style={styles.termHeaderLeft}>
            <View style={[styles.termDot, { backgroundColor: '#DC2626' }]} />
            <View style={[styles.termDot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.termDot, { backgroundColor: '#059669' }]} />
            <Text style={styles.termTitle}>streamio — zsh</Text>
          </View>
          <View style={styles.termHeaderRight}>
            <TouchableOpacity hitSlop={8}>
              <Copy size={14} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={8}>
              <Maximize2 size={14} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Terminal Body */}
        <ScrollView
          ref={scrollRef}
          style={styles.termBody}
          contentContainerStyle={styles.termBodyContent}
        >
          {mode === 'command' ? (
            entries.length === 0 ? (
              <>
                <Text style={styles.welcomeText}>StreamIO Terminal v2.4.1</Text>
                <Text style={styles.welcomeSub}>Type a command or use voice input.</Text>
              </>
            ) : (
              entries.map((entry, index) => (
                <View key={entry.id}>
                  {index > 0 && <View style={styles.divider} />}
                  {/* Command line */}
                  <View style={styles.cmdLine}>
                    <Text style={styles.promptSymbol}>$</Text>
                    <Text style={styles.cmdText}>{entry.command}</Text>
                  </View>
                  {/* Output */}
                  {entry.output ? (
                    <View style={styles.outputBlock}>
                      {entry.output.split('\n').map((line, i) => (
                        <Text key={i} style={styles.outputText}>{line}</Text>
                      ))}
                    </View>
                  ) : null}
                  {/* Success/Error indicator */}
                  {entry.exitCode === 0 ? (
                    <View style={styles.successLine}>
                      <CheckCircle size={14} color="#059669" />
                      <Text style={styles.successText}>Complete</Text>
                    </View>
                  ) : entry.exitCode !== undefined && entry.exitCode !== 0 ? (
                    <Text style={styles.errorText}>Exit code: {entry.exitCode}</Text>
                  ) : null}
                </View>
              ))
            )
          ) : (
            <Text style={styles.shellOutput} selectable>
              {outputBuffer || 'Not connected. Use remote shell to connect.\n'}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Input Area */}
      <View style={styles.inputArea}>
        {/* Quick command chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCmds}>
          {[
            { key: 'start', label: 'Start', icon: Play, iconColor: '#059669' },
            { key: 'stop', label: 'Stop', icon: Square, iconColor: '#DC2626' },
            { key: 'status', label: 'Status', icon: Activity, iconColor: '#2563EB' },
            { key: 'clear', label: 'Clear', icon: Trash2, iconColor: '#F59E0B' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={styles.qcChip}
              onPress={() => handleQuickCmd(chip.key)}
            >
              <chip.icon size={10} color={chip.iconColor} />
              <Text style={styles.qcText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputField}>
            <Text style={styles.inputPrompt}>$</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="command..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <TouchableOpacity onPress={handleSubmit} disabled={!canRun} activeOpacity={0.8}>
            <LinearGradient
              colors={canRun ? ['#10B981', '#059669'] : [theme.border, theme.textTertiary]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.runBtn}
            >
              <Play size={20} color={canRun ? '#FFFFFF' : theme.textSecondary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 16,
    gap: 16,
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#EBEDF0',
    borderRadius: 10,
    padding: 4,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 1,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#6B7280',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Terminal Card
  terminalCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  termHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  termHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  termDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  termTitle: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  termHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  termBody: {
    flex: 1,
  },
  termBodyContent: {
    padding: 16,
    gap: 12,
  },

  // Welcome text
  welcomeText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  welcomeSub: {
    fontSize: 11,
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Command entries
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  cmdLine: {
    flexDirection: 'row',
    gap: 6,
  },
  promptSymbol: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cmdText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  outputBlock: {
    marginTop: 4,
    gap: 2,
  },
  outputText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  successLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  successText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  shellOutput: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },

  // Input Area
  inputArea: {
    gap: 8,
  },
  quickCmds: {
    flexDirection: 'row',
    gap: 6,
  },
  qcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  qcText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputPrompt: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 0,
  },
  runBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
