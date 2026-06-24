import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../../core/theme';
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

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.colors.surface,
          borderWidth: 0,
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

  const getShadowStyles = () => {
    switch (shadow) {
      case 'none':
        return {};
      case 'sm':
        return staticTheme.shadows.sm;
      case 'md':
        return staticTheme.shadows.md;
      case 'lg':
        return staticTheme.shadows.lg;
      case 'xl':
        return staticTheme.shadows.xl;
      default:
        return staticTheme.shadows.sm;
    }
  };

  const variantStyles = getVariantStyles();
  const paddingStyles = getPaddingStyles();
  const borderRadiusStyles = getBorderRadiusStyles();
  const shadowStyles = getShadowStyles();

  const cardContent = (
    <View
      style={[
        styles.card,
        variantStyles,
        paddingStyles,
        borderRadiusStyles,
        shadowStyles,
        style,
      ]}
      {...props}
    >
      {children}
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
  card: {
    overflow: 'hidden',
  },
});