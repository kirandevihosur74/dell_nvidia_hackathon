// Agent toggle panel — floating overlay for viewers to control agent visibility
//
// Opens from a floating button (bottom-right of video).
// Shows each active agent with toggle switches and budget info.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useStreamIOInferenceStore } from '@/stores/streamio/inferenceStore';
import { getAgentById } from '@/services/streamio/agentRegistry';
import { AgentCard } from '@/components/streamio/inference/AgentCard';

interface AgentTogglePanelProps {
  visible: boolean;
  onClose: () => void;
}

export const AgentTogglePanel: React.FC<AgentTogglePanelProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useThemeStore();
  const agentStates = useStreamIOInferenceStore((s) => s.agentStates);
  const viewerToggles = useStreamIOInferenceStore((s) => s.viewerToggles);
  const budget = useStreamIOInferenceStore((s) => s.budget);
  const setAgentToggle = useStreamIOInferenceStore((s) => s.setAgentToggle);

  const agentIds = Object.keys(agentStates);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>AI Agents</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[styles.closeButton, { color: theme.textTertiary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Agent Cards */}
          <ScrollView style={styles.agentList} showsVerticalScrollIndicator={false}>
            {agentIds.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                No agents active
              </Text>
            ) : (
              <View style={styles.cardList}>
                {agentIds.map((agentId) => {
                  const agent = getAgentById(agentId);
                  const state = agentStates[agentId];
                  const toggle = viewerToggles[agentId] || {
                    annotationsVisible: true,
                    chatVisible: true,
                    overlayVisible: true,
                  };

                  if (!agent || !state) return null;

                  return (
                    <AgentCard
                      key={agentId}
                      name={agent.name}
                      color={agent.color}
                      status={state.status}
                      toggle={toggle}
                      framesProcessed={state.framesProcessed}
                      onToggleAnnotations={(v) => setAgentToggle(agentId, 'annotationsVisible', v)}
                      onToggleChat={(v) => setAgentToggle(agentId, 'chatVisible', v)}
                      onToggleOverlay={(v) => setAgentToggle(agentId, 'overlayVisible', v)}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Budget Footer */}
          <View style={[styles.budgetBar, { borderTopColor: theme.border }]}>
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetLabel, { color: theme.textTertiary }]}>Budget</Text>
              <Text style={[styles.budgetValue, { color: theme.text }]}>
                ${budget.estimatedCost.toFixed(2)} / ${(budget.estimatedCost + budget.budgetRemaining).toFixed(2)}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={[styles.budgetLabel, { color: theme.textTertiary }]}>Tokens</Text>
              <Text style={[styles.budgetValue, { color: theme.text }]}>
                {budget.tokensUsed.toLocaleString()}
              </Text>
            </View>
            {/* Budget progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: theme.card }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: getBudgetColor(budget, theme),
                    width: `${getBudgetPercent(budget)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Floating Toggle Button ──────────────────────────────────────────

interface AgentToggleButtonProps {
  onPress: () => void;
  agentCount: number;
}

export const AgentToggleButton: React.FC<AgentToggleButtonProps> = ({
  onPress,
  agentCount,
}) => {
  const { theme } = useThemeStore();

  if (agentCount === 0) return null;

  return (
    <TouchableOpacity
      style={[styles.floatingButton, { backgroundColor: theme.primary }]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={4}
    >
      <Text style={styles.floatingButtonText}>AI</Text>
      <View style={[styles.badge, { backgroundColor: '#FFFFFF' }]}>
        <Text style={[styles.badgeText, { color: theme.primary }]}>{agentCount}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────

function getBudgetPercent(budget: { estimatedCost: number; budgetRemaining: number }): number {
  const total = budget.estimatedCost + budget.budgetRemaining;
  if (total <= 0) return 0;
  return Math.min((budget.estimatedCost / total) * 100, 100);
}

function getBudgetColor(
  budget: { estimatedCost: number; budgetRemaining: number },
  theme: any,
): string {
  const pct = getBudgetPercent(budget);
  if (pct >= 90) return theme.error;
  if (pct >= 75) return theme.warning;
  return theme.success;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panel: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  agentList: {
    paddingHorizontal: 20,
    maxHeight: 350,
  },
  cardList: {
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  budgetBar: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  // Floating button
  floatingButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
