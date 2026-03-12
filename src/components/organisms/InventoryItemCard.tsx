/**
 * InventoryItemCard
 *
 * Redesigned organism for the inventory list. Renders a single item with:
 *   - Category accent left border (navy / green / amber)
 *   - Quantity + unit displayed prominently, colored by stock health
 *   - Stock level progress bar (quantity vs reorderLevel)
 *   - Reorder level indicator text
 *   - SKU chip (products), serial number chip (equipment)
 *   - Price + cost price row
 *   - Condition badge (equipment)
 *   - Low-stock / out-of-stock warning badge
 *   - Chevron affordance signalling tappability
 *
 * Stock health colour rules:
 *   Out of stock  → error[500]  (quantity === 0)
 *   Low stock     → warning[500] (0 < quantity <= reorderLevel)
 *   Healthy       → success[500]
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Package,
  Wheat,
  Wrench,
  AlertTriangle,
  ChevronRight,
  Tag,
  Hash,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem, InventoryCategory } from '@/types';

// ─── Category config ──────────────────────────────────────────────────────────
// Brand palette colors (primary/success/highlight) don't change between modes
// so we can reference the static theme for icon colors.

interface CategoryConfig {
  accentColor: string;
  bgColor: string;
  iconColor: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const CATEGORY_CONFIG: Record<InventoryCategory, CategoryConfig> = {
  product: {
    accentColor: staticTheme.colors.primary[500],
    bgColor:     staticTheme.colors.primary[50],
    iconColor:   staticTheme.colors.primary[500],
    label:       'Product',
    Icon:        Package,
  },
  ingredient: {
    accentColor: staticTheme.colors.success[500],
    bgColor:     staticTheme.colors.success[50],
    iconColor:   staticTheme.colors.success[500],
    label:       'Ingredient',
    Icon:        Wheat,
  },
  equipment: {
    accentColor: staticTheme.colors.highlight[400],
    bgColor:     staticTheme.colors.highlight[50],
    iconColor:   staticTheme.colors.highlight[500],
    label:       'Equipment',
    Icon:        Wrench,
  },
};

// ─── Stock health ─────────────────────────────────────────────────────────────

type StockHealth = 'out' | 'low' | 'healthy';

function getStockHealth(item: InventoryItem): StockHealth {
  if (item.quantity === 0) return 'out';
  if (item.reorderLevel !== undefined && item.quantity <= item.reorderLevel) return 'low';
  return 'healthy';
}

function stockHealthColor(health: StockHealth): string {
  switch (health) {
    case 'out':     return staticTheme.colors.error[500];
    case 'low':     return staticTheme.colors.warning[500];
    case 'healthy': return staticTheme.colors.success[500];
  }
}

function stockHealthBg(health: StockHealth): string {
  switch (health) {
    case 'out':     return staticTheme.colors.error[50];
    case 'low':     return staticTheme.colors.warning[50];
    case 'healthy': return staticTheme.colors.success[50];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `\u20B1${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Returns a clamped 0–1 fill ratio for the stock progress bar.
 * When reorderLevel is undefined we default to showing full bar.
 */
