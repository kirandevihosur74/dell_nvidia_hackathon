import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { CompositeLayout } from '@/services/streamio/compositeService';
import * as Haptics from 'expo-haptics';

interface PipLayoutPickerProps {
  selected: CompositeLayout;
  onSelect: (layout: CompositeLayout) => void;
}

const LAYOUTS: { key: CompositeLayout; label: string }[] = [
  { key: 'pip-bottom-right', label: 'Bottom Right' },
  { key: 'pip-bottom-left', label: 'Bottom Left' },
  { key: 'pip-top-right', label: 'Top Right' },
  { key: 'pip-top-left', label: 'Top Left' },
  { key: 'side-by-side', label: 'Side by Side' },
  { key: 'full-screen', label: 'Full Screen' },
];

export const PipLayoutPicker: React.FC<PipLayoutPickerProps> = ({
  selected,
  onSelect,
}) => {
  const theme = useThemeStore((s) => s.theme);
  const handleSelect = (layout: CompositeLayout) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(layout);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textTertiary }]}>PiP Layout</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {LAYOUTS.map((layout) => {
          const isSelected = selected === layout.key;
          return (
            <TouchableOpacity
              key={layout.key}
              style={[styles.option, { backgroundColor: theme.card, borderColor: theme.border }, isSelected && { borderColor: theme.primary, backgroundColor: theme.primary + '12' }]}
              onPress={() => handleSelect(layout.key)}
              activeOpacity={0.7}
            >
              <LayoutPreview layout={layout.key} isSelected={isSelected} />
              <Text
                style={[styles.optionLabel, { color: theme.textSecondary }, isSelected && { color: theme.primary, fontWeight: '600' }]}
                numberOfLines={1}
              >
                {layout.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

function LayoutPreview({
  layout,
  isSelected,
}: {
  layout: CompositeLayout;
  isSelected: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const primaryColor = isSelected ? theme.primary : theme.textTertiary;
  const pipColor = isSelected ? theme.primary : theme.textTertiary;

  return (
    <View style={[styles.previewBox, { backgroundColor: theme.border }]}>
      {/* Primary area */}
      <View style={[styles.previewPrimary, { borderColor: primaryColor }]} />

      {/* PiP area */}
      {layout !== 'full-screen' && layout !== 'side-by-side' && (
        <View
          style={[
            styles.previewPip,
            { backgroundColor: pipColor },
            layout === 'pip-bottom-right' && styles.pipBR,
            layout === 'pip-bottom-left' && styles.pipBL,
            layout === 'pip-top-right' && styles.pipTR,
            layout === 'pip-top-left' && styles.pipTL,
          ]}
        />
      )}

      {/* Side-by-side */}
      {layout === 'side-by-side' && (
        <View style={styles.sideBySide}>
          <View style={[styles.sideHalf, { backgroundColor: primaryColor + '40' }]} />
          <View style={[styles.sideHalf, { backgroundColor: pipColor + '40' }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  option: {
    width: 88,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  previewBox: {
    width: 56,
    height: 36,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  previewPrimary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
  },
  previewPip: {
    position: 'absolute',
    width: 16,
    height: 12,
    borderRadius: 2,
  },
  pipBR: { bottom: 3, right: 3 },
  pipBL: { bottom: 3, left: 3 },
  pipTR: { top: 3, right: 3 },
  pipTL: { top: 3, left: 3 },
  sideBySide: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  sideHalf: {
    flex: 1,
    margin: 2,
    borderRadius: 2,
  },
});
