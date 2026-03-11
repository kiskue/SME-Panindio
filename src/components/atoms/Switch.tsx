import React from 'react';
import { View, Switch as RNSwitch, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type SwitchColor = 'primary' | 'success' | 'error';

export interface SwitchProps extends ComponentProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  color?: SwitchColor;
  labelPosition?: 'left' | 'right';
}

const COLOR_MAP: Record<SwitchColor, Record<number, string>> = {
  primary: theme.colors.primary,
  success: theme.colors.success,
  error: theme.colors.error,
};

export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  size = 'md',
  color = 'primary',
  labelPosition = 'right',
  style,
}) => {
  const colors = COLOR_MAP[color];
  const scale = size === 'sm' ? 0.8 : 1;

  const switchEl = (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.colors.gray[300], true: colors[500] }}
      thumbColor={theme.colors.white}
      style={{ transform: [{ scaleX: scale }, { scaleY: scale }] }}
    />
  );

  const labelEl = (label !== undefined || description !== undefined) ? (
    <View style={styles.labelGroup}>
      {label !== undefined && (
        <RNText style={[styles.label, disabled && styles.disabledText]}>{label}</RNText>
      )}
      {description !== undefined && (
        <RNText style={[styles.description, disabled && styles.disabledText]}>{description}</RNText>
      )}
    </View>
  ) : null;

  return (
    <View style={[styles.row, style]}>
      {labelPosition === 'left' && labelEl}
      {switchEl}
      {labelPosition === 'right' && labelEl}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  labelGroup: { flex: 1 },
  label: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  description: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.gray[500],
    marginTop: 2,
  },
  disabledText: { color: theme.colors.gray[400] },
});