function stockFillRatio(item: InventoryItem): number {
  if (item.reorderLevel === undefined || item.reorderLevel === 0) return 1;
  // Cap the ratio at 1 (quantity may exceed reorder level many times over)
  return Math.min(1, item.quantity / (item.reorderLevel * 3));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryItemCardProps {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetaChipProps {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  textColor: string;
}

const MetaChip: React.FC<MetaChipProps> = ({ icon, label, bgColor, textColor }) => (
  <View style={[metaChipStyles.container, { backgroundColor: bgColor }]}>
    {icon}
    <Text variant="body-xs" style={[metaChipStyles.label, { color: textColor }]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const metaChipStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: staticTheme.borderRadius.sm,
  },
  label: {},
});

// ─── Stock progress bar ───────────────────────────────────────────────────────

interface StockBarProps {
  fill: number;        // 0–1
  color: string;
  bgColor: string;
}

const StockBar: React.FC<StockBarProps> = ({ fill, color, bgColor }) => (
  <View style={[stockBarStyles.track, { backgroundColor: bgColor }]}>
    <View
      style={[
        stockBarStyles.fill,
        { width: `${Math.round(fill * 100)}%` as unknown as number, backgroundColor: color },
      ]}
    />
  </View>
);

const stockBarStyles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    flex: 1,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(
  ({ item, onPress }) => {
    const theme  = useAppTheme();
    const config  = CATEGORY_CONFIG[item.category];
    const health  = getStockHealth(item);
    const qtyColor = stockHealthColor(health);
    const qtyBg    = stockHealthBg(health);
    const fillRatio = stockFillRatio(item);

    const handlePress = () => onPress(item);

    const isOutOfStock = health === 'out';
    const isLowStock   = health === 'low';

    const dynStyles = useMemo(() => StyleSheet.create({
      card: {
        flexDirection: 'row',
        backgroundColor: theme.colors.white,
        borderRadius: staticTheme.borderRadius.lg,
        marginHorizontal: staticTheme.spacing.md,
        marginVertical: 5,
        overflow: 'hidden',
        ...staticTheme.shadows.sm,
      },
      name: {
        color: theme.colors.text,
      },
      reorderText: {
        color: theme.colors.gray[500],
        flexShrink: 0,
      },
      price: {
        color: staticTheme.colors.primary[500],
      },
      costPrice: {
        color: theme.colors.gray[500],
      },
    }), [theme]);

    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [dynStyles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.category}, ${item.quantity} ${item.unit}${isLowStock ? ', low stock' : ''}${isOutOfStock ? ', out of stock' : ''}`}
      >
        {/* Category accent left border */}
        <View style={[styles.accentBorder, { backgroundColor: config.accentColor }]} />

        {/* Card body */}
        <View style={styles.body}>

          {/* ── Row 1: Icon + Name + Quantity badge ── */}
          <View style={styles.topRow}>
            <View style={[styles.iconWrap, { backgroundColor: config.bgColor }]}>
              <config.Icon size={18} color={config.iconColor} />
            </View>

            <View style={styles.nameWrap}>
              <Text
                variant="body"
                weight="semibold"
                style={dynStyles.name}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              {/* Category label */}
              <View style={[styles.categoryPill, { backgroundColor: config.bgColor }]}>
                <Text variant="body-xs" weight="medium" style={{ color: config.accentColor }}>
                  {config.label}
                </Text>
              </View>
            </View>

            {/* Quantity block */}
            <View style={[styles.qtyBlock, { backgroundColor: qtyBg }]}>
              {(isOutOfStock || isLowStock) && (
                <AlertTriangle
                  size={10}
                  color={qtyColor}
                  style={styles.qtyAlertIcon}
                />
              )}
              <Text
                variant="body"
                weight="bold"
                style={[styles.qtyNumber, { color: qtyColor }]}
              >
                {item.quantity}
              </Text>
              <Text variant="body-xs" style={[styles.qtyUnit, { color: qtyColor }]}>
                {item.unit}
              </Text>
            </View>
          </View>

          {/* ── Row 2: Stock progress bar + reorder text ── */}
          {item.reorderLevel !== undefined && (
            <View style={styles.progressRow}>
              <StockBar fill={fillRatio} color={qtyColor} bgColor={qtyBg} />
              <Text variant="body-xs" style={dynStyles.reorderText}>
                Reorder at {item.reorderLevel} {item.unit}
              </Text>
            </View>
          )}

          {/* ── Row 3: Meta chips (SKU, serial number) ── */}
          {(item.sku !== undefined || item.serialNumber !== undefined) && (
            <View style={styles.metaRow}>
              {item.sku !== undefined && (
                <MetaChip
                  icon={<Tag size={9} color={theme.colors.gray[500]} />}
                  label={item.sku}
                  bgColor={theme.colors.gray[100]}
                  textColor={theme.colors.gray[600]}
                />
              )}
              {item.serialNumber !== undefined && (
                <MetaChip
                  icon={<Hash size={9} color={theme.colors.gray[500]} />}
                  label={item.serialNumber}
                  bgColor={theme.colors.gray[100]}
                  textColor={theme.colors.gray[600]}
                />
              )}
            </View>
          )}

          {/* ── Row 4: Price row + condition badge + chevron ── */}
          <View style={styles.bottomRow}>
            <View style={styles.priceGroup}>
              {item.price !== undefined && (
                <Text variant="body-sm" weight="semibold" style={dynStyles.price}>
                  {formatCurrency(item.price)}
                </Text>
              )}
              {item.costPrice !== undefined && (
                <Text variant="body-xs" style={dynStyles.costPrice}>
                  Cost: {formatCurrency(item.costPrice)}
                </Text>
              )}
            </View>

            <View style={styles.badgeGroup}>
              {item.condition !== undefined && (
                <Badge
                  label={item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                  variant={
                    item.condition === 'good'
                      ? 'success'
                      : item.condition === 'fair'
                      ? 'warning'
                      : 'error'
                  }
                  size="sm"
                />
              )}

              {isOutOfStock && (
                <Badge label="Out of Stock" variant="error" size="sm" />
              )}

              {isLowStock && !isOutOfStock && (
                <Badge label="Low Stock" variant="warning" size="sm" />
              )}
            </View>

            <ChevronRight size={16} color={theme.colors.gray[400]} />
          </View>
        </View>
      </Pressable>
    );
  },
);

InventoryItemCard.displayName = 'InventoryItemCard';

// ─── Static styles (layout only, no semantic color tokens) ────────────────────

const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  accentBorder: {
    width: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: staticTheme.spacing.md,
    gap: 8,
  },

  // Row 1
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: staticTheme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nameWrap: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: staticTheme.borderRadius.sm,
  },
  qtyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: staticTheme.borderRadius.md,
    flexShrink: 0,
    minWidth: 52,
  },
  qtyAlertIcon: {
    marginBottom: 1,
  },
  qtyNumber: {
    lineHeight: 20,
  },
  qtyUnit: {
    lineHeight: 14,
    opacity: 0.8,
  },

  // Row 2
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },

  // Row 3
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  // Row 4
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  priceGroup: {
    flex: 1,
    gap: 2,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
