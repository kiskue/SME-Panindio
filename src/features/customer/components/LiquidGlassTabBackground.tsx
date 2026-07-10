import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useAppTheme, useThemeMode } from '@/core/theme';

export interface LiquidGlassTabBackgroundProps {
  /**
   * Blur intensity used for the iOS `BlurView` fallback (older iOS, pre-26).
   * Ignored on true Liquid Glass (iOS 26) and on Android.
   * @default 40
   */
  blurIntensity?: number;
}

/**
 * Background layer for the customer bottom tab bar.
 *
 * Rendered into expo-router's `tabBarBackground` slot so the tab icons/labels
 * sit on top of it. The visual treatment is chosen at runtime, in priority order:
 *
 *  1. iOS 26 (`isLiquidGlassAvailable()`) → native Liquid Glass via `GlassView`.
 *  2. Older iOS                            → frosted `BlurView`.
 *  3. Android                              → solid/translucent `surface` view
 *     with a hairline top border (Android blur is unreliable).
 *
 * All native module access is guarded, so the component degrades gracefully (to
 * the Android-style solid surface) if the native module is unavailable — e.g.
 * a plain Expo Go JS reload — instead of crashing. The glass only renders for
 * real in a dev/production build.
 */
 
export const LiquidGlassTabBackground: React.FC<LiquidGlassTabBackgroundProps> = ({
  blurIntensity = 40,
}) => {
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  // The hairline top border is shared by every variant so the bar always reads
  // as a distinct surface against scrolling content beneath it.
  const topBorder = (
    <View
      pointerEvents="none"
      style={[styles.topBorder, { backgroundColor: theme.colors.border }]}
    />
  );

  // 1. True Liquid Glass (iOS 26+). `colorScheme` is driven by the app's theme
  //    toggle so glass matches even when it differs from the system appearance.
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
        />
        {topBorder}
      </View>
    );
  }

  // 2. Frosted blur fallback for older iOS.
  if (Platform.OS === 'ios') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {topBorder}
      </View>
    );
  }

  // 3. Android (and any non-iOS / unavailable native module): solid translucent
  //    surface. Android blur is unreliable, so we keep it crisp and performant.
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      {topBorder}
    </View>
  );
};

const styles = StyleSheet.create({
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
