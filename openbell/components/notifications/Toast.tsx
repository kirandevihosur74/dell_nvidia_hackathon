import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore, ToastType } from '@/stores/toastStore';

export default function Toast() {
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { currentToast, dismiss } = useToastStore();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const toastColors: Record<ToastType, string> = {
    success: theme.success,
    error: theme.error,
    warning: theme.warning,
    info: theme.info,
  };

  useEffect(() => {
    if (currentToast) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => dismiss());
      }, currentToast.duration);

      return () => clearTimeout(timer);
    }
  }, [currentToast]);

  if (!currentToast) return null;

  const accentColor = toastColors[currentToast.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          transform: [{ translateY }],
          opacity,
          top: insets.top,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <Text style={[styles.text, { color: theme.text }]}>{currentToast.message}</Text>
      {currentToast.action && (
        <TouchableOpacity
          onPress={() => {
            currentToast.action?.onPress();
            dismiss();
          }}
          style={[styles.actionButton, { backgroundColor: accentColor + '20' }]}
        >
          <Text style={[styles.actionText, { color: accentColor }]}>
            {currentToast.action.label}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  text: {
    fontSize: 15,
    padding: 16,
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
