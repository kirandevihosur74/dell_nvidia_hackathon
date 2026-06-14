import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeStore } from '@/stores/themeStore';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export interface ScrollableTabBarProps extends BottomTabBarProps {
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  itemStyle?: StyleProp<ViewStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  onTabLongPress?: (route: string) => void;
}

export default function ScrollableTabBar({
  state,
  descriptors,
  navigation,
  style,
  labelStyle,
  itemStyle,
  iconStyle,
  onTabLongPress,
}: ScrollableTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const [showRightIndicator, setShowRightIndicator] = useState(true);
  const [showLeftIndicator, setShowLeftIndicator] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const contentWidthRef = useRef(0);
  const scrollViewWidthRef = useRef(0);

  useEffect(() => {
    contentWidthRef.current = contentWidth;
    scrollViewWidthRef.current = scrollViewWidth;
  }, [contentWidth, scrollViewWidth]);

  const updateIndicators = useCallback(() => {
    if (contentWidthRef.current <= 0 || scrollViewWidthRef.current <= 0) return;

    const shouldShowRight =
      contentWidthRef.current > scrollViewWidthRef.current &&
      scrollPosition < contentWidthRef.current - scrollViewWidthRef.current - 5;
    const shouldShowLeft = scrollPosition > 10;

    if (shouldShowRight !== showRightIndicator) {
      setShowRightIndicator(shouldShowRight);
    }
    if (shouldShowLeft !== showLeftIndicator) {
      setShowLeftIndicator(shouldShowLeft);
    }
  }, [scrollPosition, showLeftIndicator, showRightIndicator]);

  useEffect(() => {
    updateIndicators();
  }, [updateIndicators]);

  // Auto-scroll to keep active tab visible
  useEffect(() => {
    if (scrollViewRef.current && state.index > 0 && contentWidth > 0 && scrollViewWidth > 0) {
      const tabWidth = 80 + 30; // minWidth + paddingHorizontal
      const estimatedPosition = state.index * tabWidth;

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: Math.max(0, estimatedPosition - tabWidth),
          animated: true,
        });
      }, 100);
    }
  }, [state.index]);

  const handleScroll = useCallback((event: any) => {
    setScrollPosition(event.nativeEvent.contentOffset.x);
  }, []);

  const handleScrollViewLayout = useCallback(
    (event: any) => {
      const width = event.nativeEvent.layout.width;
      if (width !== scrollViewWidth) setScrollViewWidth(width);
    },
    [scrollViewWidth],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      if (width !== contentWidth) setContentWidth(width);
    },
    [contentWidth],
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderTopColor: theme.border },
        style,
      ]}
    >
      {/* Left scroll indicator */}
      {showLeftIndicator && (
        <View style={styles.leftIndicatorContainer} pointerEvents="none">
          <LinearGradient
            colors={[theme.card, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.leftGradient}
          >
            <ChevronRight size={20} color={theme.textTertiary} style={styles.leftChevron} />
          </LinearGradient>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingRight: showRightIndicator ? 40 : 10 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onLayout={handleScrollViewLayout}
        onContentSizeChange={handleContentSizeChange}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // Respect hidden tabs (e.g. expo-router `href: null`, which sets
          // tabBarItemStyle.display === 'none' and tabBarButton === null).
          const isHidden =
            options.tabBarButton === null ||
            (StyleSheet.flatten(options.tabBarItemStyle) as ViewStyle | undefined)?.display ===
              'none';
          if (isHidden) return null;
          const label = options.title || route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              .then(() => {
                if (onTabLongPress) {
                  onTabLongPress(route.name);
                } else {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }
              })
              .catch(() => {
                if (onTabLongPress) {
                  onTabLongPress(route.name);
                } else {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }
              });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tabItem, itemStyle]}
            >
              <View style={[styles.iconContainer, iconStyle]}>
                {options.tabBarIcon &&
                  options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? theme.primary : theme.textTertiary,
                    size: 22,
                  })}
              </View>
              <Text
                style={[
                  styles.label,
                  labelStyle,
                  {
                    color: isFocused ? theme.primary : theme.textTertiary,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Right scroll indicator */}
      {showRightIndicator && (
        <View style={styles.rightIndicatorContainer} pointerEvents="none">
          <LinearGradient
            colors={['transparent', theme.card]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rightGradient}
          >
            <ChevronRight size={20} color={theme.textTertiary} />
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tabItem: {
    minWidth: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    flexDirection: 'column',
  },
  iconContainer: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 4,
  },
  leftIndicatorContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    zIndex: 10,
    width: 40,
    justifyContent: 'center',
  },
  rightIndicatorContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    zIndex: 10,
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  leftGradient: {
    width: 40,
    height: '100%',
    justifyContent: 'center',
  },
  rightGradient: {
    width: 40,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  leftChevron: {
    transform: [{ rotate: '180deg' }],
    marginLeft: 5,
  },
});
