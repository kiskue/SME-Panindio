/**
 * ProductTypeBadge — molecule
 *
 * Read-only banner that confirms whether a product is Manufactured / Recipe-based
 * or Ready-to-Sell. Extracted from inventory/add.tsx so the same badge can be
 * reused on the item detail screen and the tablet detail summary.
 *
 * Dark mode is resolved internally via `useThemeMode()`; callers only pass the
 * product type (and optionally a layout style).
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ChefHat, ShoppingBag } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { ProductType } from '@/types';

export interface ProductTypeBadgeProps {
  productType: ProductType;
  style?:      StyleProp<ViewStyle>;
}

export const ProductTypeBadge: React.FC<ProductTypeBadgeProps> = ({ productType, style }) => {
  const isDark = useThemeMode() === 'dark';
  const isManufactured = productType === 'manufactured';

  const accent = isDark
    ? (isManufactured ? '#3DD68C' : '#4F9EFF')
    : (isManufactured ? staticTheme.colors.success[500] : staticTheme.colors.primary[500]);
  const label     = isManufactured ? 'Manufactured / Recipe-based' : 'Ready-to-Sell';
  const sublabel  = isManufactured ? 'BOM and ingredient tracking enabled' : 'No recipe required';
  const BadgeIcon = isManufactured ? ChefHat : ShoppingBag;

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: isDark ? `${accent}10` : `${accent}09`,
        borderColor:     isDark ? `${accent}28` : `${accent}22`,
      },
      style,
    ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
        <BadgeIcon size={18} color={accent} />
      </View>
      <View style={styles.textGroup}>
        <Text
          variant="body-sm"
          weight="semibold"
          style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }}
        >
          {label}
        </Text>
        <Text
          variant="body-xs"
          style={{ color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500] }}
        >
          {sublabel}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
    borderRadius:  staticTheme.borderRadius.xl,
    borderWidth:   1,
    padding:       staticTheme.spacing.sm,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   staticTheme.borderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  textGroup: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
});
