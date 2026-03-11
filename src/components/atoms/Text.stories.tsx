import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Text',
  component: Text,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    children: { control: 'text' },
    variant: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'body-xs', 'caption'],
    },
    weight: {
      control: { type: 'select' },
      options: ['light', 'normal', 'medium', 'semibold', 'bold'],
    },
    color: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'gray', 'error', 'warning', 'success', 'info'],
    },
    align: {
      control: { type: 'select' },
      options: ['left', 'center', 'right', 'justify'],
    },
  },
};

const Template = (args: React.ComponentProps<typeof Text>) => <Text {...args} />;

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  children: 'The quick brown fox jumps over the lazy dog.',
  variant: 'body',
  weight: 'normal',
  color: 'gray',
  align: 'left',
};

// ─── Heading scale ───────────────────────────────────────────────────────────
export const H1 = Template.bind({});
(H1 as any).args = { children: 'Heading 1 — Large Hero', variant: 'h1', weight: 'bold', color: 'gray' };

export const H2 = Template.bind({});
(H2 as any).args = { children: 'Heading 2 — Section Title', variant: 'h2', weight: 'bold', color: 'gray' };

export const H3 = Template.bind({});
(H3 as any).args = { children: 'Heading 3 — Sub-section', variant: 'h3', weight: 'semibold', color: 'gray' };

export const H4 = Template.bind({});
(H4 as any).args = { children: 'Heading 4 — Card Title', variant: 'h4', weight: 'semibold', color: 'gray' };

export const H5 = Template.bind({});
(H5 as any).args = { children: 'Heading 5 — List Title', variant: 'h5', weight: 'medium', color: 'gray' };

export const H6 = Template.bind({});
(H6 as any).args = { children: 'Heading 6 — Label', variant: 'h6', weight: 'medium', color: 'gray' };

// ─── Body scale ──────────────────────────────────────────────────────────────
export const Body = Template.bind({});
(Body as any).args = { children: 'Body — standard reading size for primary content.', variant: 'body', color: 'gray' };

export const BodySmall = Template.bind({});
(BodySmall as any).args = { children: 'Body Small — secondary descriptions and metadata.', variant: 'body-sm', color: 'gray' };

export const BodyXS = Template.bind({});
(BodyXS as any).args = { children: 'Body XS — fine print, legal text, footnotes.', variant: 'body-xs', color: 'gray' };

export const Caption = Template.bind({});
(Caption as any).args = { children: 'Caption — timestamps, tags, compact labels', variant: 'caption', color: 'gray' };

// ─── Weights ─────────────────────────────────────────────────────────────────
export const WeightLight = Template.bind({});
(WeightLight as any).args = { children: 'Light weight (300)', variant: 'body', weight: 'light', color: 'gray' };

export const WeightNormal = Template.bind({});
(WeightNormal as any).args = { children: 'Normal weight (400)', variant: 'body', weight: 'normal', color: 'gray' };

export const WeightMedium = Template.bind({});
(WeightMedium as any).args = { children: 'Medium weight (500)', variant: 'body', weight: 'medium', color: 'gray' };

export const WeightSemibold = Template.bind({});
(WeightSemibold as any).args = { children: 'Semibold weight (600)', variant: 'body', weight: 'semibold', color: 'gray' };

export const WeightBold = Template.bind({});
(WeightBold as any).args = { children: 'Bold weight (700)', variant: 'body', weight: 'bold', color: 'gray' };

// ─── Colors ──────────────────────────────────────────────────────────────────
export const ColorPrimary = Template.bind({});
(ColorPrimary as any).args = { children: 'Primary color text', variant: 'body', weight: 'medium', color: 'primary' };

export const ColorError = Template.bind({});
(ColorError as any).args = { children: 'Error color text', variant: 'body', weight: 'medium', color: 'error' };

export const ColorSuccess = Template.bind({});
(ColorSuccess as any).args = { children: 'Success color text', variant: 'body', weight: 'medium', color: 'success' };

export const ColorWarning = Template.bind({});
(ColorWarning as any).args = { children: 'Warning color text', variant: 'body', weight: 'medium', color: 'warning' };

// ─── Alignment ───────────────────────────────────────────────────────────────
export const AlignCenter = Template.bind({});
(AlignCenter as any).args = { children: 'Centered text — great for titles and hero copy', variant: 'body', align: 'center', color: 'gray' };

export const AlignRight = Template.bind({});
(AlignRight as any).args = { children: 'Right-aligned — use for numbers and metadata', variant: 'body', align: 'right', color: 'gray' };

// ─── Composites ──────────────────────────────────────────────────────────────
export const TypographicScale = () => (
  <View style={styles.column}>
    {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'body-xs', 'caption'] as const).map(v => (
      <View key={v} style={styles.row}>
        <Text variant="caption" color="gray" style={styles.tag}>{v}</Text>
        <Text variant={v} color="gray">The quick brown fox</Text>
      </View>
    ))}
  </View>
);

export const WeightScale = () => (
  <View style={styles.column}>
    {(['light', 'normal', 'medium', 'semibold', 'bold'] as const).map(w => (
      <View key={w} style={styles.row}>
        <Text variant="caption" color="gray" style={styles.tag}>{w}</Text>
        <Text variant="body" weight={w} color="gray">The quick brown fox jumps over the lazy dog.</Text>
      </View>
    ))}
  </View>
);

export const ColorPalette = () => (
  <View style={styles.column}>
    {(['primary', 'secondary', 'gray', 'error', 'warning', 'success', 'info'] as const).map(c => (
      <View key={c} style={styles.row}>
        <Text variant="caption" color="gray" style={styles.tag}>{c}</Text>
        <Text variant="body" weight="medium" color={c}>{c} — sample text</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column:    { gap: theme.spacing.md },
  row:       { gap: theme.spacing.xs },
  tag:       { textTransform: 'uppercase', letterSpacing: 0.5 },
});
