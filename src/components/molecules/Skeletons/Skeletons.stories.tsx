import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { theme } from '../../../core/theme';
import { CardRowSkeleton } from './CardRowSkeleton';
import { StatCardSkeleton } from './StatCardSkeleton';
import { DashboardSkeleton } from './DashboardSkeleton';
import { FormSkeleton } from './FormSkeleton';
import { InventoryListSkeleton } from './InventoryListSkeleton';
import { Text } from '../../atoms/Text';

export default {
  title: 'Molecules/Skeletons',
};

const wrap = (children: React.ReactNode) => (
  <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
);

const SectionLabel = ({ label }: { label: string }) => (
  <Text variant="h5" style={styles.sectionLabel}>{label}</Text>
);

// ─── CardRowSkeleton ──────────────────────────────────────────────────────────

export const CardRowDefault = () => wrap(
  <>
    <SectionLabel label="CardRowSkeleton — 6 rows (default)" />
    <CardRowSkeleton />
  </>,
);

export const CardRowFew = () => wrap(
  <>
    <SectionLabel label="CardRowSkeleton — 3 rows" />
    <CardRowSkeleton count={3} />
  </>,
);

// ─── StatCardSkeleton ─────────────────────────────────────────────────────────

export const StatCardDefault = () => wrap(
  <>
    <SectionLabel label="StatCardSkeleton — 4 tiles (default)" />
    <StatCardSkeleton />
  </>,
);

export const StatCardThree = () => wrap(
  <>
    <SectionLabel label="StatCardSkeleton — 3 tiles" />
    <StatCardSkeleton count={3} />
  </>,
);

// ─── FormSkeleton ─────────────────────────────────────────────────────────────

export const FormDefault = () => wrap(
  <>
    <SectionLabel label="FormSkeleton — 3 sections" />
    <FormSkeleton />
  </>,
);

export const FormLarge = () => wrap(
  <>
    <SectionLabel label="FormSkeleton — 5 sections, 3 inputs each" />
    <FormSkeleton sections={5} inputsPerSection={3} />
  </>,
);

// ─── DashboardSkeleton ────────────────────────────────────────────────────────

export const DashboardDefault = () => wrap(
  <>
    <SectionLabel label="DashboardSkeleton" />
    <DashboardSkeleton />
  </>,
);

// ─── InventoryListSkeleton ────────────────────────────────────────────────────

export const InventoryListDefault = () => wrap(
  <>
    <SectionLabel label="InventoryListSkeleton" />
    <InventoryListSkeleton />
  </>,
);

const styles = StyleSheet.create({
  page: {
    padding:         theme.spacing.md,
    backgroundColor: '#fff',
    flexGrow:        1,
    gap:             theme.spacing.xl,
  },
  sectionLabel: {
    color:         theme.colors.gray[700],
    marginBottom:  theme.spacing.xs,
  },
});
