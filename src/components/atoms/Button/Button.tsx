import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ComponentProps } from '../../../types';
import { theme, useThemeMode, getElevation, getTheme } from '@/core/theme';

export interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /**
   * Semantic color tone. `brand` (default) keeps the existing navy styling;
   * `success` / `danger` recolor filled backgrounds AND outline/ghost text so
   * colored outline buttons (e.g. "Complete", "Cancel", "Reject") render
   * correctly without hand-rolling a Pressable. Does not apply to `secondary`.
   */
  tone?: 'brand' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const TONE_PALETTE = {
  brand:   theme.colors.primary,
  success: theme.colors.accent,
  danger:  theme.colors.error,
} as const;

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  tone = 'brand',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}) => {
  const palette = TONE_PALETTE[tone];
  const mode = useThemeMode();
  // Brand outline/ghost text must stay readable on dark surfaces, so use the
  // adaptive brand tint (navy in light — identical to before — bright blue in
  // dark). success/danger tones use their saturated [500], which already reads.
  const brandFg = getTheme(mode).colors.tintPrimary;
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: palette[500],
          borderColor: palette[500],
        };
      case 'secondary':
        return {
          backgroundColor: theme.colors.gray[500],
          borderColor: theme.colors.gray[500],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: tone === 'brand' ? brandFg : palette[500],
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: palette[500],
          borderColor: palette[500],
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.borderRadius.sm,
        };
      case 'md':
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
        };
      case 'lg':
        return {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
        };
      default:
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
        };
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.gray[300];
    if (variant === 'outline' || variant === 'ghost') return tone === 'brand' ? brandFg : palette[500];
    return theme.colors.white;
  };

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return theme.typography.sizes.sm;
      case 'md':
        return theme.typography.sizes.base;
      case 'lg':
        return theme.typography.sizes.lg;
      default:
        return theme.typography.sizes.base;
    }
  };

  // Elevation only on FILLED variants (transparent outline/ghost would render a
  // phantom Android shadow / inconsistent iOS shadow). getElevation() returns {}
  // in dark mode, where depth comes from surface + border instead.
  const isFilled = variant === 'primary' || variant === 'secondary';

  // Pressed feedback: filled buttons darken + scale in (and drop their shadow);
  // transparent buttons get a subtle tinted background.
  const getPressedStyle = (pressed: boolean) => {
    if (!pressed || disabled) return null;
    switch (variant) {
      case 'secondary':
        return { backgroundColor: theme.colors.gray[600], transform: [{ scale: 0.98 }] };
      case 'outline':
      case 'ghost':
        return { backgroundColor: palette[50] };
      case 'primary':
      default:
        return { backgroundColor: palette[600], transform: [{ scale: 0.98 }] };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const textColor = getTextColor();
  const textSize = getTextSize();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyles,
        sizeStyles,
        fullWidth && styles.fullWidth,
        // Shadow only when filled, enabled, and at rest — dropped on press for a
        // tactile "press-in", and absent on transparent variants entirely.
        isFilled && !disabled && !pressed && getElevation('sm', mode),
        getPressedStyle(pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'secondary' ? theme.colors.white : palette[500]} />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text style={[styles.text, { color: textColor, fontSize: textSize }]}>
            {title}
          </Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // No shadow here — elevation is applied conditionally per variant/mode/press
    // in the Pressable style (see getElevation above).
  },
  text: {
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
});