import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { LoadingSpinner } from './LoadingSpinner';
import { Text } from '../atoms/Text';

export default {
  title: 'Molecules/LoadingSpinner',
  component: LoadingSpinner,
  argTypes: {
    size:      { control: { type: 'select' }, options: ['small', 'large'] },
    variant:   { control: { type: 'select' }, options: ['dots', 'ring'] },
    color:     { control: 'color' },
    text:      { control: 'text' },
    fullScreen:{ control: 'boolean' },
    overlay:   { control: 'boolean' },
  },
};

const wrap = (children: React.ReactNode) => (
  <ScrollView contentContainerStyle={styles.page}>{children}</ScrollView>
);

// ─── Playground ───────────────────────────────────────────────────────────────

const PlaygroundTemplate = (args: React.ComponentProps<typeof LoadingSpinner>) => (
  <View style={styles.centeredBox}>
    <LoadingSpinner {...args} />
  </View>
);

export const Playground = PlaygroundTemplate.bind({});
(Playground as any).args = {
  size:    'large',
  variant: 'dots',
  color:   theme.colors.primary[500],
  text:    '',
  fullScreen: false,
  overlay:    false,
};

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default = () => wrap(
  <View style={styles.centeredBox}>
    <LoadingSpinner size="large" variant="dots" />
  </View>,
);

// ─── Sizes ───────────────────────────────────────────────────────────────────

export const DifferentSizes = () => wrap(
  <View style={styles.row}>
    <View style={styles.col}>
      <Text variant="caption" align="center" style={styles.label}>Small</Text>
      <LoadingSpinner size="small" variant="dots" />
    </View>
    <View style={styles.col}>
      <Text variant="caption" align="center" style={styles.label}>Large</Text>
      <LoadingSpinner size="large" variant="dots" />
    </View>
  </View>,
);

// ─── With label ──────────────────────────────────────────────────────────────

export const WithText = () => wrap(
  <View style={styles.centeredBox}>
    <LoadingSpinner size="large" text="Loading data…" />
  </View>,
);

// ─── Ring variant (compact ActivityIndicator for tight spaces) ────────────────

export const RingVariant = () => wrap(
  <View style={styles.row}>
    <View style={styles.col}>
      <Text variant="caption" align="center" style={styles.label}>Ring Small</Text>
      <LoadingSpinner size="small" variant="ring" />
    </View>
    <View style={styles.col}>
      <Text variant="caption" align="center" style={styles.label}>Ring Large</Text>
      <LoadingSpinner size="large" variant="ring" />
    </View>
  </View>,
);

// ─── Colors ──────────────────────────────────────────────────────────────────

export const Colors = () => wrap(
  <View style={styles.colorList}>
    {([
      { label: 'primary',   color: theme.colors.primary[500] },
      { label: 'success',   color: theme.colors.success[500] },
      { label: 'warning',   color: theme.colors.warning[500] },
      { label: 'error',     color: theme.colors.error[500] },
      { label: 'secondary', color: theme.colors.secondary[500] },
    ] as const).map(({ label, color }) => (
      <View key={label} style={styles.colorRow}>
        <Text variant="caption" style={styles.colorLabel}>{label}</Text>
        <LoadingSpinner size="small" color={color} text={`${label} dots`} />
      </View>
    ))}
  </View>,
);

// ─── Overlay ─────────────────────────────────────────────────────────────────

export const Overlay = () => (
  <View style={styles.overlayContainer}>
    <Text variant="body" align="center">Background content here</Text>
    <Text variant="body-sm" align="center" style={{ marginTop: 4, color: theme.colors.gray[500] }}>
      Overlay dims background and shows centred dots card.
    </Text>
    <LoadingSpinner overlay text="Processing…" />
  </View>
);

// ─── Loading state ────────────────────────────────────────────────────────────

export const Loading = () => wrap(
  <View style={styles.centeredBox}>
    <LoadingSpinner size="large" text="Loading…" />
  </View>,
);

// ─── Disabled / Error states don't apply to a spinner — show N/A ─────────────

export const Disabled = () => wrap(
  <View style={styles.centeredBox}>
    <Text variant="body-sm" style={{ color: theme.colors.gray[400] }}>
      Spinners have no disabled state — hide them instead (visible prop pattern).
    </Text>
  </View>,
);

export const Error = () => wrap(
  <View style={styles.centeredBox}>
    <LoadingSpinner size="large" color={theme.colors.error[500]} text="Retrying…" />
  </View>,
);

const styles = StyleSheet.create({
  page:           { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1, gap: theme.spacing.lg },
  centeredBox:    { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  row:            { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl, padding: theme.spacing.lg },
  col:            { alignItems: 'center', gap: theme.spacing.sm },
  label:          { color: theme.colors.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  colorList:      { gap: theme.spacing.md, padding: theme.spacing.md },
  colorRow:       { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  colorLabel:     { width: 80, color: theme.colors.gray[600] },
  overlayContainer: {
    height:          220,
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius:    theme.borderRadius.lg,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         theme.spacing.md,
    overflow:        'hidden',
  },
});
