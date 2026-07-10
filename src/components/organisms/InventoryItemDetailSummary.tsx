/**
 * InventoryItemDetailSummary — organism
 *
 * Read-only summary of an inventory item, used as the detail pane of the tablet
 * master-detail layout in CategoryInventoryScreen. Deliberately does NOT embed
 * the full react-hook-form edit form (that lives in inventory/[id].tsx); it
 * shows the key fields plus an "Edit" affordance that routes to the full form.
 *
 * Reuses Card / Text / InfoRow / Button, the shared ProductTypeBadge +
 * StockHealthIndicator molecules, and the inventory accent helpers — kept in
 * sync with the phone detail screen so both surfaces show the same fields.
 */

import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Image, type StyleProp, type ViewStyle } from 'react-native';
import { Pencil, PackagePlus, Factory } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { InfoRow } from '@/components/molecules/InfoRow';
import { ProductTypeBadge } from '@/components/molecules/ProductTypeBadge';
import { StockHealthIndicator } from '@/components/molecules/StockHealthIndicator';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import { formatDate } from '@/core/utils/date';
import type { InventoryItem } from '@/types';

export interface InventoryItemDetailSummaryProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  /** When provided, renders an "Add Stock" / "Record Production" action. */
  onAddStock?: (item: InventoryItem) => void;
  style?: StyleProp<ViewStyle>;
}

export const InventoryItemDetailSummary: React.FC<InventoryItemDetailSummaryProps> = ({ item, onEdit, onAddStock, style }) => {
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const accent = getInventoryAccent(item.category, isDark);
  const isManufactured = item.category === 'product' && item.productType === 'manufactured';

  const dynStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: staticTheme.borderRadius['2xl'],
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      padding: staticTheme.spacing.md,
      gap: staticTheme.spacing.sm + 2,
    },
    iconChip: {
      width: 48, height: 48, borderRadius: 15,
      backgroundColor: accent.iconBg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      backgroundColor: accent.iconBg,
      borderRadius: staticTheme.borderRadius.sm,
      paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: accent.glow,
    },
  }), [theme, accent]);

  const Icon = accent.Icon;
  const hasImage = item.imageUri !== undefined && item.imageUri.length > 0;

  return (
    <ScrollView
      style={[dynStyles.container, style]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={dynStyles.card}>
        {hasImage && (
          <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="cover" />
        )}

        <View style={styles.headerRow}>
          <View style={dynStyles.iconChip}>
            <Icon size={24} color={accent.accent} />
          </View>
          <View style={styles.headerText}>
            <Text variant="h5" weight="bold" style={{ color: theme.colors.text }} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={dynStyles.categoryPill}>
              <Text variant="body-xs" weight="medium" style={{ color: accent.accent }}>
                {accent.label}
              </Text>
            </View>
          </View>
        </View>

        {item.category === 'product' && <ProductTypeBadge productType={item.productType} />}

        {/* Quantity + health + reorder progress */}
        <StockHealthIndicator item={item} />
      </View>

      {/* Details */}
      <View style={dynStyles.card}>
        {item.price !== undefined        && <InfoRow label="Selling price" value={formatCurrency(item.price)} emphasis />}
        {item.costPrice !== undefined    && <InfoRow label="Cost price"     value={formatCurrency(item.costPrice)} />}
        {item.sku !== undefined          && <InfoRow label="SKU"            value={item.sku} />}
        {item.serialNumber !== undefined && <InfoRow label="Serial / asset" value={item.serialNumber} />}
        {item.condition !== undefined    && (
          <InfoRow label="Condition" value={item.condition.charAt(0).toUpperCase() + item.condition.slice(1)} />
        )}
        {item.purchaseDate !== undefined && <InfoRow label="Purchased" value={item.purchaseDate} />}
        {item.description !== undefined && item.description.length > 0 && (
          <View style={styles.descBlock}>
            <Text variant="body-xs" weight="medium" style={{ color: theme.colors.textSecondary }}>Description</Text>
            <Text variant="body-sm" style={{ color: theme.colors.text }}>{item.description}</Text>
          </View>
        )}
      </View>

      {/* Metadata */}
      <View style={dynStyles.card}>
        <InfoRow label="Created"      value={formatDate(item.createdAt)} />
        <InfoRow label="Last updated" value={formatDate(item.updatedAt)} />
      </View>

      {onAddStock && (
        <Button
          title={isManufactured ? 'Record Production' : 'Add Stock'}
          onPress={() => onAddStock(item)}
          variant="primary"
          size="lg"
          fullWidth
          leftIcon={
            isManufactured
              ? <Factory size={16} color={staticTheme.colors.white} />
              : <PackagePlus size={16} color={staticTheme.colors.white} />
          }
          style={styles.addStockBtn}
        />
      )}

      <Button
        title="Edit item"
        onPress={() => onEdit(item)}
        variant={onAddStock ? 'outline' : 'primary'}
        size="lg"
        fullWidth
        leftIcon={<Pencil size={16} color={onAddStock ? accent.accent : staticTheme.colors.white} />}
        style={styles.editBtn}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: staticTheme.spacing.md,
    gap: staticTheme.spacing.sm + 2,
    paddingBottom: staticTheme.spacing.xl,
  },
  image: {
    width: '100%',
    height: 168,
    borderRadius: staticTheme.borderRadius.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm + 2 },
  headerText: { flex: 1, gap: 6, minWidth: 0 },
  descBlock: { gap: 4, paddingTop: 4 },
  addStockBtn: { marginTop: staticTheme.spacing.xs },
  editBtn: { marginTop: staticTheme.spacing.sm },
});
