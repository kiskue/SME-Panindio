/**
 * LoadingSpinner — modern animated dot-pulse loader.
 *
 * Three dots that scale and fade in sequence (wave effect), giving a much
 * more polished feel than a raw ActivityIndicator.
 *
 * Sizes:
 *   small  — 6px dots, gap 4
 *   large  — 10px dots, gap 6
 *
 * Modes:
 *   Default        — inline, sits in the normal flow
 *   fullScreen     — absolute fill, covers the parent (use inside a
 *                    position:relative container or at root)
 *   overlay        — floating card centred on a semi-transparent backdrop
 *
 * Colors default to the theme primary unless overridden.
 *
 * For a simple spinner fallback (e.g., inside a Button or small inline
 * context), pass `variant="ring"` to get a compact ActivityIndicator
 * instead of the dots — useful when space is very constrained.
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import { Text } from '../atoms/Text';

export interface LoadingSpinnerProps {
  size?:    'small' | 'large';
  color?:   string;
  text?:    string;
  fullScreen?: boolean;
  overlay?:    boolean;
  /** 'dots' (default) = animated dot wave. 'ring' = compact ActivityIndicator. */
  variant?: 'dots' | 'ring';
}

// ─── Dot component ─────────────────────────────────────────────────────────────

interface DotProps {
  color:    string;
  dotSize:  number;
  delay:    number;
}

const Dot: React.FC<DotProps> = ({ color, dotSize, delay }) => {
  const scale   = useSharedValue(0.6);
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 380, easing: Easing.out(Easing.ease) }),
          withTiming(0.60, { duration: 380, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1,    { duration: 380, easing: Easing.out(Easing.ease) }),
          withTiming(0.35, { duration: 380, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width:        dotSize,
          height:       dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size     = 'large',
  color,
  text,
  fullScreen = false,
  overlay    = false,
  variant    = 'dots',
}) => {
  const theme  = useAppTheme();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  const spinnerColor = color ?? theme.colors.primary[500];
  const dotSize      = size === 'small' ? 6 : 10;
  const dotGap       = size === 'small' ? 4 : 6;
  const STAGGER      = 160; // ms between each dot

  const overlayBg    = isDark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.88)';
  const cardBg       = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';

  const dots = variant === 'dots'
    ? (
        <View style={[dotsStyles.row, { gap: dotGap }]}>
          <Dot color={spinnerColor} dotSize={dotSize} delay={0} />
          <Dot color={spinnerColor} dotSize={dotSize} delay={STAGGER} />
          <Dot color={spinnerColor} dotSize={dotSize} delay={STAGGER * 2} />
        </View>
      )
    : (
        <ActivityIndicator
          size={size === 'small' ? 'small' : 'large'}
          color={spinnerColor}
        />
      );

  const content = (
    <View style={[
      dotsStyles.container,
      overlay && [dotsStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }],
    ]}>
      {dots}
      {text !== undefined && text.length > 0 && (
        <Text
          variant="body-sm"
          style={[dotsStyles.text, { color: isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[500] }]}
        >
          {text}
        </Text>
      )}
    </View>
  );

  if (fullScreen || overlay) {
    return (
      <View style={[
        dotsStyles.backdrop,
        { backgroundColor: overlay ? overlayBg : 'transparent' },
        fullScreen && !overlay && dotsStyles.fullScreen,
      ]}>
        {content}
      </View>
    );
  }

  return content;
};

const dotsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
  },
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.sm,
  },
  card: {
    paddingHorizontal: staticTheme.spacing.xl,
    paddingVertical:   staticTheme.spacing.lg,
    borderRadius:      staticTheme.borderRadius.xl,
    borderWidth:       1,
    minWidth:          120,
    ...staticTheme.shadows.lg,
  },
  text: {
    marginTop: 2,
  },
  backdrop: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         999,
  },
  fullScreen: {
    flex: 1,
  },
});
