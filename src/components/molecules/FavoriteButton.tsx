import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '@/core/theme';

export interface FavoriteButtonProps {
  /** Whether the target is currently favorited (drives fill + a11y selected). */
  isFavorite: boolean;
  /** Fired on tap. The caller flips the favorite state (optimistic). */
  onToggle: () => void;
  /** Visual size. `sm` (28) suits the 96px horizontal thumbnail; `md` (32) the grid image. @default 'md' */
  size?: 'sm' | 'md';
  /** Required for screen readers, e.g. "Add {product} to favorites". */
  accessibilityLabel: string;
  /** Fire a light haptic on toggle. @default true */
  enableHaptics?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: { button: 28, icon: 16 },
  md: { button: 32, icon: 18 },
} as const;

/** Fixed dark scrim so a white heart stays legible over ANY product photo, in
 *  both light and dark themes. Deliberately theme-independent. */
const SCRIM = 'rgba(15,23,42,0.38)';
/** Pad the visual target to a >=44x44 touch target (WCAG 2.5.8). */
const HIT_SLOP = 8;

/**
 * FavoriteButton
 * ==============
 * A circular heart toggle designed to sit as an overlay on a product image.
 *
 * It is a purpose-built molecule (not an `IconButton`) because it needs three
 * things `IconButton` can't express: an icon that FILLS on the active state, a
 * spring "pop" on toggle, and `accessibilityState.selected` semantics. It stays
 * presentational — it renders `isFavorite` and calls `onToggle`; the owning
 * screen holds the state — so it is reusable anywhere favorites appear (home,
 * browse, future product-detail / cart).
 */
export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  size = 'md',
  accessibilityLabel,
  enableHaptics = true,
  style,
}) => {
  const dims = SIZES[size];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    const nextFavorite = !isFavorite;
    // Celebratory pop when favoriting; a smaller dip when un-favoriting.
    scale.value = withSequence(
      withSpring(nextFavorite ? 1.25 : 0.9, { damping: 12, stiffness: 320 }),
      withSpring(1, { damping: 14, stiffness: 260 }),
    );
    if (enableHaptics) {
      try {
        if (nextFavorite) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else void Haptics.selectionAsync();
      } catch {
        // Haptics are best-effort (no-op on web / simulator) — never block the toggle.
      }
    }
    onToggle();
  }, [isFavorite, enableHaptics, onToggle, scale]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isFavorite }}
      style={[
        styles.button,
        {
          width: dims.button,
          height: dims.button,
          borderRadius: dims.button / 2,
          backgroundColor: SCRIM,
        },
        style,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <Heart
          size={dims.icon}
          color={isFavorite ? theme.colors.error[500] : '#FFFFFF'}
          fill={isFavorite ? theme.colors.error[500] : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
});
