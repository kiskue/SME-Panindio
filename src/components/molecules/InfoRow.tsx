import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../atoms/Text';
import { useAppTheme } from '../../core/theme';
import { ComponentProps } from '@/types';

export interface InfoRowProps extends ComponentProps {
  /** Left-aligned field label. */
  label: string;
  /** Right-aligned field value. */
  value: string;
  /**
   * When `true`, renders the value larger, bold and in the brand color
   * (used for the "Total" row in summaries). Default `false`.
   */
  emphasis?: boolean;
}

/**
 * Side-by-side label / value row. Replaces the local `InfoRow` helpers that
 * were hand-rolled in both the customer profile and order-detail screens.
 * `ListItem` stacks its title/subtitle vertically, so this small horizontal
 * row earns its place. Pass `emphasis` for total/summary rows.
 */
export const InfoRow: React.FC<InfoRowProps> = ({ label, value, emphasis = false, style }) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.row, style]}>
      <Text variant="body-sm" style={{ color: theme.colors.textSecondary }}>
        {label}
      </Text>
      <Text
        variant={emphasis ? 'body' : 'body-sm'}
        weight={emphasis ? 'bold' : 'semibold'}
        style={[styles.value, { color: emphasis ? theme.colors.tintPrimary : theme.colors.text }]}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
