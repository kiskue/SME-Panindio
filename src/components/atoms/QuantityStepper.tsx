import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Text } from './Text';
import { useAppTheme } from '../../core/theme';
import { ComponentProps } from '@/types';

export type QuantityStepperSize = 'sm' | 'md' | 'lg';

export interface QuantityStepperProps extends ComponentProps {
  /** Current quantity. */
  value: number;
  /** Lowest allowed value. Default `1`. The minus button disables at this bound. */
  min?: number;
  /** Highest allowed value. The plus button disables at this bound. */
  max?: number;
  /** Called with the new value when `+`/`-` is pressed and the bound allows it. */
  onChange: (next: number) => void;
  /**
   * Called instead of `onChange` when `+` is pressed while already at `max`.
   * Lets callers surface a "stock limit reached" message instead of silently no-oping.
   */
  onAtMax?: () => void;
  /** Visual size. Default `md`. */
  size?: QuantityStepperSize;
}

const SIZE_MAP: Record<QuantityStepperSize, { btn: number; icon: number; font: number; gap: number }> = {
  sm: { btn: 26, icon: 14, font: 13, gap: 6 },
  md: { btn: 30, icon: 16, font: 15, gap: 8 },
  lg: { btn: 36, icon: 18, font: 17, gap: 10 },
};

/**
 * Compact `−  N  +` quantity control. Extracted from the hand-rolled +/-
 * TouchableOpacity blocks in the customer cart so the stepper behaves and
 * looks the same everywhere. Honors `min`/`max` bounds and routes an
 * at-max `+` press to `onAtMax` so the caller can warn (e.g. stock limit).
 */
export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  min = 1,
  max,
  onChange,
  onAtMax,
  size = 'md',
  style,
}) => {
  const theme = useAppTheme();
  const dims = SIZE_MAP[size];

  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;

  const btnBase = {
    width: dims.btn,
    height: dims.btn,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSubtle,
  };

  const handleDecrement = () => {
    if (atMin) return;
    onChange(value - 1);
  };

  const handleIncrement = () => {
    if (atMax) {
      onAtMax?.();
      return;
    }
    onChange(value + 1);
  };

  return (
    <View style={[styles.row, { gap: dims.gap }, style]}>
      <Pressable
        onPress={handleDecrement}
        disabled={atMin}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        style={[styles.btn, btnBase, atMin && styles.disabled]}
      >
        <Minus size={dims.icon} color={theme.colors.primary[500]} />
      </Pressable>

      <Text
        weight="bold"
        style={[styles.value, { fontSize: dims.font, color: theme.colors.text }]}
        accessibilityLabel={`Quantity ${value}`}
      >
        {value}
      </Text>

      <Pressable
        onPress={handleIncrement}
        disabled={atMax}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        style={[styles.btn, btnBase, atMax && styles.disabled]}
      >
        <Plus size={dims.icon} color={theme.colors.primary[500]} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  value: {
    minWidth: 22,
    textAlign: 'center',
  },
});
