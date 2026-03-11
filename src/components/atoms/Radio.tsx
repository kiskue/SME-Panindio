import React from 'react';
import { Pressable, View, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export type RadioColor = 'primary' | 'success' | 'error';

export interface RadioProps extends ComponentProps {
  selected: boolean;
  onSelect: () => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: RadioColor;
  description?: string;
}

export interface RadioGroupProps extends ComponentProps {
  options: Array<{
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }>;
  value: string;
  onChange: (value: string) => void;
  color?: RadioColor;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { outer: 16, inner: 8,  font: 13, descFont: 11 },
  md: { outer: 20, inner: 10, font: 15, descFont: 13 },
  lg: { outer: 24, inner: 12, font: 16, descFont: 14 },
};

const COLOR_MAP: Record<RadioColor, Record<number, string>> = {
  primary: theme.colors.primary,
  success: theme.colors.success,
  error: theme.colors.error,
};

export const Radio: React.FC<RadioProps> = ({
  selected,
  onSelect,
  label,
  disabled = false,
  size = 'md',
  color = 'primary',
  description,
  style,
}) => {
  const { outer, inner, font, descFont } = SIZE_MAP[size];
  const colors = COLOR_MAP[color];

  return (
    <Pressable
      onPress={() => !disabled && onSelect()}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={[styles.row, disabled && styles.disabled, style]}
    >
      <View
        style={[
          styles.outer,
          {
            width: outer,
            height: outer,
            borderRadius: outer / 2,
          },
          selected
            ? { borderColor: colors[500] }
            : { borderColor: theme.colors.gray[300] },
        ]}
      >
        {selected && (
          <View
            style={[
              styles.inner,
              {
                width: inner,
                height: inner,
                borderRadius: inner / 2,
                backgroundColor: colors[500],
              },
            ]}
          />
        )}
      </View>

      {(label !== undefined || description !== undefined) && (
        <View style={styles.labelGroup}>
          {label !== undefined && (
            <RNText style={[styles.label, { fontSize: font }]}>{label}</RNText>
          )}
          {description !== undefined && (
            <RNText style={[styles.description, { fontSize: descFont }]}>{description}</RNText>
          )}
        </View>
      )}
    </Pressable>
  );
};

export const RadioGroup: React.FC<RadioGroupProps> = ({
  options,
  value,
  onChange,
  color = 'primary',
  size = 'md',
  style,
}) => (
  <View style={[styles.group, style]}>
    {options.map(opt => (
      <Radio
        key={opt.value}
        selected={value === opt.value}
        onSelect={() => onChange(opt.value)}
        label={opt.label}
        color={color}
        size={size}
        {...(opt.description !== undefined ? { description: opt.description } : {})}
        {...(opt.disabled !== undefined ? { disabled: opt.disabled } : {})}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  outer: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  inner: {},
  labelGroup: { flex: 1 },
  label: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.normal,
  },
  description: {
    color: theme.colors.gray[500],
    marginTop: 2,
  },
  disabled: { opacity: 0.5 },
  group: { gap: theme.spacing.md },
});
