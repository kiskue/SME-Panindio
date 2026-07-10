import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme, useThemeMode, getElevation } from '../../core/theme';
import { theme as staticTheme } from '../../core/theme';
import { ComponentProps } from '@/types';

export interface CustomCardProps extends ComponentProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}


export const Card: React.FC<CustomCardProps> = ({
  children,
  onPress,
  variant = 'default',
  padding = 'md',
  borderRadius = 'md',
  shadow = 'sm',
  style,
  ...props
}) => {
  const theme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        // Dark conveys elevation via a lighter surface + hairline border (no
        // shadow); light uses the plain surface + the shadow below.
        return {
          backgroundColor: isDark ? theme.colors.surfaceElevated : theme.colors.surface,
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.borderSubtle,
        };
      case 'outlined':
        return {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.background,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: theme.colors.surface,
          borderWidth: 0,
        };
    }
  };

  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: staticTheme.spacing.sm };
      case 'md':
        return { padding: staticTheme.spacing.md };
      case 'lg':
        return { padding: staticTheme.spacing.lg };
      case 'xl':
        return { padding: staticTheme.spacing.xl };
      default:
        return { padding: staticTheme.spacing.md };
    }
  };

  const getBorderRadiusStyles = () => {
    switch (borderRadius) {
      case 'none':
        return { borderRadius: 0 };
      case 'sm':
        return { borderRadius: staticTheme.borderRadius.sm };
      case 'md':
        return { borderRadius: staticTheme.borderRadius.md };
      case 'lg':
        return { borderRadius: staticTheme.borderRadius.lg };
      case 'xl':
        return { borderRadius: staticTheme.borderRadius.xl };
      case 'full':
        return { borderRadius: staticTheme.borderRadius.full };
      default:
        return { borderRadius: staticTheme.borderRadius.md };
    }
  };

  const variantStyles = getVariantStyles();
  const paddingStyles = getPaddingStyles();
  const borderRadiusStyles = getBorderRadiusStyles();
  // Mode-aware elevation ({} in dark). `shadow` is an ElevationLevel.
  const elevationStyle = getElevation(shadow, mode);

  // Wrapper pattern: shadow on the OUTER view (no overflow); the rounded clip +
  // padding on the INNER view. Sharing one node would let iOS `overflow:'hidden'`
  // clip the shadow away (the reason cards looked flat on iOS).
  const cardContent = (
    <View
      style={[styles.outer, variantStyles, borderRadiusStyles, elevationStyle, style]}
      {...props}
    >
      <View style={[styles.inner, borderRadiusStyles, paddingStyles]}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  outer: {},
  inner: { overflow: 'hidden' },
});