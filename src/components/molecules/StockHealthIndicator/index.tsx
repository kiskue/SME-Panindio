/**
 * StockHealthIndicator — molecule
 *
 * Quantity block + stock-health badge + reorder hint + fill progress bar.
 * Extracted from InventoryItemDetailSummary so the tablet detail pane and the
 * phone item-detail overview header render an identical stock-status block.
 *
 * Reuses the single source of truth in `core/theme/inventoryAccents`
 * (getStockHealth / getStockHealthColors) and the ProgressBar atom.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { getStockHealth, getStockHealthColors } from '@/core/theme/inventoryAccents';
import type { InventoryItem } from '@/types';

export interface StockHealthIndicatorProps {
  item:   Pick<InventoryItem, 'quantity' | 'reorderLevel' | 'unit'>;
  style?: StyleProp<ViewStyle>;
}

/** Fraction of the visual "full" bar that the current quantity represents. */
function stockFillRatio(item: Pick<InventoryItem, 'quantity' | 'reorderLevel'>): number {
  if (item.reorderLevel === undefined || item.reorderLevel === 0) return 1;
  return Math.min(1, item.quantity / (item.reorderLevel * 3));
}

export const StockHealthIndicator: React.FC<StockHealthIndicatorProps> = ({ item, style }) => {
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const health  = getStockHealth(item);
  const hColors = getStockHealthColors(health, isDark);
  const fill    = stockFillRatio(item);

  const dynStyles = useMemo(() => StyleSheet.create({
    qtyBlock: {
      backgroundColor: hColors.bg,
      borderColor:     hColors.border,
      borderWidth:     1,
      borderRadius:    staticTheme.borderRadius.lg,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical:   staticTheme.spacing.sm,
      alignItems:      'flex-end',
    },
  }), [hColors]);

  return (
    <View style={style}>
      <View style={styles.qtyRow}>
        <View style={dynStyles.qtyBlock}>
          <Text variant="h4" weight="bold" style={{ color: hColors.text }}>
            {item.quantity}
          </Text>
          <Text variant="body-xs" style={{ color: hColors.text }}>{item.unit}</Text>
        </View>
        <View style={styles.healthCol}>
          {health === 'out'     && <Badge label="Out of Stock" variant="error"   size="md" />}
          {health === 'low'     && <Badge label="Low Stock"    variant="warning" size="md" />}
          {health === 'healthy' && <Badge label="In Stock"     variant="success" size="md" />}
          {item.reorderLevel !== undefined && (
            <Text variant="body-xs" style={{ color: theme.colors.textSecondary, marginTop: 6 }}>
              Reorder at {item.reorderLevel} {item.unit}
            </Text>
          )}
        </View>
      </View>

      {item.reorderLevel !== undefined && (
        <ProgressBar fraction={fill} color={hColors.bar} trackColor={hColors.barBg} height={6} style={styles.bar} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  qtyRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: staticTheme.spacing.md },
  healthCol: { flex: 1, alignItems: 'flex-end' },
  bar:       { marginTop: staticTheme.spacing.sm },
});
