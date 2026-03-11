import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type TagColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray';
export type TagVariant = 'filled' | 'outlined' | 'subtle';

export interface TagProps extends ComponentProps {
  label: string;
  variant?: TagVariant;
  color?: TagColor;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  dot?: boolean;
}

const SIZE_MAP = {
  sm: { height: 20, font: 11, px: 6,  iconSize: 10, gap: 3 },
  md: { height: 24, font: 12, px: 8,  iconSize: 12, gap: 4 },
  lg: { height: 28, font: 14, px: 10, iconSize: 14, gap: 5 },
};

const COLOR_MAP: Record<TagColor, Record<number, string>> = {
  primary:   theme.colors.primary,
  secondary: theme.colors.secondary,
  success:   theme.colors.success,
  warning:   theme.colors.warning,
  error:     theme.colors.error,
  info:      theme.colors.info,
  gray:      theme.colors.gray,
};

export const Tag: React.FC<TagProps> = ({
  label,
  variant = 'subtle',
  color = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  dot = false,
  style,
}) => {
  const { height, font, px, gap } = SIZE_MAP[size];
  const colors = COLOR_MAP[color];
  const dotSize = Math.max(5, font - 2);

  const getContainerStyle = () => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: colors[500], borderColor: colors[500], borderWidth: 1 };
      case 'outlined':
        return { backgroundColor: 'transparent', borderColor: colors[500], borderWidth: 1 };
      case 'subtle':
        return { backgroundColor: colors[50], borderColor: 'transparent', borderWidth: 1 };
      default:
        return { backgroundColor: colors[50], borderColor: 'transparent', borderWidth: 1 };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'filled':   return theme.colors.white;
      case 'outlined': return colors[500];
      case 'subtle':   return colors[700];
      default:         return colors[700];
    }
  };

  const textColor = getTextColor();

  return (
    <View
      style={[
        styles.tag,
        getContainerStyle(),
        { height, paddingHorizontal: px, borderRadius: height / 2, gap },
        style,
      ]}
    >
      {dot && (
        <View
          style={[
            styles.dot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colors[500] },
          ]}
        />
      )}
      {leftIcon !== undefined && !dot && leftIcon}

      <RNText style={{ fontSize: font, color: textColor, fontWeight: '500' }} numberOfLines={1}>
        {label}
      </RNText>

      {rightIcon !== undefined && rightIcon}
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  dot: {},
});
