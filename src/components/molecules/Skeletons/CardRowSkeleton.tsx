/**
 * CardRowSkeleton — skeleton for a generic list card row.
 *
 * Matches the shape of InventoryItemCard / RawMaterialCard / CreditCard etc:
 *   [ icon pill (44×44) ] [ title line (60%) / subtitle line (40%) ] [ value (30%) ]
 *
 * Render count is configurable (default 6) to fill the visible viewport and
 * avoid layout shift when real data arrives.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';

export interface CardRowSkeletonProps {
  count?: number;
}

const CARD_HEIGHT   = 76;
const ICON_SIZE     = 44;
const CARD_GAP      = staticTheme.spacing.sm;

const CardRowItem: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const cardBg     = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100];

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Left accent bar */}
      <SkeletonBox width={3} height={CARD_HEIGHT} borderRadius={2} style={styles.accentBar} />
      {/* Icon pill */}
      <SkeletonBox width={ICON_SIZE} height={ICON_SIZE} borderRadius={12} />
      {/* Text group */}
      <View style={styles.textGroup}>
        <SkeletonBox width="62%" height={14} borderRadius={6} />
        <SkeletonBox width="38%" height={11} borderRadius={5} />
      </View>
      {/* Right value + chevron */}
      <View style={styles.rightGroup}>
        <SkeletonBox width={52} height={13} borderRadius={5} />
        <SkeletonBox width={24} height={11} borderRadius={5} />
      </View>
    </View>
  );
};

export const CardRowSkeleton: React.FC<CardRowSkeletonProps> = ({ count = 6 }) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  return (
    <View style={[styles.root, { gap: CARD_GAP }]}>
      {Array.from({ length: count }).map((_, i) => (
        <CardRowItem key={i} isDark={isDark} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
  },
  card: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    paddingVertical: 14,
    paddingRight:   staticTheme.spacing.md,
    height:         CARD_HEIGHT,
    overflow:       'hidden',
    gap:            staticTheme.spacing.sm,
  },
  accentBar: {
    borderRadius: 0,
    marginRight:  staticTheme.spacing.sm,
    flexShrink:   0,
  },
  textGroup: {
    flex:    1,
    gap:     6,
    minWidth: 0,
  },
  rightGroup: {
    alignItems: 'flex-end',
    gap:        6,
    flexShrink: 0,
  },
});
