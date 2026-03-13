/**
 * InventoryItemCard
 *
 * Dark-mode-first redesign. Renders a single inventory item as a modern card:
 *   - Glassmorphism surface with category accent glow border
 *   - Quantity badge with health-coded color and subtle glow
 *   - Slim neon progress bar for stock level
 *   - Icon circle with category accent tint
 *   - SKU / serial meta chips
 *   - Price row, condition badge, chevron
 *
 * Stock health colour rules:
 *   Out of stock  → error variant   (quantity === 0)
 *   Low stock     → warning variant (0 < quantity <= reorderLevel)
 *   Healthy       → success variant
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
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem, InventoryCategory } from '@/types';

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  accentColor: string;
  glowColor:   string;
  iconBg:      string;
  label:       string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const DARK_CATEGORY_CONFIG: Record<InventoryCategory, CategoryConfig> = {
  product: {
    accentColor: '#4F9EFF',
    glowColor:   'rgba(79,158,255,0.25)',
    iconBg:      'rgba(79,158,255,0.15)',
    label:       'Product',
    Icon:        Package,
  },
  ingredient: {
    accentColor: '#3DD68C',
    glowColor:   'rgba(61,214,140,0.22)',
    iconBg:      'rgba(61,214,140,0.13)',
    label:       'Ingredient',
    Icon:        Wheat,
  },
  equipment: {
    accentColor: '#FFB020',
    glowColor:   'rgba(255,176,32,0.22)',
    iconBg:      'rgba(255,176,32,0.13)',
    label:       'Equipment',
    Icon:        Wrench,
  },
};

const LIGHT_CATEGORY_CONFIG: Record<InventoryCategory, CategoryConfig> = {
  product: {
    accentColor: staticTheme.colors.primary[500],
    glowColor:   `${staticTheme.colors.primary[500]}18`,
    iconBg:      staticTheme.colors.primary[50],
    label:       'Product',
    Icon:        Package,
  },
  ingredient: {
    accentColor: staticTheme.colors.success[500],
    glowColor:   `${staticTheme.colors.success[500]}18`,
    iconBg:      staticTheme.colors.success[50],
    label:       'Ingredient',
    Icon:        Wheat,
  },
  equipment: {
    accentColor: staticTheme.colors.highlight[400],
    glowColor:   `${staticTheme.colors.highlight[400]}18`,
    iconBg:      staticTheme.colors.highlight[50],
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

interface HealthColors {
  text:   string;
  bg:     string;
  border: string;
  bar:    string;
  barBg:  string;
}

function getHealthColors(health: StockHealth, isDark: boolean): HealthColors {
  if (isDark) {
    switch (health) {
      case 'out':     return { text: '#FF6B6B', bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.35)', bar: '#FF6B6B', barBg: 'rgba(255,107,107,0.12)' };
      case 'low':     return { text: '#FFB020', bg: 'rgba(255,176,32,0.15)', border: 'rgba(255,176,32,0.35)', bar: '#FFB020', barBg: 'rgba(255,176,32,0.12)' };
      case 'healthy': return { text: '#3DD68C', bg: 'rgba(61,214,140,0.13)', border: 'rgba(61,214,140,0.30)', bar: '#3DD68C', barBg: 'rgba(61,214,140,0.10)' };
    }
  } else {
    switch (health) {
      case 'out':     return { text: staticTheme.colors.error[500], bg: staticTheme.colors.error[50], border: staticTheme.colors.error[200], bar: staticTheme.colors.error[500], barBg: staticTheme.colors.error[100] };
      case 'low':     return { text: staticTheme.colors.warning[600], bg: staticTheme.colors.warning[50], border: staticTheme.colors.warning[200], bar: staticTheme.colors.warning[500], barBg: staticTheme.colors.warning[100] };
      case 'healthy': return { text: staticTheme.colors.success[600], bg: staticTheme.colors.success[50], border: staticTheme.colors.success[200], bar: staticTheme.colors.success[500], barBg: staticTheme.colors.success[100] };
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function stockFillRatio(item: InventoryItem): number {
  if (item.reorderLevel === undefined || item.reorderLevel === 0) return 1;
  return Math.min(1, item.quantity / (item.reorderLevel * 3));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

interface StockBarProps {
  fill:    number;
  color:   string;
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
  track: { height: 3, borderRadius: 2, overflow: 'hidden', flex: 1 },
  fill:  { height: '100%', borderRadius: 2 },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryItemCardProps {
  item:    InventoryItem;
  onPress: (item: InventoryItem) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(
  ({ item, onPress }) => {
    const theme    = useAppTheme();
    const mode     = useThemeStore(selectThemeMode);
    const isDark   = mode === 'dark';
    const config   = isDark ? DARK_CATEGORY_CONFIG[item.category] : LIGHT_CATEGORY_CONFIG[item.category];
    const health   = getStockHealth(item);
    const hColors  = getHealthColors(health, isDark);
    const fillRatio = stockFillRatio(item);
    const isAlert  = health !== 'healthy';

    const handlePress = () => onPress(item);

    // Derived plain-string color values (NOT StyleSheet entries) for use in props
    const metaBg     = isDark ? 'rgba(255,255,255,0.06)'  : theme.colors.gray[100];
    const metaText   = isDark ? 'rgba(255,255,255,0.50)'  : theme.colors.gray[500];
    const metaBorder = isDark ? 'rgba(255,255,255,0.10)'  : theme.colors.gray[200];
    const cardBg     = isDark ? '#151A27'                  : theme.colors.white;
    const cardBorder = isDark ? config.glowColor           : `${config.accentColor}25`;
    const priceColor = isDark ? '#4F9EFF'                  : staticTheme.colors.primary[500];
    const costColor  = isDark ? 'rgba(255,255,255,0.42)'   : theme.colors.gray[500];
    const reorderCol = isDark ? 'rgba(255,255,255,0.38)'   : theme.colors.gray[400];
    const chevronCol = isDark ? 'rgba(255,255,255,0.28)'   : theme.colors.gray[400];

    const dynStyles = useMemo(() => StyleSheet.create({
      card: {
        flexDirection: 'row',
        backgroundColor: cardBg,
        borderRadius: staticTheme.borderRadius.xl,
        marginHorizontal: staticTheme.spacing.md,
        marginVertical: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: cardBorder,
        ...(isDark ? {
          shadowColor: config.accentColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 4,
        } : staticTheme.shadows.sm),
      },
      categoryPill: {
        backgroundColor: config.iconBg,
        borderRadius: staticTheme.borderRadius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start' as const,
        borderWidth: 1,
        borderColor: isDark ? `${config.accentColor}25` : 'transparent',
      },
    }), [cardBg, cardBorder, isDark, config]);

    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [dynStyles.card, pressed && cardPressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.category}, ${item.quantity} ${item.unit}${isAlert ? `, ${health} stock` : ''}`}
      >
        {/* Left accent bar */}
        <View style={[staticStyles.accentBar, { backgroundColor: config.accentColor }]} />

        {/* Card body */}
        <View style={staticStyles.body}>

          {/* Row 1: icon + name + qty badge */}
          <View style={staticStyles.topRow}>
            <View style={[staticStyles.iconCircle, { backgroundColor: config.iconBg }]}>
              <config.Icon size={17} color={config.accentColor} />
            </View>

            <View style={staticStyles.nameWrap}>
              <Text variant="body" weight="semibold" style={[staticStyles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={dynStyles.categoryPill}>
                <Text variant="body-xs" weight="medium" style={{ color: config.accentColor }}>
                  {config.label}
                </Text>
              </View>
            </View>

            {/* Quantity badge */}
            <View style={[staticStyles.qtyBlock, { backgroundColor: hColors.bg, borderColor: hColors.border }]}>
              {isAlert && (
                <AlertTriangle size={9} color={hColors.text} style={{ marginBottom: 1 }} />
              )}
              <Text variant="body" weight="bold" style={[staticStyles.qtyNumber, { color: hColors.text }]}>
                {item.quantity}
              </Text>
              <Text variant="body-xs" style={[staticStyles.qtyUnit, { color: hColors.text }]}>
                {item.unit}
              </Text>
            </View>
          </View>

          {/* Row 2: progress bar + reorder text */}
          {item.reorderLevel !== undefined && (
            <View style={staticStyles.progressRow}>
              <StockBar fill={fillRatio} color={hColors.bar} bgColor={hColors.barBg} />
              <Text variant="body-xs" style={[staticStyles.reorderText, { color: reorderCol }]}>
                Reorder: {item.reorderLevel}
              </Text>
            </View>
          )}

          {/* Row 3: meta chips */}
          {(item.sku !== undefined || item.serialNumber !== undefined) && (
            <View style={staticStyles.metaRow}>
              {item.sku !== undefined && (
                <MetaChip
                  icon={<Tag size={9} color={metaText} />}
                  label={item.sku}
                  bgColor={metaBg}
                  textColor={metaText}
                  borderColor={metaBorder}
                />
              )}
              {item.serialNumber !== undefined && (
                <MetaChip
                  icon={<Hash size={9} color={metaText} />}
                  label={item.serialNumber}
                  bgColor={metaBg}
                  textColor={metaText}
                  borderColor={metaBorder}
                />
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

            <ChevronRight size={15} color={chevronCol} />
          </View>
        </View>
      </Pressable>
    );
  },
);

InventoryItemCard.displayName = 'InventoryItemCard';

const cardPressedStyle = { opacity: 0.82, transform: [{ scale: 0.985 }] } as const;

const staticStyles = StyleSheet.create({
  accentBar: { width: 3, flexShrink: 0 },
  body: {
    flex: 1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 12,
    gap: 8,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nameWrap:  { flex: 1, gap: 3, minWidth: 0 },
  name:      {},
  qtyBlock: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth: 1,
    flexShrink: 0, minWidth: 54,
  },
  qtyNumber:   { lineHeight: 20 },
  qtyUnit:     { lineHeight: 14, opacity: 0.85 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  reorderText: {},
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  bottomRow:   { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  priceGroup:  { flex: 1, gap: 2 },
  badgeGroup:  { flexDirection: 'row', gap: 4, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
});
