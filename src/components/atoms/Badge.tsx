import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'gray';

export interface BadgeProps extends ComponentProps {
  label?: string;
  count?: number;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  outline?: boolean;
}

const variantColorMap: Record<BadgeVariant, Record<number, string>> = {
  primary: theme.colors.primary,
  secondary: theme.colors.secondary,
  success: theme.colors.success,
  warning: theme.colors.warning,
  error: theme.colors.error,
  info: theme.colors.info,
  gray: theme.colors.gray,
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  count,
  variant = 'primary',
  size = 'md',
  dot = false,
  outline = false,
  style,
}) => {
  const colors = variantColorMap[variant];

  const getSizeStyles = () => {
    if (dot) return { height: 8, width: 8, borderRadius: 4, paddingHorizontal: 0 };
    switch (size) {
      case 'sm': return { height: 16, paddingHorizontal: 4, borderRadius: 8 };
      case 'lg': return { height: 24, paddingHorizontal: 8, borderRadius: 12 };
      default:   return { height: 20, paddingHorizontal: 6, borderRadius: 10 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return 10;
      case 'lg': return 14;
      default:   return 12;
    }
  };

  const displayText = (() => {
    if (dot) return null;
    if (count !== undefined) return count > 99 ? '99+' : String(count);
    return label ?? '';
  })();

  const textColor = outline ? colors[500] : theme.colors.white;
  const fontSize = getFontSize();

  return (
    <View
      style={[
        styles.badge,
        getSizeStyles(),
        outline
          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors[500] }
          : { backgroundColor: colors[500] },
        style,
      ]}
    >
      {displayText !== null && displayText !== '' && (
        <RNText
          numberOfLines={1}
          style={{ fontSize, color: textColor, fontWeight: '600', lineHeight: fontSize * 1.2 }}
        >
          {displayText}
        </RNText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
