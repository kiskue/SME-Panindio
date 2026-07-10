import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ComponentProps } from '@/types';
import { theme, useThemeMode, getElevation } from '../../core/theme';

export interface IconButtonProps extends ComponentProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  shape?: 'circle' | 'square';
  accessibilityLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  shape = 'circle',
  accessibilityLabel,
  style,
}) => {
  const getDimension = () => {
    switch (size) {
      case 'sm': return 32;
      case 'lg': return 56;
      default: return 44;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.colors.primary[500], borderColor: theme.colors.primary[500] };
      case 'secondary':
        return { backgroundColor: theme.colors.gray[500], borderColor: theme.colors.gray[500] };
      case 'outline':
        return { backgroundColor: 'transparent', borderColor: theme.colors.primary[500] };
      case 'ghost':
        return { backgroundColor: 'transparent', borderColor: 'transparent' };
      default:
        return { backgroundColor: theme.colors.primary[500], borderColor: theme.colors.primary[500] };
    }
  };

  const getSpinnerColor = () =>
    variant === 'primary' || variant === 'secondary'
      ? theme.colors.white
      : theme.colors.primary[500];

  const dimension = getDimension();
  const borderRadius = shape === 'circle' ? theme.borderRadius.full : theme.borderRadius.md;

  // Elevation only on FILLED variants (transparent ones would cast a phantom
  // Android shadow / inconsistent iOS shadow). {} in dark mode.
  const mode = useThemeMode();
  const isFilled = variant === 'primary' || variant === 'secondary';

  const getPressedStyle = (pressed: boolean) => {
    if (!pressed || disabled) return null;
    switch (variant) {
      case 'secondary':
        return { backgroundColor: theme.colors.gray[600], transform: [{ scale: 0.96 }] };
      case 'outline':
      case 'ghost':
        return { backgroundColor: theme.colors.primary[50] };
      case 'primary':
      default:
        return { backgroundColor: theme.colors.primary[600], transform: [{ scale: 0.96 }] };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        getVariantStyles(),
        { width: dimension, height: dimension, borderRadius },
        // Shadow only when filled, enabled, at rest — dropped on press; never on
        // transparent variants.
        isFilled && !disabled && !pressed && getElevation('sm', mode),
        getPressedStyle(pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator size="small" color={getSpinnerColor()} />
        : icon}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // Elevation applied conditionally per variant/mode/press (see getElevation).
  },
  disabled: { opacity: 0.6 },
});
