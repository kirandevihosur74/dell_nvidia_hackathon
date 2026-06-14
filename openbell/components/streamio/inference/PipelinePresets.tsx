// Pipeline presets — save/load named pipeline configurations
//
// Shows a horizontal list of saved pipelines + "New" button.
// Selected pipeline is highlighted with a check.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Plus, Check, Trash2 } from 'lucide-react-native';
import { PipelineConfig } from '@/types/streamio/inference';
import * as Haptics from 'expo-haptics';

interface PipelinePresetsProps {
  pipelines: PipelineConfig[];
  activePipelineId: string | null;
  onSelect: (pipelineId: string) => void;
  onCreateNew: () => void;
  onDelete: (pipelineId: string) => void;
}

export const PipelinePresets: React.FC<PipelinePresetsProps> = ({
  pipelines,
  activePipelineId,
  onSelect,
  onCreateNew,
  onDelete,
}) => {
  const { theme } = useThemeStore();

  const handleSelect = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(id);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textTertiary }]}>Pipeline Presets</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* New pipeline button */}
        <TouchableOpacity
          style={[styles.presetCard, styles.newCard, { borderColor: theme.primary }]}
          onPress={onCreateNew}
          activeOpacity={0.7}
        >
          <Plus size={20} color={theme.primary} />
          <Text style={[styles.newText, { color: theme.primary }]}>New</Text>
        </TouchableOpacity>

        {/* Saved pipelines */}
        {pipelines.map((pipeline) => {
          const isActive = pipeline.id === activePipelineId;
          const agentCount = pipeline.stages.reduce((sum, s) => sum + s.agents.length, 0);

          return (
            <TouchableOpacity
              key={pipeline.id}
              style={[
                styles.presetCard,
                {
                  backgroundColor: isActive ? theme.primary + '15' : theme.card,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
              onPress={() => handleSelect(pipeline.id)}
              onLongPress={() => onDelete(pipeline.id)}
              activeOpacity={0.7}
            >
              {isActive && (
                <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                  <Check size={10} color="#FFFFFF" />
                </View>
              )}
              <Text
                style={[styles.presetName, { color: isActive ? theme.primary : theme.text }]}
                numberOfLines={1}
              >
                {pipeline.name}
              </Text>
              <Text style={[styles.presetMeta, { color: theme.textTertiary }]}>
                {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? 's' : ''} · {agentCount} agent{agentCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {pipelines.length > 0 && (
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          Long press to delete a preset
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  presetCard: {
    width: 120,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 4,
    justifyContent: 'center',
  },
  newCard: {
    alignItems: 'center',
    borderStyle: 'dashed',
    gap: 4,
  },
  newText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 13,
    fontWeight: '600',
  },
  presetMeta: {
    fontSize: 11,
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
  },
});
