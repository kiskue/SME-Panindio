/**
 * InventoryItemCard
 *
 * Airy 2026 redesign. Renders a single inventory item as a modern card that
 * works BOTH as a full-width list row (`layout="row"`, default) and as a cell
 * in a responsive grid on tablet (`layout="grid"`).
 *
 *   - Soft rounded surface (radius 2xl) with a subtle category-accent border
 *   - Icon chip tinted with the category accent
 *   - Quantity badge with health-coded color
 *   - Slim stock progress bar
 *   - SKU / serial meta chips, price row, condition badge
 *   - `selected` highlights the active row in the tablet master-detail pane
 *
 * Colors come from the shared `getInventoryAccent` / `getStockHealth(Colors)`
 * helpers (single source of truth) instead of per-file config. Dark depth is
 * conveyed by surface + border (getElevation returns {} in dark).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { AlertTriangle, ChevronRight, Tag, Hash } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Badge } from '@/components/atoms/Badge';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { useAppTheme, useThemeMode, getElevation } from '@/core/theme';
import { getInventoryAccent, getStockHealth, getStockHealthColors } from '@/core/theme/inventoryAccents';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import type { InventoryItem } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockFillRatio(item: InventoryItem): number {
  if (item.reorderLevel === undefined || item.reorderLevel === 0) return 1;
  return Math.min(1, item.quantity / (item.reorderLevel * 3));
}

const withAlpha = (hex: string, alpha: string): string =>
  hex.startsWith('#') && hex.length === 7 ? `${hex}${alpha}` : hex;

// ─── Meta chip ──────────────────────────────────────────────────────────────────

interface MetaChipProps {
  icon:        React.ReactNode;
  label:       string;
  bgColor:     string;
  textColor:   string;
  borderColor: string;
}

const MetaChip: React.FC<MetaChipProps> = ({ icon, label, bgColor, textColor, borderColor }) => (
  <View style={[metaChipStyles.container, { backgroundColor: bgColor, borderColor }]}>
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: staticTheme.borderRadius.sm,
    borderWidth: 1,
  },
  label: {},
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryItemCardProps {
  item:    InventoryItem;
  onPress: (item: InventoryItem) => void;
  /** 'row' = full-width list row (default); 'grid' = cell in a multi-column grid. */
  layout?: 'row' | 'grid';
  /** Highlights the card as the active selection (tablet master-detail). */
  selected?: boolean;
  /** Extra style for the outer card (e.g. grid cell sizing). */
  style?:  StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(
  ({ item, onPress, layout = 'row', selected = false, style }) => {
    const theme    = useAppTheme();
    const mode     = useThemeMode();
    const isDark   = mode === 'dark';
    const isGrid   = layout === 'grid';

    const accent    = getInventoryAccent(item.category, isDark);
    const health    = getStockHealth(item);
    const hColors   = getStockHealthColors(health, isDark);
    const fillRatio = stockFillRatio(item);
    const isAlert   = health !== 'healthy';

    const handlePress = () => onPress(item);

    // Plain-string color values for props
    const metaBg     = isDark ? 'rgba(255,255,255,0.06)' : theme.colors.gray[100];
    const metaText   = isDark ? 'rgba(255,255,255,0.55)' : theme.colors.gray[500];
    const metaBorder = isDark ? 'rgba(255,255,255,0.10)' : theme.colors.gray[200];
    const priceColor = accent.accent;
    const costColor  = theme.colors.textSecondary;
    const reorderCol = theme.colors.textSecondary;
    const chevronCol = isDark ? theme.colors.textSecondary : theme.colors.gray[400];

    const dynStyles = useMemo(() => StyleSheet.create({
      outerCard: {
        flex: isGrid ? 1 : 0,
        backgroundColor: theme.colors.surface,
        borderRadius: staticTheme.borderRadius['2xl'],
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? accent.accent : (isDark ? accent.glow : withAlpha(accent.accent, '26')),
        ...(isGrid
          ? {}
          : { marginHorizontal: staticTheme.spacing.md, marginVertical: 5 }),
        ...(selected ? { backgroundColor: accent.heroBg } : {}),
        ...getElevation('sm', mode),
      },
      iconCircle: {
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: accent.iconBg,
        alignItems: 'center' as const, justifyContent: 'center' as const, flexShrink: 0,
      },
      categoryPill: {
        backgroundColor: accent.iconBg,
        borderRadius: staticTheme.borderRadius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start' as const,
        borderWidth: 1,
        borderColor: accent.glow,
      },
    }), [theme, isDark, isGrid, selected, accent, mode]);

    const AccentIcon = accent.Icon;

    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [dynStyles.outerCard, pressed && cardPressedStyle, style]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${item.name}, ${item.category}, ${item.quantity} ${item.unit}${isAlert ? `, ${health} stock` : ''}`}
      >
        <View style={staticStyles.body}>
          {/* Row 1: icon + name + qty badge */}
          <View style={staticStyles.topRow}>
            <View style={dynStyles.iconCircle}>
              <AccentIcon size={18} color={accent.accent} />
            </View>

            <View style={staticStyles.nameWrap}>
              <Text variant="body" weight="semibold" style={{ color: theme.colors.text }} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={dynStyles.categoryPill}>
                <Text variant="body-xs" weight="medium" style={{ color: accent.accent }}>
                  {accent.label}
                </Text>
              </View>
            </View>

            <View style={[staticStyles.qtyBlock, { backgroundColor: hColors.bg, borderColor: hColors.border }]}>
              {isAlert && <AlertTriangle size={9} color={hColors.text} style={staticStyles.qtyAlertIcon} />}
              <Text variant="body" weight="bold" style={[staticStyles.qtyNumber, { color: hColors.text }]}>
                {item.quantity}
              </Text>
              <Text variant="body-xs" style={[staticStyles.qtyUnit, { color: hColors.text }]}>
                {item.unit}
              </Text>
            </View>
          </View>

          {/* Row 2: stock bar + reorder */}
          {item.reorderLevel !== undefined && (
            <View style={staticStyles.progressRow}>
              <ProgressBar fraction={fillRatio} color={hColors.bar} trackColor={hColors.barBg} height={4} style={staticStyles.progressBar} />
              <Text variant="body-xs" style={{ color: reorderCol }}>
                Reorder: {item.reorderLevel}
              </Text>
            </View>
          )}

          {/* Row 3: meta chips */}
          {(item.sku !== undefined || item.serialNumber !== undefined) && (
            <View style={staticStyles.metaRow}>
              {item.sku !== undefined && (
                <MetaChip icon={<Tag size={9} color={metaText} />} label={item.sku} bgColor={metaBg} textColor={metaText} borderColor={metaBorder} />
              )}
              {item.serialNumber !== undefined && (
                <MetaChip icon={<Hash size={9} color={metaText} />} label={item.serialNumber} bgColor={metaBg} textColor={metaText} borderColor={metaBorder} />
              )}
            </View>
          )}

          {/* Row 4: price + badges + chevron */}
          <View style={staticStyles.bottomRow}>
            <View style={staticStyles.priceGroup}>
              {item.price !== undefined && (
                <Text variant="body-sm" weight="semibold" style={{ color: priceColor }}>
                  {formatCurrency(item.price)}
                </Text>
              )}
              {item.costPrice !== undefined && (
                <Text variant="body-xs" style={{ color: costColor }}>
                  Cost: {formatCurrency(item.costPrice)}
                </Text>
              )}
            </View>

            <View style={staticStyles.badgeGroup}>
              {item.condition !== undefined && (
                <Badge
                  label={item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                  variant={item.condition === 'good' ? 'success' : item.condition === 'fair' ? 'warning' : 'error'}
                  size="sm"
                />
              )}
              {health === 'out' && <Badge label="Out of Stock" variant="error" size="sm" />}
              {health === 'low' && <Badge label="Low Stock" variant="warning" size="sm" />}
            </View>

            {!isGrid && <ChevronRight size={15} color={chevronCol} />}
          </View>
        </View>
      </Pressable>
    );
  },
);

InventoryItemCard.displayName = 'InventoryItemCard';

const cardPressedStyle = { opacity: 0.85, transform: [{ scale: 0.985 }] } as const;

const staticStyles = StyleSheet.create({
  body: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.md - 2,
    gap: 10,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  nameWrap:  { flex: 1, gap: 3, minWidth: 0 },
  qtyBlock: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth: 1,
    flexShrink: 0, minWidth: 54,
  },
  qtyAlertIcon: { marginBottom: 1 },
  qtyNumber:   { lineHeight: 20 },
  qtyUnit:     { lineHeight: 14, opacity: 0.85 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  progressBar: { flex: 1 },
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  bottomRow:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  priceGroup:  { flex: 1, gap: 2 },
  badgeGroup:  { flexDirection: 'row', gap: 4, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
});
