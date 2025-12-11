import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { theme } from '../../core/theme';
import { ComponentProps, CardProps } from '../../../types';

interface CustomCardProps extends ComponentProps, Omit<CardProps, 'children'> {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
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
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.colors.white,
          borderWidth: 0,
        };
      case 'outlined':
        return {
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.gray[200],
          borderWidth: 1,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.gray[50],
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: theme.colors.white,
          borderWidth: 0,
        };
    }
  };

  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'sm':
        return { padding: theme.spacing.sm };
      case 'md':
        return { padding: theme.spacing.md };
      case 'lg':
        return { padding: theme.spacing.lg };
      default:
        return { padding: theme.spacing.md };
    }
  };

  const getBorderRadiusStyles = () => {
    switch (borderRadius) {
      case 'none':
        return { borderRadius: 0 };
      case 'sm':
        return { borderRadius: theme.borderRadius.sm };
      case 'md':
        return { borderRadius: theme.borderRadius.md };
      case 'lg':
        return { borderRadius: theme.borderRadius.lg };
      case 'xl':
        return { borderRadius: theme.borderRadius.xl };
      case 'full':
        return { borderRadius: theme.borderRadius.full };
      default:
        return { borderRadius: theme.borderRadius.md };
    }
  };

  const getShadowStyles = () => {
    switch (shadow) {
      case 'none':
        return {};
      case 'sm':
        return theme.shadows.sm;
      case 'md':
        return theme.shadows.md;
      case 'lg':
        return theme.shadows.lg;
      case 'xl':
        return theme.shadows.xl;
      default:
        return theme.shadows.sm;
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