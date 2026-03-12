import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { ComponentProps } from '@/types';
import { useAppTheme } from '../../core/theme';
import { theme as staticTheme } from '../../core/theme';

export interface EmptyStateProps extends ComponentProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

const SIZE_MAP = {
  sm: { iconSize: 40, titleVariant: 'body',  descVariant: 'body-sm' as const },
  md: { iconSize: 56, titleVariant: 'h4',    descVariant: 'body'    as const },
  lg: { iconSize: 72, titleVariant: 'h3',    descVariant: 'body'    as const },
} as const;

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  secondaryAction,
  size = 'md',
  compact = false,
  style,
}) => {
  const theme = useAppTheme();
  const { iconSize, titleVariant, descVariant } = SIZE_MAP[size];

  const iconWrapStyle = useMemo(() => ({
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: staticTheme.spacing.md,
  }), [iconSize, theme]);

  const iconEl = icon !== undefined ? (
    <View style={iconWrapStyle}>
      {icon}
    </View>
  ) : null;

  if (compact) {
    return (
      <View style={[styles.compactRow, style]}>
        {iconEl}
        <View style={styles.compactText}>
          <Text variant={titleVariant} weight="semibold">{title}</Text>
          {description !== undefined && (
            <Text variant={descVariant} color="gray">{description}</Text>
          )}
        </View>
        {action !== undefined && (
          <Button
            title={action.label}
            onPress={action.onPress}
            variant={action.variant ?? 'primary'}
            size="sm"
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.center, style]}>
      {iconEl}
      <Text variant={titleVariant} weight="semibold" align="center" style={styles.title}>
        {title}
      </Text>
      {description !== undefined && (
        <Text variant={descVariant} color="gray" align="center" style={styles.description}>
          {description}
        </Text>
      )}
      {action !== undefined && (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'primary'}
          size="md"
          style={styles.actionBtn}
        />
      )}
      {secondaryAction !== undefined && (
        <Button
          title={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="ghost"
          size="md"
          style={styles.secondaryBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingHorizontal: staticTheme.spacing.xl,
    paddingVertical: staticTheme.spacing.xl,
  },
  title: {
    marginBottom: staticTheme.spacing.xs,
  },
  description: {
    marginBottom: staticTheme.spacing.md,
  },
  actionBtn: {
    minWidth: 160,
  },
  secondaryBtn: {
    marginTop: staticTheme.spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.md,
    padding: staticTheme.spacing.md,
  },
  compactText: {
    flex: 1,
    gap: 2,
  },
});
