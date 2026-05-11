/**
 * ThemeToggle
 *
 * Animated pill toggle that switches between light and dark mode.
 * Uses react-native-reanimated for the thumb slide and background
 * colour interpolation.
 *
 * Design language:
 *   Light mode → warm amber track, sun icon
 *   Dark  mode → deep indigo track, moon icon
 *
 * The toggle reads the current mode from ThemeModeContext (rAF-deferred)
 * and dispatches toggleMode() directly on the Zustand store — this is the
 * one approved place where a UI atom touches the store imperatively because
 * the toggle IS the control for that store.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Sun, Moon } from 'lucide-react-native';
import { useThemeMode } from '@/core/theme';
import { useThemeStore } from '@/store/theme.store';

// ── Dimensions (4-pt grid) ─────────────────────────────────────────────────
const TRACK_W    = 64;
const TRACK_H    = 32;
const THUMB_SIZE = 24;
const THUMB_PAD  = 4;                          // gap between thumb and track edge
const THUMB_ON   = TRACK_W - THUMB_SIZE - THUMB_PAD;
const THUMB_OFF  = THUMB_PAD;

// ── Colour tokens (independent of the app theme object so they remain
//    stable regardless of which theme is currently active) ──────────────────
const TRACK_LIGHT  = '#F5A623'; // brand amber — sun feel
const TRACK_DARK   = '#1E2B4A'; // deep navy-indigo — night feel
const THUMB_COLOR  = '#FFFFFF';
const ICON_LIGHT   = '#FFFFFF'; // icon on amber track
const ICON_DARK    = '#C7D2FE'; // indigo-100 — soft on dark track

// Spring config — snappy but not twitchy
const SPRING_CFG = { damping: 18, stiffness: 220 };

export interface ThemeToggleProps {
  /** Optional override size — defaults to the standard 64×32 track */
  compact?: boolean;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
  accessibilityLabel,
}) => {
  const mode       = useThemeMode();
  const isDark     = mode === 'dark';
  const toggleMode = useThemeStore((s) => s.toggleMode);

  // 0 = light, 1 = dark — animated via spring when mode changes
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isDark ? 1 : 0, SPRING_CFG);
  }, [isDark, progress]);

  // Thumb translateX derived from progress — no re-triggering inside useAnimatedStyle
  const thumbTranslateX = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [THUMB_OFF, THUMB_ON]),
  );

  // Thumb slides horizontally
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbTranslateX.value }],
  }));

  // Track background interpolates between amber and navy
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [TRACK_LIGHT, TRACK_DARK],
    ),
  }));

  // Icon opacity: sun visible in light, moon visible in dark
  // withTiming called in useEffect-equivalent pattern via progress changes
  const iconProgress = useSharedValue(isDark ? 1 : 0);
  useEffect(() => {
    iconProgress.value = withTiming(isDark ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.ease),
    });
  }, [isDark, iconProgress]);

  const sunOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconProgress.value, [0, 1], [1, 0]),
  }));
  const moonOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconProgress.value, [0, 1], [0, 1]),
  }));

  const scale = compact ? 0.8 : 1;
  const iconSize = compact ? 12 : 14;

  return (
    <Pressable
      onPress={toggleMode}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={
        accessibilityLabel ??
        (isDark ? 'Switch to light mode' : 'Switch to dark mode')
      }
      style={{ transform: [{ scale }] }}
    >
      {/* Track */}
      <Animated.View style={[styles.track, trackStyle]}>
        {/* Icons sit at fixed positions inside the track */}
        <View style={styles.iconLeft}>
          <Animated.View style={sunOpacityStyle}>
            <Sun size={iconSize} color={ICON_LIGHT} strokeWidth={2.5} />
          </Animated.View>
        </View>
        <View style={styles.iconRight}>
          <Animated.View style={moonOpacityStyle}>
            <Moon size={iconSize} color={ICON_DARK} strokeWidth={2.5} />
          </Animated.View>
        </View>

        {/* Sliding thumb */}
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width:        TRACK_W,
    height:       TRACK_H,
    borderRadius: TRACK_H / 2,
    // iOS shadow
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius:  4,
    // Android elevation
    elevation: 3,
    // Icons absolutely positioned inside track
    justifyContent: 'center',
  },
  iconLeft: {
    position:        'absolute',
    left:            THUMB_PAD + 2,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconRight: {
    position:        'absolute',
    right:           THUMB_PAD + 2,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    alignItems:      'center',
    justifyContent:  'center',
  },
  thumb: {
    position:     'absolute',
    top:          THUMB_PAD,
    left:         0,            // translateX drives the actual position
    width:        THUMB_SIZE,
    height:       THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: THUMB_COLOR,
    // Thumb shadow for depth
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius:  3,
    elevation: 2,
  },
});
