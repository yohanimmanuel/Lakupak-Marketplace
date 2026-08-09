import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LakuTheme } from '@/constants/Colors';
import { useTabBarScrollStore } from '@/stores/tabBarScrollStore';

const BAR_BG = LakuTheme.tabBar.background;
const ACTIVE_PILL = LakuTheme.tabBar.activePill;
const ACTIVE_COLOR = LakuTheme.tabBar.active;
const INACTIVE_COLOR = LakuTheme.tabBar.inactive;

/** Fixed oval size — shrinks only via the bar's shared scale, like Revolut. */
const INDICATOR_WIDTH = 72;
const INDICATOR_HEIGHT = 52;
const LABEL_SLOT = 14;
const BAR_PAD = 6;
const WRAPPER_INSET = 16;
const COLLAPSED_SCALE = 0.85;

/** Approximate bar height (pill + top pad) excluding safe-area inset. */
export const FLOATING_TAB_BAR_HEIGHT = 72;

/** Scroll content bottom padding so lists clear the floating tab bar + home indicator. */
export const FLOATING_TAB_BAR_CONTENT_INSET = 95;

const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
const MORPH = { duration: 200, easing: Easing.out(Easing.cubic) };

function isHiddenTab(
  routeName: string,
  options: BottomTabBarProps['descriptors'][string]['options'],
): boolean {
  if (routeName === 'index') return true;
  if ((options as { href?: string | null }).href === null) return true;
  if (options.tabBarButton === null) return true;
  const itemStyle = options.tabBarItemStyle as { display?: string } | undefined;
  if (itemStyle?.display === 'none') return true;
  return false;
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const labelsCollapsed = useTabBarScrollStore((s) => s.labelsCollapsed);
  const resetLabels = useTabBarScrollStore((s) => s.resetLabels);

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter((route) => !isHiddenTab(route.name, descriptors[route.key].options)),
    [state.routes, descriptors],
  );

  const focusedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === state.routes[state.index]?.key),
  );

  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const slotX = useSharedValue(0);
  const slotWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  /** 1 = expanded, 0 = collapsed. Drives labels + whole-bar scale only. */
  const expandProgress = useSharedValue(1);

  useEffect(() => {
    resetLabels();
  }, [state.index, resetLabels]);

  useEffect(() => {
    expandProgress.value = withTiming(labelsCollapsed ? 0 : 1, MORPH);
  }, [labelsCollapsed, expandProgress]);

  const onTabLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => {
      const next = prev.slice();
      next[index] = { x, width };
      return next;
    });
  };

  useEffect(() => {
    const layout = tabLayouts[focusedVisibleIndex];
    if (!layout) return;
    slotX.value = withTiming(layout.x, SLIDE);
    slotWidth.value = withTiming(layout.width, SLIDE);
    indicatorOpacity.value = withTiming(1, SLIDE);
  }, [focusedVisibleIndex, tabLayouts, slotX, slotWidth, indicatorOpacity]);

  const barStyle = useAnimatedStyle(() => {
    const scale = interpolate(expandProgress.value, [0, 1], [COLLAPSED_SCALE, 1]);
    return {
      transform: [{ scale }],
    };
  });

  const indicatorStyle = useAnimatedStyle(() => {
    const width =
      slotWidth.value > 0 && slotWidth.value < INDICATOR_WIDTH
        ? slotWidth.value
        : INDICATOR_WIDTH;
    const translateX = slotX.value + (slotWidth.value - width) / 2;
    return {
      opacity: indicatorOpacity.value,
      width,
      height: INDICATOR_HEIGHT,
      borderRadius: INDICATOR_HEIGHT / 2,
      transform: [{ translateX }],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: expandProgress.value,
    maxHeight: expandProgress.value * LABEL_SLOT,
    marginTop: expandProgress.value * 2,
    overflow: 'hidden' as const,
  }));

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <Animated.View style={[styles.bar, barStyle]}>
        <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = route.key === state.routes[state.index]?.key;
          const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;

          const icon = options.tabBarIcon?.({ focused, color, size: 20 });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              onLayout={(e) => onTabLayout(index, e)}
              style={styles.item}
            >
              <View style={styles.itemInner}>
                {icon}
                <Animated.Text style={[styles.label, { color }, labelStyle]} numberOfLines={1}>
                  {label}
                </Animated.Text>
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: WRAPPER_INSET,
    paddingTop: 8,
  },
  bar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LakuTheme.border,
    paddingVertical: BAR_PAD,
    paddingHorizontal: BAR_PAD,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  indicator: {
    position: 'absolute',
    top: BAR_PAD,
    left: 0,
    backgroundColor: ACTIVE_PILL,
    zIndex: 0,
  },
  item: {
    flex: 1,
    zIndex: 1,
  },
  itemInner: {
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
