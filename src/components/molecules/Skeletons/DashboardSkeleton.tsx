/**
 * DashboardSkeleton — skeleton for the ERP Dashboard home screen.
 *
 * Matches the layout sections in index.tsx:
 *   1. Period selector pill strip
 *   2. KPI card row (2×2 grid)
 *   3. Net Profit banner
 *   4. Trend chart area
 *   5. Quick Actions row
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { useThemeStore, selectThemeMode } from '@/store';
import { theme as staticTheme } from '@/core/theme';

const KPICard: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <View style={[kpiStyles.card, { backgroundColor: bg, borderColor: border }]}>
      {/* Left accent bar */}
      <View style={[kpiStyles.accentBar, { backgroundColor: isDark ? '#2A3347' : staticTheme.colors.gray[200] }]} />
      <View style={kpiStyles.inner}>
        <SkeletonBox width={28} height={28} borderRadius={8} />
        <View style={kpiStyles.textGroup}>
          <SkeletonBox width="70%" height={10} borderRadius={5} />
          <SkeletonBox width="55%" height={16} borderRadius={6} />
        </View>
      </View>
    </View>
  );
};

const QuickActionTile: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const bg     = isDark ? '#1A2235' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <View style={[qaStyles.tile, { backgroundColor: bg, borderColor: border }]}>
      <SkeletonBox width={36} height={36} borderRadius={10} />
      <SkeletonBox width={48} height={10} borderRadius={5} />
    </View>
  );
};

export const DashboardSkeleton: React.FC = () => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  const sectionBg = isDark ? '#1A2235' : '#FFFFFF';
  const secBorder = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Period selector strip */}
      <View style={styles.periodRow}>
        {['Day', 'Week', 'Month', 'Year'].map((_, i) => (
          <SkeletonBox key={i} width={64} height={32} borderRadius={16} />
        ))}
      </View>

      {/* KPI 2×2 grid */}
      <View style={styles.kpiGrid}>
        <KPICard isDark={isDark} />
        <KPICard isDark={isDark} />
        <KPICard isDark={isDark} />
        <KPICard isDark={isDark} />
      </View>

      {/* Net profit banner */}
      <View style={[styles.banner, { backgroundColor: sectionBg, borderColor: secBorder }]}>
        <SkeletonBox width="40%" height={12} borderRadius={5} />
        <SkeletonBox width="60%" height={28} borderRadius={8} />
        <SkeletonBox width="80%" height={11} borderRadius={5} />
      </View>

      {/* Trend chart */}
      <View style={[styles.chart, { backgroundColor: sectionBg, borderColor: secBorder }]}>
        <SkeletonBox width="40%" height={12} borderRadius={5} />
        <View style={styles.chartBars}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonBox
              key={i}
              width={24}
              height={Math.max(20, 50 - i * 5)}
              borderRadius={4}
            />
          ))}
        </View>
      </View>

      {/* Quick actions row */}
      <View style={styles.qaRow}>
        {[0, 1, 2, 3].map((i) => <QuickActionTile key={i} isDark={isDark} />)}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    gap:               staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.xl,
  },
  periodRow: {
    flexDirection:  'row',
    gap:             staticTheme.spacing.sm,
    justifyContent: 'space-between',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            staticTheme.spacing.sm,
  },
  banner: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.md,
    gap:          staticTheme.spacing.sm,
  },
  chart: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.md,
    gap:          staticTheme.spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           8,
    height:        60,
  },
  qaRow: {
    flexDirection:  'row',
    gap:             staticTheme.spacing.sm,
    justifyContent: 'space-between',
  },
});

const kpiStyles = StyleSheet.create({
  card: {
    width:        '48%',
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    flexDirection: 'row',
    overflow:     'hidden',
  },
  accentBar: {
    width:  3,
    alignSelf: 'stretch',
  },
  inner: {
    flex:    1,
    padding: staticTheme.spacing.sm,
    gap:     staticTheme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textGroup: {
    flex: 1,
    gap:  5,
    paddingTop: 2,
  },
});

const qaStyles = StyleSheet.create({
  tile: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    padding:        staticTheme.spacing.sm,
    gap:            staticTheme.spacing.xs,
  },
});
