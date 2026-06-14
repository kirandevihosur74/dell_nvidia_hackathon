// Pipeline builder — visual stage editor with drag-to-reorder
//
// Shows pipeline stages as a vertical list. Each stage shows its
// agents (parallel within a stage). Stages are chained top-to-bottom.
// Users can reorder stages and move agents between stages.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import {
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  ArrowDown,
} from 'lucide-react-native';
import { PipelineConfig, PipelineStage } from '@/types/streamio/inference';
import { getAgentById } from '@/services/streamio/agentRegistry';
import * as Haptics from 'expo-haptics';

interface PipelineBuilderProps {
  pipeline: PipelineConfig;
  onMoveStage: (fromIndex: number, toIndex: number) => void;
  onRemoveAgent: (stageIndex: number, agentId: string) => void;
  onAddStage: () => void;
  onTogglePassContext: (stageIndex: number) => void;
}

export const PipelineBuilder: React.FC<PipelineBuilderProps> = ({
  pipeline,
  onMoveStage,
  onRemoveAgent,
  onAddStage,
  onTogglePassContext,
}) => {
  const { theme } = useThemeStore();

  if (pipeline.stages.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: theme.textTertiary }]}>Pipeline</Text>
        <View style={[styles.emptyState, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
            Select agents above to build your pipeline
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.textTertiary }]}>Pipeline</Text>
        <Text style={[styles.stageCount, { color: theme.textTertiary }]}>
          {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {pipeline.stages.map((stage, index) => (
        <React.Fragment key={`stage-${index}`}>
          <StageCard
            stage={stage}
            stageIndex={index}
            isFirst={index === 0}
            isLast={index === pipeline.stages.length - 1}
            onMoveUp={() => {
              Haptics.selectionAsync().catch(() => {});
              onMoveStage(index, index - 1);
            }}
            onMoveDown={() => {
              Haptics.selectionAsync().catch(() => {});
              onMoveStage(index, index + 1);
            }}
            onRemoveAgent={(agentId) => onRemoveAgent(index, agentId)}
            onTogglePassContext={() => onTogglePassContext(index)}
          />

          {/* Chain arrow between stages */}
          {index < pipeline.stages.length - 1 && (
            <View style={styles.chainArrow}>
              <ArrowDown size={16} color={stage.passContextToNext ? theme.primary : theme.textTertiary} />
              <Text style={[styles.chainLabel, { color: stage.passContextToNext ? theme.primary : theme.textTertiary }]}>
                {stage.passContextToNext ? 'passes context' : 'independent'}
              </Text>
            </View>
          )}
        </React.Fragment>
      ))}

      {/* Add Stage button */}
      <TouchableOpacity
        style={[styles.addStageButton, { borderColor: theme.border }]}
        onPress={onAddStage}
        activeOpacity={0.7}
      >
        <Plus size={16} color={theme.primary} />
        <Text style={[styles.addStageText, { color: theme.primary }]}>Add Stage</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Stage Card ──────────────────────────────────────────────────────

interface StageCardProps {
  stage: PipelineStage;
  stageIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemoveAgent: (agentId: string) => void;
  onTogglePassContext: () => void;
}

const StageCard: React.FC<StageCardProps> = ({
  stage,
  stageIndex,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemoveAgent,
  onTogglePassContext,
}) => {
  const { theme } = useThemeStore();
  const isParallel = stage.agents.length > 1;

  return (
    <View style={[styles.stageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {/* Stage header */}
      <View style={styles.stageHeader}>
        <View style={styles.stageInfo}>
          <Text style={[styles.stageName, { color: theme.text }]}>
            Stage {stageIndex}
          </Text>
          <View style={[styles.modeBadge, { backgroundColor: theme.border }]}>
            <Text style={[styles.modeText, { color: theme.textSecondary }]}>
              {isParallel ? 'Parallel' : 'Single'}
            </Text>
          </View>
        </View>

        {/* Reorder buttons */}
        <View style={styles.reorderButtons}>
          <TouchableOpacity
            onPress={onMoveUp}
            disabled={isFirst}
            style={[styles.reorderButton, isFirst && styles.reorderDisabled]}
            hitSlop={6}
          >
            <ChevronUp size={16} color={isFirst ? theme.textTertiary : theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMoveDown}
            disabled={isLast}
            style={[styles.reorderButton, isLast && styles.reorderDisabled]}
            hitSlop={6}
          >
            <ChevronDown size={16} color={isLast ? theme.textTertiary : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Agent chips */}
      <View style={styles.agentChips}>
        {stage.agents.map((agentId) => {
          const agent = getAgentById(agentId);
          if (!agent) return null;

          return (
            <View
              key={agentId}
              style={[styles.agentChip, { backgroundColor: agent.color + '20', borderColor: agent.color + '40' }]}
            >
              <View style={[styles.chipDot, { backgroundColor: agent.color }]} />
              <Text style={[styles.chipName, { color: theme.text }]} numberOfLines={1}>
                {agent.name}
              </Text>
              <TouchableOpacity
                onPress={() => onRemoveAgent(agentId)}
                hitSlop={6}
                style={styles.chipRemove}
              >
                <X size={12} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Context toggle */}
      {!isLast && (
        <TouchableOpacity
          style={styles.contextToggle}
          onPress={onTogglePassContext}
          activeOpacity={0.7}
        >
          <Text style={[styles.contextText, { color: stage.passContextToNext ? theme.primary : theme.textTertiary }]}>
            {stage.passContextToNext ? 'Passes context to next stage' : 'Tap to pass context'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stageCount: {
    fontSize: 12,
  },
  emptyState: {
    padding: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  stageCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 2,
  },
  reorderButton: {
    padding: 4,
  },
  reorderDisabled: {
    opacity: 0.3,
  },
  agentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipName: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 100,
  },
  chipRemove: {
    padding: 2,
  },
  contextToggle: {
    paddingVertical: 4,
  },
  contextText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  chainArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  chainLabel: {
    fontSize: 11,
  },
  addStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addStageText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
