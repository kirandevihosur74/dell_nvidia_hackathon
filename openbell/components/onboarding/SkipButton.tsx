import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from 'react-native';
import { Typography } from '@/components/onboarding/theme';
import { Colors } from '@/components/onboarding/theme';
import { Spacing } from '@/components/onboarding/theme';

interface SkipButtonProps {
  onSkip: () => void;
  style?: ViewStyle;
  text?: string;
}

const SkipButton: React.FC<SkipButtonProps> = ({ 
  onSkip, 
  style, 
  text = "Skip This Step" 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.skipContainer, style]} 
      onPress={onSkip}
      activeOpacity={0.7}
    >
      <Text style={styles.skipText}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  skipContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    marginVertical: Spacing.md,
  },
  skipText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});

export default SkipButton; 