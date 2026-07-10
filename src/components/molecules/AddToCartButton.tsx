import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Plus, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme, useThemeMode, getElevation } from '@/core/theme';

export interface AddToCartButtonProps {
  /**
   * Perform the add. Return `true` (or `Promise<true>`) on a SUCCESSFUL add to
   * trigger the "added" confirmation; `false` shows nothing (a guard blocked it).
   * `undefined`/void is treated as success so plain `() => void` callers still work.
   */
  onAdd: () => boolean | Promise<boolean> | void;
  disabled?: boolean;
  /** e.g. "Add {product} to cart". */
  accessibilityLabel: string;
  /** Announced to screen readers on a successful add, e.g. "{product} added to cart". */
  addedAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZE = 44; // meets WCAG 2.5.8 target size without hitSlop
const ICON = 20;
const ADDED_MS = 900;

/**
 * AddToCartButton
 * ===============
 * A circular, filled "+" add-to-cart control for product cards. On a successful
 * add it morphs Plus→Check and flashes brand green for ~900ms — the inline "it's
 * in your cart" confirmation.
 *
 * It is its own molecule (not `IconButton`) for the same reason `FavoriteButton`
 * is: the icon MORPH + spring pop + confirmation state can't be expressed by a
 * static-icon button. It stays presentational — it calls `onAdd` and reflects the
 * result — so it is reusable across home, browse and cart.
 */
export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  onAdd,
  disabled = false,
  accessibilityLabel,
  addedAccessibilityLabel,
  style,
}) => {
  const mode = useThemeMode();
  const reducedMotion = useReducedMotion();
  const [added, setAdded] = useState(false);
  const scale = useSharedValue(1);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const showAdded = useCallback(() => {
    setAdded(true);
    if (addedAccessibilityLabel) {
      try {
        AccessibilityInfo.announceForAccessibility(addedAccessibilityLabel);
      } catch {
        // announcement is best-effort
      }
    }
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setAdded(false), ADDED_MS);
  }, [addedAccessibilityLabel]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (!reducedMotion) {
      scale.value = withSequence(
        withSpring(0.9, { damping: 12, stiffness: 320 }),
        withSpring(1, { damping: 14, stiffness: 260 }),
      );
    }
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // haptics unavailable (web/simulator) — non-fatal
    }
    const result = onAdd();
    if (result instanceof Promise) {
      void result.then((ok) => { if (ok) showAdded(); }).catch(() => {});
    } else if (result === undefined || result === true) {
      showAdded();
    }
  }, [disabled, reducedMotion, scale, onAdd, showAdded]);

  const backgroundColor = disabled
    ? mode === 'dark'
      ? theme.colors.gray[700]
      : theme.colors.gray[300]
    : added
      ? theme.colors.accent[500]
      : theme.colors.primary[500];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={added && addedAccessibilityLabel ? addedAccessibilityLabel : accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        { backgroundColor },
        // Resting elevation only when interactive (filled); {} in dark mode.
        !disabled && getElevation('sm', mode),
        style,
      ]}
    >
      <Animated.View style={animatedStyle}>
        {added ? (
          <Check size={ICON} color="#FFFFFF" strokeWidth={2.5} />
        ) : (
          <Plus size={ICON} color={disabled ? theme.colors.gray[500] : '#FFFFFF'} strokeWidth={2.5} />
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
