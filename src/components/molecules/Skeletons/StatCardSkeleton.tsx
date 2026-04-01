/**
 * StatCardSkeleton — skeleton for the 4-up stat tile row used on
 * the Inventory overview, Raw Materials list, and Dashboard.
 *
 * Matches StatCard shape: icon pill + label line + value line.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';

export interface StatCardSkeletonProps {
  count?: number; // default 4
}

const StatTile: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <View style={[styles.tile, { backgroundColor: bg, borderColor: border }]}>
      <SkeletonBox width={28} height={28} borderRadius={9} />
      <SkeletonBox width="70%" height={10} borderRadius={5} />
      <SkeletonBox width="55%" height={14} borderRadius={6} />
    </View>
  );
};

export const StatCardSkeleton: React.FC<StatCardSkeletonProps> = ({ count = 4 }) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <StatTile key={i} isDark={isDark} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    gap:              6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:       staticTheme.spacing.sm,
    paddingBottom:    staticTheme.spacing.xs,
  },
  tile: {
    flex:         1,
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.sm,
    gap:          4,
    alignItems:   'flex-start',
    minWidth:     72,
  },
});
