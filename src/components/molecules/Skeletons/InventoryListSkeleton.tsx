/**
 * InventoryListSkeleton — skeleton for the inventory overview screen.
 *
 * Matches the exact layout of inventory/index.tsx:
 *   1. Stats row (4 tiles)
 *   2. Category nav strip (3 horizontal cards)
 *   3. Search bar
 *   4. Card rows
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { StatCardSkeleton } from './StatCardSkeleton';
import { CardRowSkeleton } from './CardRowSkeleton';
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';

const CategoryNavSkeleton: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100];

  return (
    <View style={[catStyles.card, { backgroundColor: bg, borderColor: border }]}>
      <SkeletonBox width={40} height={40} borderRadius={20} />
      <View style={catStyles.text}>
        <SkeletonBox width="65%" height={13} borderRadius={5} />
        <SkeletonBox width="45%" height={10} borderRadius={5} />
      </View>
      <SkeletonBox width={26} height={20} borderRadius={10} />
    </View>
  );
};

export const InventoryListSkeleton: React.FC = () => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  return (
    <View style={styles.root}>
      {/* Stats row */}
      <StatCardSkeleton count={4} />

      {/* Category nav horizontal strip */}
      <View style={styles.catSection}>
        {/* Section label */}
        <SkeletonBox width="50%" height={10} borderRadius={5} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
          scrollEnabled={false}
        >
          {[0, 1, 2].map((i) => <CategoryNavSkeleton key={i} isDark={isDark} />)}
        </ScrollView>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <SkeletonBox width="100%" height={44} borderRadius={staticTheme.borderRadius.lg} />
      </View>

      {/* Card list */}
      <CardRowSkeleton count={6} />
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1 },
  catSection: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     staticTheme.spacing.xs,
    gap:               staticTheme.spacing.xs,
  },
  catScroll: {
    gap:         staticTheme.spacing.sm,
    paddingRight: staticTheme.spacing.md,
  },
  searchWrap: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.xs,
  },
});

const catStyles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    borderRadius:    staticTheme.borderRadius.xl,
    borderWidth:     1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 12,
    gap:             staticTheme.spacing.sm,
    width:           220,
  },
  text: {
    flex: 1,
    gap:  4,
    minWidth: 0,
  },
});
