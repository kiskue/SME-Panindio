import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { theme } from '../../../core/theme';

const noop = () => {};

export default {
  title: 'Atoms/Button',
  component: Button,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    title:   { control: 'text' },
    variant: { control: { type: 'select' }, options: ['primary', 'secondary', 'outline', 'ghost'] },
    size:    { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    disabled:  { control: 'boolean' },
    loading:   { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    onPress: { action: 'pressed' },
  },
};

// ─── Interactive template ─────────────────────────────────────────────────────
const Template = (args: React.ComponentProps<typeof Button>) => <Button {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = {
  title: 'Button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  onPress: noop,
};

// ─── Variants ────────────────────────────────────────────────────────────────
export const Primary = Template.bind({});
(Primary as any).args = { title: 'Primary', variant: 'primary', onPress: noop };

export const Secondary = Template.bind({});
(Secondary as any).args = { title: 'Secondary', variant: 'secondary', onPress: noop };

export const Outline = Template.bind({});
(Outline as any).args = { title: 'Outline', variant: 'outline', onPress: noop };

export const Ghost = Template.bind({});
(Ghost as any).args = { title: 'Ghost', variant: 'ghost', onPress: noop };

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const Small = Template.bind({});
(Small as any).args = { title: 'Small', size: 'sm', onPress: noop };

export const Medium = Template.bind({});
(Medium as any).args = { title: 'Medium', size: 'md', onPress: noop };

export const Large = Template.bind({});
(Large as any).args = { title: 'Large', size: 'lg', onPress: noop };

// ─── States ──────────────────────────────────────────────────────────────────
export const Loading = Template.bind({});
(Loading as any).args = { title: 'Loading…', loading: true, onPress: noop };

export const Disabled = Template.bind({});
(Disabled as any).args = { title: 'Disabled', disabled: true, onPress: noop };

export const FullWidth = Template.bind({});
(FullWidth as any).args = { title: 'Full Width', fullWidth: true, onPress: noop };

// ─── Composites ──────────────────────────────────────────────────────────────
export const AllVariants = () => (
  <View style={styles.grid}>
    {(['primary', 'secondary', 'outline', 'ghost'] as const).map(v => (
      <Button key={v} title={v.charAt(0).toUpperCase() + v.slice(1)} variant={v} onPress={noop} style={styles.gridItem} />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <Button key={s} title={`Size: ${s}`} size={s} onPress={noop} fullWidth />
    ))}
  </View>
);

export const AllStates = () => (
  <View style={styles.column}>
    <Button title="Default"  onPress={noop} fullWidth />
    <Button title="Loading…" onPress={noop} loading fullWidth />
    <Button title="Disabled" onPress={noop} disabled fullWidth />
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  column: { gap: theme.spacing.sm },
  gridItem: { flexShrink: 1 },
});
