// Agent picker — grid of available agents grouped by category
//
// Shown in the pre-stream config area. Tap to toggle agents on/off.
// Horizontal filter chips let users browse by category or view all.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Check } from 'lucide-react-native';
import { InferenceAgent, AgentCategory } from '@/types/streamio/inference';
import { getAllAgents, AGENT_CATEGORIES, AgentCategoryMeta } from '@/services/streamio/agentRegistry';
import * as Haptics from 'expo-haptics';

interface AgentPickerProps {
  selectedAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
}

export const AgentPicker: React.FC<AgentPickerProps> = ({
  selectedAgentIds,
  onToggleAgent,
}) => {
  const { theme } = useThemeStore();
  const agents = getAllAgents();
  const [activeFilter, setActiveFilter] = useState<AgentCategory | 'all'>('all');

  const handleToggle = (agentId: string) => {
    Haptics.selectionAsync().catch(() => {});
    onToggleAgent(agentId);
  };

  // Group agents by category, preserving registry order within each group
  const groupedAgents = useMemo(() => {
    const groups: { category: AgentCategoryMeta; agents: InferenceAgent[] }[] = [];
    for (const cat of AGENT_CATEGORIES) {
      const catAgents = agents.filter((a) => a.category === cat.id);
      if (catAgents.length > 0) {
        groups.push({ category: cat, agents: catAgents });
      }
    }
    return groups;
  }, [agents]);

  // Filtered view
  const visibleGroups = activeFilter === 'all'
    ? groupedAgents
    : groupedAgents.filter((g) => g.category.id === activeFilter);

  // Count selected per category for badge
  const selectedCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      if (selectedAgentIds.includes(agent.id)) {
        counts[agent.category] = (counts[agent.category] || 0) + 1;
      }
    }
    return counts;
  }, [agents, selectedAgentIds]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textTertiary }]}>AI Agents</Text>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="All"
          isActive={activeFilter === 'all'}
          color={theme.primary}
          count={selectedAgentIds.length}
          onPress={() => setActiveFilter('all')}
        />
        {AGENT_CATEGORIES.map((cat) => {
          const catAgents = agents.filter((a) => a.category === cat.id);
          if (catAgents.length === 0) return null;
          return (
            <FilterChip
              key={cat.id}
              label={cat.label}
              isActive={activeFilter === cat.id}
              color={cat.color}
              count={selectedCountByCategory[cat.id] || 0}
              onPress={() => setActiveFilter(activeFilter === cat.id ? 'all' : cat.id)}
            />
          );
        })}
      </ScrollView>

      {/* Grouped agent grid */}
      {visibleGroups.map((group) => (
        <View key={group.category.id} style={styles.groupContainer}>
          <View style={styles.groupHeader}>
            <View style={[styles.groupDot, { backgroundColor: group.category.color }]} />
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>
              {group.category.label}
            </Text>
            <Text style={[styles.groupCount, { color: theme.textTertiary }]}>
              {group.agents.length}
            </Text>
          </View>
          <View style={styles.grid}>
            {group.agents.map((agent) => {
              const isSelected = selectedAgentIds.includes(agent.id);
              return (
                <AgentPickerCard
                  key={agent.id}
                  agent={agent}
                  selected={isSelected}
                  onPress={() => handleToggle(agent.id)}
                />
              );
            })}
          </View>
        </View>
      ))}

      {selectedAgentIds.length > 0 && (
        <Text style={[styles.hint, { color: theme.textTertiary }]}>
          {selectedAgentIds.length} agent{selectedAgentIds.length !== 1 ? 's' : ''} selected
        </Text>
      )}
    </View>
  );
};

// ─── Filter Chip ─────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  isActive: boolean;
  color: string;
  count: number;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, isActive, color, count, onPress }) => {
  const { theme } = useThemeStore();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: isActive ? color + '18' : theme.card,
          borderColor: isActive ? color : theme.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          { color: isActive ? color : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.chipBadge, { backgroundColor: color }]}>
          <Text style={styles.chipBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Agent Card ──────────────────────────────────────────────────────

interface AgentPickerCardProps {
  agent: InferenceAgent;
  selected: boolean;
  onPress: () => void;
}

const AgentPickerCard: React.FC<AgentPickerCardProps> = ({
  agent,
  selected,
  onPress,
}) => {
  const { theme } = useThemeStore();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: selected ? agent.color + '18' : theme.card,
          borderColor: selected ? agent.color : theme.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Color indicator + check */}
      <View style={styles.cardHeader}>
        <View style={[styles.colorDot, { backgroundColor: agent.color }]} />
        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: agent.color }]}>
            <Check size={10} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Info */}
      <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
        {agent.name}
      </Text>
      <Text style={[styles.cardDesc, { color: theme.textTertiary }]} numberOfLines={2}>
        {agent.description}
      </Text>

      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.modelBadge, { backgroundColor: theme.border }]}>
          <Text style={[styles.modelText, { color: theme.textTertiary }]}>
            {agent.model === 'gemini-2.0-pro' ? 'Pro' : 'Flash'}
          </Text>
        </View>
        {agent.inputType === 'frame+audio' && (
          <View style={[styles.modelBadge, { backgroundColor: 'rgba(14, 165, 233, 0.12)' }]}>
            <Text style={[styles.modelText, { color: '#0EA5E9' }]}>
              STT
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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

  // Filter chips
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chipBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Group sections
  groupContainer: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  groupCount: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Agent grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    width: '47%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  modelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modelText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
