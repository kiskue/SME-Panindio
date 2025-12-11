import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { ComponentProps } from '../../../types';

interface TextProps extends ComponentProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'body-sm' | 'body-xs' | 'caption';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  color?: keyof typeof theme.colors;
  align?: 'left' | 'center' | 'right' | 'justify';
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight = 'normal',
  color = 'gray',
  align = 'left',
  numberOfLines,
  ellipsizeMode,
  children,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'h1':
        return {
          fontSize: theme.typography.sizes['4xl'],
          lineHeight: theme.typography.lineHeights.tight,
        };
      case 'h2':
        return {
          fontSize: theme.typography.sizes['3xl'],
          lineHeight: theme.typography.lineHeights.tight,
        };
      case 'h3':
        return {
          fontSize: theme.typography.sizes['2xl'],
          lineHeight: theme.typography.lineHeights.tight,
        };
      case 'h4':
        return {
          fontSize: theme.typography.sizes.xl,
          lineHeight: theme.typography.lineHeights.tight,
        };
      case 'h5':
        return {
          fontSize: theme.typography.sizes.lg,
          lineHeight: theme.typography.lineHeights.normal,
        };
      case 'h6':
        return {
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.lineHeights.normal,
        };
      case 'body':
        return {
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.lineHeights.normal,
        };
      case 'body-sm':
        return {
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.lineHeights.normal,
        };
      case 'body-xs':
        return {
          fontSize: theme.typography.sizes.xs,
          lineHeight: theme.typography.lineHeights.normal,
        };
      case 'caption':
        return {
          fontSize: theme.typography.sizes.xs,
          lineHeight: theme.typography.lineHeights.tight,
        };
      default:
        return {
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.lineHeights.normal,
        };
    }
  };

  const getWeightStyle = () => {
    switch (weight) {
      case 'light':
        return theme.typography.weights.light;
      case 'normal':
        return theme.typography.weights.normal;
      case 'medium':
        return theme.typography.weights.medium;
      case 'semibold':
        return theme.typography.weights.semibold;
      case 'bold':
        return theme.typography.weights.bold;
      default:
        return theme.typography.weights.normal;
    }
  };

  const getColorStyle = () => {
    const colorValue = theme.colors[color];
    if (typeof colorValue === 'string') {
      return colorValue;
    }
    return colorValue[500] || theme.colors.gray[500];
  };

  const variantStyles = getVariantStyles();
  const fontWeight = getWeightStyle();
  const textColor = getColorStyle();

  return (
    <RNText
      style={[
        styles.text,
        {
          fontSize: variantStyles.fontSize,
          lineHeight: variantStyles.lineHeight,
          fontWeight: fontWeight,
          color: textColor,
          textAlign: align,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: theme.typography.fontFamily,
  },
});