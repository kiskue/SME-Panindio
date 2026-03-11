import React from 'react';
import { Text as RNText, StyleSheet, TextProps as RNTextProps } from 'react-native';
import { theme } from '../../core/theme';

export interface TextProps extends Omit<RNTextProps, 'children'> {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'body-sm' | 'body-xs' | 'caption';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  color?: keyof typeof theme.colors;
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight = 'normal',
  color = 'gray',
  align = 'left',
  children,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    const lh = theme.typography.lineHeights;
    switch (variant) {
      case 'h1': {
        const fs = theme.typography.sizes['4xl'];
        return { fontSize: fs, lineHeight: fs * lh.tight };
      }
      case 'h2': {
        const fs = theme.typography.sizes['3xl'];
        return { fontSize: fs, lineHeight: fs * lh.tight };
      }
      case 'h3': {
        const fs = theme.typography.sizes['2xl'];
        return { fontSize: fs, lineHeight: fs * lh.tight };
      }
      case 'h4': {
        const fs = theme.typography.sizes.xl;
        return { fontSize: fs, lineHeight: fs * lh.tight };
      }
      case 'h5': {
        const fs = theme.typography.sizes.lg;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
      case 'h6': {
        const fs = theme.typography.sizes.base;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
      case 'body': {
        const fs = theme.typography.sizes.base;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
      case 'body-sm': {
        const fs = theme.typography.sizes.sm;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
      case 'body-xs': {
        const fs = theme.typography.sizes.xs;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
      case 'caption': {
        const fs = theme.typography.sizes.xs;
        return { fontSize: fs, lineHeight: fs * lh.tight };
      }
      default: {
        const fs = theme.typography.sizes.base;
        return { fontSize: fs, lineHeight: fs * lh.normal };
      }
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

  const getColorStyle = (): string => {
    const colorValue = theme.colors[color];
    if (typeof colorValue === 'string') {
      return colorValue;
    }
    const palette = colorValue as Record<number, string>;
    return palette[500] ?? theme.colors.gray[500];
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