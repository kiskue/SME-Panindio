import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../../core/theme';
import { ComponentProps } from '../../../types';

interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary[500],
          borderColor: theme.colors.primary[500],
        };
      case 'secondary':
        return {
          backgroundColor: theme.colors.gray[500],
          borderColor: theme.colors.gray[500],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: theme.colors.primary[500],
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        };
      default:
        return {
          backgroundColor: theme.colors.primary[500],
          borderColor: theme.colors.primary[500],
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
    if (variant === 'outline' || variant === 'ghost') return theme.colors.primary[500];
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

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const textColor = getTextColor();
  const textSize = getTextSize();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        variantStyles,
        sizeStyles,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'secondary' ? theme.colors.white : theme.colors.primary[500]} />
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
    ...theme.shadows.sm,
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