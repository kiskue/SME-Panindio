import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Badge, BadgeVariant } from './Badge';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Badge',
  component: Badge,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:  { control: { type: 'select' }, options: ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'gray'] },
    size:     { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    dot:      { control: 'boolean' },
    outline:  { control: 'boolean' },
    label:    { control: 'text' },
    count:    { control: 'number' },
  },
};

const Template = (args: React.ComponentProps<typeof Badge>) => <Badge {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { label: 'Badge', variant: 'primary', size: 'md' };

export const Primary   = Template.bind({});
(Primary as any).args   = { label: 'Primary',   variant: 'primary' };

export const Secondary = Template.bind({});
(Secondary as any).args = { label: 'Secondary', variant: 'secondary' };

export const Success   = Template.bind({});
(Success as any).args   = { label: 'Success',   variant: 'success' };

export const Warning   = Template.bind({});
(Warning as any).args   = { label: 'Warning',   variant: 'warning' };

export const Error     = Template.bind({});
(Error as any).args     = { label: 'Error',     variant: 'error' };

export const Info      = Template.bind({});
(Info as any).args      = { label: 'Info',      variant: 'info' };

export const Gray      = Template.bind({});
(Gray as any).args      = { label: 'Gray',      variant: 'gray' };

export const DotVariant = Template.bind({});
(DotVariant as any).args = { dot: true, variant: 'success' };

export const OutlineVariant = Template.bind({});
(OutlineVariant as any).args = { label: 'Outlined', outline: true, variant: 'primary' };

export const WithCount = Template.bind({});
(WithCount as any).args = { count: 5, variant: 'error' };

export const OverflowCount = Template.bind({});
(OverflowCount as any).args = { count: 150, variant: 'error' };

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { label: 'Small',  size: 'sm', variant: 'primary' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { label: 'Medium', size: 'md', variant: 'primary' };

export const SizeLarge  = Template.bind({});
(SizeLarge as any).args  = { label: 'Large',  size: 'lg', variant: 'primary' };

const VARIANTS: BadgeVariant[] = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'gray'];

export const AllVariants = () => (
  <View style={styles.column}>
    <View style={styles.row}>
      {VARIANTS.map(v => <Badge key={v} label={v} variant={v} />)}
    </View>
    <View style={styles.row}>
      {VARIANTS.map(v => <Badge key={v} label={v} variant={v} outline />)}
    </View>
    <View style={styles.row}>
      {VARIANTS.map(v => <Badge key={v} dot variant={v} />)}
    </View>
  </View>
);

export const AllSizes = () => (
  <View style={styles.row}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <Badge key={s} label={s.toUpperCase()} size={s} variant="primary" />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
});
