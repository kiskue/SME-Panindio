/**
 * InventoryActionSheet
 *
 * Tap-to-choose chooser shown when an inventory item card is tapped on phone
 * layouts. Instead of jumping straight to the detail/edit screen, it offers the
 * two most common actions:
 *
 *   • Add Stock      — increase on-hand quantity (opens InventoryStockAddSheet).
 *                      For a MANUFACTURED product this reads "Record Production"
 *                      because the add path runs the BOM production flow.
 *   • View Details   — open the full detail/edit screen.
 *
 * Built on the shared `BottomSheet` organism and themed with the item's category
 * accent via `getInventoryAccent`, so it matches `InventoryItemCard` and the
 * detail summary. Full dark/light support comes from BottomSheet + the theme hooks.
 */

import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { PackagePlus, Factory, Eye, ChevronRight } from 'lucide-react-native';
import { BottomSheet } from '@/components/organisms/BottomSheet';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import type { InventoryItem } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InventoryActionSheetProps {
  visible:       boolean;
  /** The tapped item. `null` while the sheet is closing. */
  item:          InventoryItem | null;
  onAddStock:    (item: InventoryItem) => void;
  onViewDetails: (item: InventoryItem) => void;
  onClose:       () => void;
}

// ─── Option row ───────────────────────────────────────────────────────────────

interface OptionRowProps {
  Icon:     React.ComponentType<{ size?: number; color?: string }>;
  title:    string;
  subtitle: string;
  accent:   string;
  iconBg:   string;
  border:   string;
  surface:  string;
  textColor: string;
  subColor:  string;
  chevronColor: string;
  onPress:  () => void;
}

const OptionRow: React.FC<OptionRowProps> = ({
  Icon, title, subtitle, accent, iconBg, border, surface, textColor, subColor, chevronColor, onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={title}
    style={({ pressed }) => [
      styles.row,
      { backgroundColor: surface, borderColor: border },
      pressed && styles.rowPressed,
    ]}
  >
    <View style={[styles.iconChip, { backgroundColor: iconBg, borderColor: border }]}>
      <Icon size={20} color={accent} />
    </View>
    <View style={styles.rowText}>
      <Text variant="body" weight="semibold" style={{ color: textColor }}>{title}</Text>
      <Text variant="body-xs" style={{ color: subColor }} numberOfLines={1}>{subtitle}</Text>
    </View>
    <ChevronRight size={18} color={chevronColor} />
  </Pressable>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryActionSheet: React.FC<InventoryActionSheetProps> = ({
  visible,
  item,
  onAddStock,
  onViewDetails,
  onClose,
}) => {
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const accentInfo = getInventoryAccent(item?.category ?? 'product', isDark);

  const isManufactured = item?.category === 'product' && item.productType === 'manufactured';

  const neutralBg     = isDark ? 'rgba(255,255,255,0.06)' : theme.colors.gray[100];
  const neutralAccent = theme.colors.textSecondary;
  const rowSurface    = isDark ? 'rgba(255,255,255,0.03)' : theme.colors.background;
  const rowBorder     = theme.colors.borderSubtle;

  const headerStyles = useMemo(() => StyleSheet.create({
    iconChip: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: accentInfo.iconBg,
      borderWidth: 1, borderColor: accentInfo.glow,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    pill: {
      alignSelf: 'flex-start',
      backgroundColor: accentInfo.iconBg,
      borderRadius: staticTheme.borderRadius.sm,
      paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: accentInfo.glow,
    },
  }), [accentInfo]);

  const HeaderIcon = accentInfo.Icon;

  return (
    <BottomSheet visible={visible} onClose={onClose} defaultSnapPoint="50%">
      {item && (
        <View style={styles.container}>
          {/* Item header */}
          <View style={styles.header}>
            <View style={headerStyles.iconChip}>
              <HeaderIcon size={22} color={accentInfo.accent} />
            </View>
            <View style={styles.headerText}>
              <Text variant="h6" weight="bold" style={{ color: theme.colors.text }} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={headerStyles.pill}>
                <Text variant="body-xs" weight="medium" style={{ color: accentInfo.accent }}>
                  {accentInfo.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Options */}
          <View style={styles.options}>
            <OptionRow
              Icon={isManufactured ? Factory : PackagePlus}
              title={isManufactured ? 'Record Production' : 'Add Stock'}
              subtitle={isManufactured ? 'Make units — deducts ingredients (BOM)' : 'Increase on-hand quantity'}
              accent={accentInfo.accent}
              iconBg={accentInfo.iconBg}
              border={accentInfo.glow}
              surface={rowSurface}
              textColor={theme.colors.text}
              subColor={theme.colors.textSecondary}
              chevronColor={accentInfo.accent}
              onPress={() => onAddStock(item)}
            />
            <OptionRow
              Icon={Eye}
              title="View Details"
              subtitle="Edit fields and full info"
              accent={neutralAccent}
              iconBg={neutralBg}
              border={rowBorder}
              surface={rowSurface}
              textColor={theme.colors.text}
              subColor={theme.colors.textSecondary}
              chevronColor={theme.colors.textSecondary}
              onPress={() => onViewDetails(item)}
            />
          </View>
        </View>
      )}
    </BottomSheet>
  );
};

InventoryActionSheet.displayName = 'InventoryActionSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: staticTheme.spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm + 2,
  },
  headerText: { flex: 1, gap: 5, minWidth: 0 },
  options: { gap: staticTheme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm + 2,
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.sm + 4,
    minHeight: 64,
  },
  rowPressed: { opacity: 0.7 },
  iconChip: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
});
