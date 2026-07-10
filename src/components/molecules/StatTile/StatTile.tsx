/**
 * StatTile — molecule
 *
 * A modern bento-style metric tile. Generalizes the inline `StatCard` from the
 * inventory overview and the ROI-specific `ROIMetricTile` into one reusable
 * component used across dashboards.
 *
 * Variants:
 *   - 'compact' — icon chip + value + label (the bento stat cells).
 *   - 'hero'    — large value + label + optional sub-value (the headline tile).
 *
 * Dark-mode depth follows the Card discipline: surface + 1px border, never a
 * shadow on an overflow-hidden node (getElevation returns {} in dark).
 *
 * TypeScript: exactOptionalPropertyTypes (conditional spread, no `prop:undefined`),
 * noUncheckedIndexedAccess, noUnusedLocals all honored.
 */

import React from 'react';
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode, getElevation } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

export interface StatTileProps {
  label: string;
  value: string;
  /** Already-colored icon node (e.g. <Layers color={accent} />). */
  icon?: React.ReactNode;
  /** Accent for the icon chip + value text. Defaults to the brand primary tint. */
  accentColor?: string;
  /** Secondary line below the value (hero variant). */
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'hero' | 'compact';
  /** Tinted background + accent border to make the tile stand out. */
  highlight?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const withAlpha = (hex: string, alpha: string): string =>
  hex.startsWith('#') && hex.length === 7 ? `${hex}${alpha}` : hex;

export const StatTile: React.FC<StatTileProps> = React.memo(
  ({ label, value, icon, accentColor, subValue, trend, variant = 'compact', highlight = false, onPress, style }) => {
    const theme  = useAppTheme();
    const mode   = useThemeMode();
    const isDark = mode === 'dark';
    const isHero = variant === 'hero';

    const accent = accentColor ?? theme.colors.tintPrimary;

    const bg = highlight
      ? withAlpha(accent, isDark ? '1A' : '12')
      : theme.colors.surface;
    const borderColor = highlight ? withAlpha(accent, isDark ? '45' : '40') : theme.colors.borderSubtle;
    const borderWidth = highlight ? 1.5 : 1;

    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor =
      trend === 'up'   ? theme.colors.success[500] :
      trend === 'down' ? theme.colors.error[500]   :
      theme.colors.gray[400];

    const body = (
      <View
        style={[
          styles.tile,
          isHero ? styles.heroPad : styles.compactPad,
          { backgroundColor: bg, borderColor, borderWidth },
          getElevation('sm', mode),
          style,
        ]}
      >
        <View style={styles.topRow}>
          {icon !== undefined && (
            <View style={[styles.iconChip, isHero && styles.iconChipHero, { backgroundColor: withAlpha(accent, isDark ? '24' : '1A') }]}>
              {icon}
            </View>
          )}
          {trend !== undefined && (
            <View style={[styles.trendPill, { backgroundColor: withAlpha(trendColor, '1A') }]}>
              <TrendIcon size={12} color={trendColor} />
            </View>
          )}
        </View>

        <Text
          variant={isHero ? 'h2' : 'h5'}
          weight="bold"
          style={{ color: accent }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>

        <Text variant="body-xs" weight="medium" style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
          {label}
        </Text>

        {subValue !== undefined && (
          <Text variant="body-xs" style={{ color: theme.colors.textSecondary, opacity: 0.8, marginTop: 2 }} numberOfLines={1}>
            {subValue}
          </Text>
        )}
      </View>
    );

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.pressWrap, pressed && pressedStyle]}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
        >
          {body}
        </Pressable>
      );
    }

    return body;
  },
);

StatTile.displayName = 'StatTile';

const pressedStyle = { opacity: 0.85, transform: [{ scale: 0.985 }] } as const;

const styles = StyleSheet.create({
  pressWrap: { flex: 1 },
  tile: {
    flex: 1,
    borderRadius: staticTheme.borderRadius['2xl'],
    gap: 6,
    justifyContent: 'center',
  },
  heroPad:    { padding: staticTheme.spacing.md, gap: 8 },
  compactPad: { padding: staticTheme.spacing.sm + 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipHero: {
    width: 42,
    height: 42,
    borderRadius: 13,
  },
  trendPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
