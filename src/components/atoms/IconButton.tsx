import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

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
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
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
    ...theme.shadows.sm,
  },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
});
