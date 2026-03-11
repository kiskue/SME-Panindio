import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { LoadingSpinner } from './LoadingSpinner';
import { Text } from '../atoms/Text';

export default {
  title: 'Molecules/LoadingSpinner',
  component: LoadingSpinner,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:       { control: { type: 'select' }, options: ['small', 'large'] },
    color:      { control: 'color' },
    text:       { control: 'text' },
    fullScreen: { control: 'boolean' },
    overlay:    { control: 'boolean' },
  },
};

const Template = (args: React.ComponentProps<typeof LoadingSpinner>) => (
  <View style={styles.centeredBox}>
    <LoadingSpinner {...args} />
  </View>
);

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  size: 'large',
  color: theme.colors.primary[500],
  text: '',
  fullScreen: false,
  overlay: false,
};

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const SizeSmall = Template.bind({});
(SizeSmall as any).args = { size: 'small' };

export const SizeLarge = Template.bind({});
(SizeLarge as any).args = { size: 'large' };

// ─── With label ──────────────────────────────────────────────────────────────
export const WithText = Template.bind({});
(WithText as any).args = { size: 'large', text: 'Loading data…' };

export const SmallWithText = Template.bind({});
(SmallWithText as any).args = { size: 'small', text: 'Please wait…' };

// ─── Colors ──────────────────────────────────────────────────────────────────
export const ColorPrimary = Template.bind({});
(ColorPrimary as any).args = { color: theme.colors.primary[500], text: 'Syncing…' };

export const ColorSuccess = Template.bind({});
(ColorSuccess as any).args = { color: theme.colors.success[500], text: 'Saving…' };

export const ColorWarning = Template.bind({});
(ColorWarning as any).args = { color: theme.colors.warning[500], text: 'Processing…' };

export const ColorError = Template.bind({});
(ColorError as any).args = { color: theme.colors.error[500], text: 'Retrying…' };

// ─── Overlay mode ────────────────────────────────────────────────────────────
// Rendered inside a bounded container so the absolute overlay is visible.
export const OverlayMode = () => (
  <View style={styles.overlayContainer}>
    <Text variant="body" color="gray" align="center">Background content here</Text>
    <Text variant="body-sm" color="gray" align="center" style={{ marginTop: 4 }}>
      The spinner renders as a frosted card above this.
    </Text>
    <LoadingSpinner overlay text="Processing…" />
  </View>
);

// ─── Composites ──────────────────────────────────────────────────────────────
export const AllSizes = () => (
  <View style={styles.row}>
    {(['small', 'large'] as const).map(s => (
      <View key={s} style={styles.sizeItem}>
        <Text variant="caption" color="gray" align="center" style={styles.label}>{s}</Text>
        <LoadingSpinner size={s} />
      </View>
    ))}
  </View>
);

export const AllColors = () => (
  <View style={styles.colorList}>
    {([
      { label: 'primary',   color: theme.colors.primary[500] },
      { label: 'secondary', color: theme.colors.secondary[500] },
      { label: 'success',   color: theme.colors.success[500] },
      { label: 'warning',   color: theme.colors.warning[500] },
      { label: 'error',     color: theme.colors.error[500] },
      { label: 'gray',      color: theme.colors.gray[400] },
    ] as const).map(({ label, color }) => (
      <View key={label} style={styles.colorRow}>
        <Text variant="caption" color="gray" style={styles.colorLabel}>{label}</Text>
        <LoadingSpinner size="small" color={color} text={`${label} spinner`} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator:       { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1, gap: theme.spacing.md },
  centeredBox:     { alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg },
  overlayContainer:{
    height: 200,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  row:        { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl, padding: theme.spacing.lg },
  sizeItem:   { alignItems: 'center' },
  label:      { marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  colorList:  { gap: theme.spacing.md },
  colorRow:   { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  colorLabel: { width: 80 },
});
