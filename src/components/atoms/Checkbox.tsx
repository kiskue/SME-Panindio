import React from 'react';
import { Pressable, View, Text as RNText, StyleSheet } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type CheckboxColor = 'primary' | 'success' | 'error';

export interface CheckboxProps extends ComponentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: CheckboxColor;
  error?: string;
}

const SIZE_MAP = {
  sm: { box: 16, icon: 10, font: 13 },
  md: { box: 20, icon: 13, font: 15 },
  lg: { box: 24, icon: 16, font: 16 },
};

const COLOR_MAP: Record<CheckboxColor, Record<number, string>> = {
  primary: theme.colors.primary,
  success: theme.colors.success,
  error: theme.colors.error,
};

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  size = 'md',
  color = 'primary',
  error,
  style,
}) => {
  const { box, icon, font } = SIZE_MAP[size];
  const colors = COLOR_MAP[color];
  const isActive = checked || indeterminate;

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        onPress={() => !disabled && onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        style={[styles.row, disabled && styles.disabled]}
      >
        <View
          style={[
            styles.box,
            {
              width: box,
              height: box,
              borderRadius: theme.borderRadius.sm,
            },
            isActive
              ? { backgroundColor: colors[500], borderColor: colors[500] }
              : { backgroundColor: theme.colors.white, borderColor: theme.colors.gray[300] },
            error !== undefined ? { borderColor: theme.colors.error[500] } : {},
          ]}
        >
          {indeterminate && (
            <Minus size={icon} color={theme.colors.white} strokeWidth={3} />
          )}
          {checked && !indeterminate && (
            <Check size={icon} color={theme.colors.white} strokeWidth={3} />
          )}
        </View>

        {label !== undefined && (
          <RNText style={[styles.label, { fontSize: font }]}>{label}</RNText>
        )}
      </Pressable>

      {error !== undefined && (
        <RNText style={styles.error}>{error}</RNText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  box: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.normal,
  },
  disabled: { opacity: 0.5 },
  error: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error[500],
    marginTop: theme.spacing.xs,
  },
});
