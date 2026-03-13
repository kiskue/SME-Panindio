import React from 'react';
import { Pressable, Text as RNText, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type ChipColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'gray';

export interface ChipProps extends ComponentProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  variant?: 'filled' | 'outlined' | 'ghost';
  color?: ChipColor;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  avatar?: React.ReactNode;
}

const SIZE_MAP = {
  sm: { height: 24, font: 12, px: 8,  iconSize: 12, gap: 4 },
  md: { height: 32, font: 14, px: 12, iconSize: 16, gap: 6 },
  lg: { height: 40, font: 16, px: 16, iconSize: 18, gap: 8 },
};

const COLOR_MAP: Record<ChipColor, Record<number, string>> = {
  primary:   theme.colors.primary,
  secondary: theme.colors.secondary,
  success:   theme.colors.success,
  warning:   theme.colors.warning,
  error:     theme.colors.error,
  gray:      theme.colors.gray,
};

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  onRemove,
  variant = 'filled',
  color = 'primary',
  size = 'md',
  disabled = false,
  leftIcon,
  avatar,
  style,
}) => {
  const { height, font, px, iconSize, gap } = SIZE_MAP[size];
  const colors = COLOR_MAP[color];

  const getContainerStyle = () => {
    switch (variant) {
      case 'filled':
        return selected
          ? { backgroundColor: colors[500], borderColor: colors[500] }
          : { backgroundColor: colors[100], borderColor: colors[100] };
      case 'outlined':
        return selected
          ? { backgroundColor: colors[500], borderColor: colors[500] }
          : { backgroundColor: 'transparent', borderColor: colors[500] };
      case 'ghost':
        return selected
          ? { backgroundColor: colors[100], borderColor: 'transparent' }
          : { backgroundColor: 'transparent', borderColor: 'transparent' };
      default:
        return { backgroundColor: colors[100], borderColor: colors[100] };
    }
  };

  const getTextColor = (): string => {
    if (variant === 'filled' && selected) return theme.colors.white;
    if (variant === 'outlined' && selected) return theme.colors.white;
    // `colors[700]` may be undefined under noUncheckedIndexedAccess; fall back to a neutral dark tone.
    return colors[700] ?? '#374151';
  };

  const textColor = getTextColor();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.chip,
        getContainerStyle(),
        { height, paddingHorizontal: px, borderRadius: height / 2, gap },
        disabled && styles.disabled,
        pressed && onPress && !disabled && styles.pressed,
        style,
      ]}
    >
      {avatar !== undefined && avatar}
      {leftIcon !== undefined && !avatar && leftIcon}

      <RNText style={{ fontSize: font, color: textColor, fontWeight: '500' }} numberOfLines={1}>
        {label}
      </RNText>

      {onRemove !== undefined && (
        <Pressable onPress={onRemove} disabled={disabled} hitSlop={4}>
          <X size={iconSize} color={textColor} />
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
