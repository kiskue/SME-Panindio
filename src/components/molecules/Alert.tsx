import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps extends ComponentProps {
  title?: string;
  message: string;
  variant?: AlertVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: { label: string; onPress: () => void };
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

type ColorScale = Record<number, string>;

const VARIANT_CONFIG: Record<
  AlertVariant,
  { colors: ColorScale; defaultIcon: React.ReactElement }
> = {
  success: {
    colors: theme.colors.success,
    defaultIcon: <CheckCircle  size={18} color={theme.colors.success[600]} />,
  },
  error: {
    colors: theme.colors.error,
    defaultIcon: <XCircle      size={18} color={theme.colors.error[600]} />,
  },
  warning: {
    colors: theme.colors.warning,
    defaultIcon: <AlertTriangle size={18} color={theme.colors.warning[600]} />,
  },
  info: {
    colors: theme.colors.info,
    defaultIcon: <Info         size={18} color={theme.colors.info[600]} />,
  },
};

export const Alert: React.FC<AlertProps> = ({
  title,
  message,
  variant = 'info',
  dismissible = false,
  onDismiss,
  action,
  icon,
  size = 'md',
  style,
}) => {
  const config = VARIANT_CONFIG[variant];
  const displayIcon = icon ?? config.defaultIcon;
  const isCompact = size === 'sm' || title === undefined;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.colors[50],
          borderColor: config.colors[200],
          borderLeftColor: config.colors[500],
        },
        style,
      ]}
    >
      {isCompact ? (
        // Compact row layout
        <View style={styles.compactRow}>
          <View style={styles.iconSlot}>{displayIcon}</View>
          <Text variant="body-sm" style={[styles.flex, { color: config.colors[800] }]}>
            {message}
          </Text>
          {action !== undefined && (
            <Pressable onPress={action.onPress}>
              <Text variant="body-sm" weight="semibold" style={{ color: config.colors[700] }}>
                {action.label}
              </Text>
            </Pressable>
          )}
          {dismissible && (
            <Pressable onPress={onDismiss} hitSlop={8}>
              <X size={16} color={config.colors[500]} />
            </Pressable>
          )}
        </View>
      ) : (
        // Block layout with title
        <View style={styles.block}>
          <View style={styles.headerRow}>
            <View style={styles.iconSlot}>{displayIcon}</View>
            <Text variant="body" weight="semibold" style={[styles.flex, { color: config.colors[800] }]}>
              {title}
            </Text>
            {dismissible && (
              <Pressable onPress={onDismiss} hitSlop={8}>
                <X size={16} color={config.colors[500]} />
              </Pressable>
            )}
          </View>
          <Text variant="body-sm" style={{ color: config.colors[700], marginTop: 4 }}>
            {message}
          </Text>
          {action !== undefined && (
            <Pressable onPress={action.onPress} style={styles.actionBtn}>
              <Text variant="body-sm" weight="semibold" style={{ color: config.colors[700] }}>
                {action.label}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
    padding: theme.spacing.sm,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  block: { gap: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconSlot: { flexShrink: 0 },
  flex: { flex: 1 },
  actionBtn: { marginTop: theme.spacing.sm },
});
