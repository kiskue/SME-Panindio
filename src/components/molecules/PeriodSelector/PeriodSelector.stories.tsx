/**
 * PeriodSelector stories
 *
 * NOTE: This file is excluded from tsconfig (`storybook` directory rules).
 * TypeScript errors shown by the IDE here are expected — ignore them.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { PeriodSelector } from './PeriodSelector';
import type { DashboardPeriod } from '@/types';

export default {
  title:     'Molecules/PeriodSelector',
  component: PeriodSelector,
  argTypes: {
    period: {
      control: { type: 'select' },
      options: ['day', 'week', 'month', 'year'],
    },
    isDark: { control: 'boolean' },
  },
};

// ── Controlled wrapper used by most stories ────────────────────────────────────

const Controlled = ({ isDark = false, initial = 'day' as DashboardPeriod }) => {
  const [period, setPeriod] = useState<DashboardPeriod>(initial);
  return (
    <View style={[s.container, isDark ? s.darkBg : s.lightBg]}>
      <PeriodSelector period={period} onSelect={setPeriod} isDark={isDark} />
    </View>
  );
};

// ── Stories ───────────────────────────────────────────────────────────────────

/** Standard light-mode usage — tap pills to change selection. */
export const Default = () => <Controlled isDark={false} initial="month" />;

/** Dark-mode appearance. */
export const DarkMode = () => <Controlled isDark={true} initial="month" />;

/** All four active states shown side-by-side for visual comparison. */
export const AllActiveStates = () => (
  <View style={[s.column, s.lightBg]}>
    {(['day', 'week', 'month', 'year'] as DashboardPeriod[]).map(p => (
      <View key={p} style={s.container}>
        <PeriodSelector period={p} onSelect={() => {}} isDark={false} />
      </View>
    ))}
  </View>
);

/** All four active states in dark mode. */
export const AllActiveStatesDark = () => (
  <View style={[s.column, s.darkBg]}>
    {(['day', 'week', 'month', 'year'] as DashboardPeriod[]).map(p => (
      <View key={p} style={s.container}>
        <PeriodSelector period={p} onSelect={() => {}} isDark={true} />
      </View>
    ))}
  </View>
);

/** Playground — controls wired via argTypes. */
export const Playground = (args: { period: DashboardPeriod; isDark: boolean }) => (
  <View style={[s.container, args.isDark ? s.darkBg : s.lightBg]}>
    <PeriodSelector
      period={args.period}
      onSelect={() => {}}
      isDark={args.isDark}
    />
  </View>
);
(Playground as any).args = { period: 'month', isDark: false };

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { padding: 16 },
  lightBg:   { backgroundColor: '#F8F9FA' },
  darkBg:    { backgroundColor: '#0F0F14' },
  column:    { gap: 2 },
});
