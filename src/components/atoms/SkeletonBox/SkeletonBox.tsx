/**
 * SkeletonBox — reusable shimmer building block atom.
 *
 * Renders a rounded rectangle that pulses between two opacity values using
 * react-native-reanimated for a 60fps shimmer effect. The base color is
 * theme-aware: dark mode uses a mid-grey tile, light mode uses gray[200].
 *
 * All other skeleton components in the molecule layer are built by composing
 * SkeletonBox instances to mirror the shape of the real content they replace.
 *
 * Props:
 *   width       — number, string ('100%'), or undefined (defaults to '100%')
 *   height      — required number
 *   borderRadius — optional, defaults to 8
 *   style       — additional ViewStyle overrides
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore, selectThemeMode } from '@/store';
import type { ViewStyle, DimensionValue } from 'react-native';

export interface SkeletonBoxProps {
  width?:        DimensionValue;
  height:        number;
  borderRadius?: number;
  style?:        ViewStyle;
}

const PULSE_MIN   = 0.35;
const PULSE_MAX   = 0.85;
const PULSE_DUR   = 900; // ms per half-cycle

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width        = '100%',
  height,
  borderRadius = 8,
  style,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  const opacity = useSharedValue(PULSE_MIN);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(PULSE_MAX, { duration: PULSE_DUR, easing: Easing.inOut(Easing.ease) }),
        withTiming(PULSE_MIN, { duration: PULSE_DUR, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const baseColor = isDark ? '#2A3347' : '#E5E7EB';

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius, backgroundColor: baseColor },
        animStyle,
        style,
      ]}
    />
  );
};

// Spacer that keeps layout during skeleton render without any animation
export const SkeletonSpacer: React.FC<{ height: number }> = ({ height }) => (
  <View style={{ height }} />
);

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
