/**
 * CategoryTile — molecule
 *
 * Bento-grid navigation cell for inventory categories. Extracted and redesigned
 * from the inline `CategoryNavCard` in the inventory overview.
 *
 * Variants:
 *   - 'grid' — vertical bento cell (icon chip + count, label, subtitle). Used in
 *     the responsive category grid on the overview.
 *   - 'row'  — horizontal row (icon chip, label/subtitle, count, chevron). The
 *     legacy compact look, kept for narrow / list contexts.
 *
 * Colors (accent + icon background) are resolved by the caller via
 * `getInventoryAccent()` so there is a single source of truth.
 */

import React from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode, getElevation } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

export interface CategoryTileProps {
  label: string;
  subtitle?: string;
  count: number;
  accentColor: string;
  iconBg: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  variant?: 'grid' | 'row';
  style?: StyleProp<ViewStyle>;
}

const withAlpha = (hex: string, alpha: string): string =>
  hex.startsWith('#') && hex.length === 7 ? `${hex}${alpha}` : hex;

export const CategoryTile: React.FC<CategoryTileProps> = React.memo(
  ({ label, subtitle, count, accentColor, iconBg, Icon, onPress, variant = 'grid', style }) => {
    const theme  = useAppTheme();
    const mode   = useThemeMode();
    const isDark = mode === 'dark';
    const isGrid = variant === 'grid';

    const containerStyle = {
      backgroundColor: theme.colors.surface,
      borderColor: withAlpha(accentColor, isDark ? '2E' : '26'),
    };

    const CountPill = (
      <View style={[styles.countPill, { backgroundColor: withAlpha(accentColor, isDark ? '24' : '18'), borderColor: withAlpha(accentColor, isDark ? '33' : '28') }]}>
        <Text variant="body-xs" weight="bold" style={{ color: accentColor }}>{count}</Text>
      </View>
    );

    const IconChip = (
      <View style={[styles.iconChip, isGrid && styles.iconChipGrid, { backgroundColor: iconBg }]}>
        <Icon size={isGrid ? 22 : 20} color={accentColor} />
      </View>
    );

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          isGrid ? styles.gridCard : styles.rowCard,
          containerStyle,
          getElevation('sm', mode),
          pressed && pressedStyle,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${label}, ${count} item${count === 1 ? '' : 's'}`}
      >
        {isGrid ? (
          <>
            <View style={styles.gridTop}>
              {IconChip}
              {CountPill}
            </View>
            <View style={styles.gridText}>
              <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }} numberOfLines={1}>
                {label}
              </Text>
              {subtitle !== undefined && (
                <Text variant="body-xs" style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
          </>
        ) : (
          <>
            {IconChip}
            <View style={styles.rowTextGroup}>
              <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.text }} numberOfLines={1}>
                {label}
              </Text>
              {subtitle !== undefined && (
                <Text variant="body-xs" style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>
            {CountPill}
            <ChevronRight size={14} color={isDark ? theme.colors.textSecondary : accentColor} />
          </>
        )}
      </Pressable>
    );
  },
);

CategoryTile.displayName = 'CategoryTile';

const pressedStyle = { opacity: 0.82, transform: [{ scale: 0.985 }] } as const;

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    borderRadius: staticTheme.borderRadius['2xl'],
    borderWidth: 1,
    padding: staticTheme.spacing.md - 2,
    gap: staticTheme.spacing.sm + 2,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 12,
    gap: staticTheme.spacing.sm,
  },
  gridTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridText: { gap: 2, minWidth: 0 },
  rowTextGroup: { flex: 1, gap: 2, minWidth: 0 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconChipGrid: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  countPill: {
    borderRadius: staticTheme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
    flexShrink: 0,
  },
});
