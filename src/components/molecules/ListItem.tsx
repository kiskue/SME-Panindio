import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export interface ListItemProps extends ComponentProps {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
  destructive?: boolean;
  divider?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING_MAP = {
  sm: theme.spacing.sm,
  md: theme.spacing.md,
  lg: theme.spacing.lg,
};

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  showChevron,
  onPress,
  onLongPress,
  disabled = false,
  badge,
  destructive = false,
  divider = false,
  padding = 'md',
  style,
}) => {
  const shouldShowChevron = showChevron ?? (onPress !== undefined);
  const pad = PADDING_MAP[padding];
  const titleColor = destructive ? 'error' : undefined;

  const content = (
    <View
      style={[
        styles.row,
        { paddingHorizontal: pad, paddingVertical: pad * 0.75 },
        divider && styles.divider,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leftIcon !== undefined && (
        <View style={styles.leftSlot}>{leftIcon}</View>
      )}

      <View style={styles.textGroup}>
        <Text
          variant="body"
          weight="medium"
          {...(titleColor !== undefined ? { color: titleColor } : {})}
        >
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text variant="body-sm" color="gray">
            {subtitle}
          </Text>
        )}
      </View>

      {badge !== undefined && (
        <View style={styles.badgeSlot}>{badge}</View>
      )}

      {rightIcon !== undefined
        ? <View style={styles.rightSlot}>{rightIcon}</View>
        : shouldShowChevron && (
          <View style={styles.rightSlot}>
            <ChevronRight size={18} color={theme.colors.gray[400]} />
          </View>
        )}
    </View>
  );

  if (onPress !== undefined || onLongPress !== undefined) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={({ pressed }) => pressed && !disabled ? styles.pressed : undefined}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  leftSlot: {
    marginRight: theme.spacing.md,
    width: 24,
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  badgeSlot: {
    marginLeft: theme.spacing.sm,
  },
  rightSlot: {
    marginLeft: theme.spacing.sm,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: theme.colors.gray[50] },
});
