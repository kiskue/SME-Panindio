import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Star, ChevronRight } from 'lucide-react-native';
import { Tag, TagColor, TagVariant } from './Tag';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Tag',
  component: Tag,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant: { control: { type: 'select' }, options: ['filled', 'outlined', 'subtle'] },
    color:   { control: { type: 'select' }, options: ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'gray'] },
    size:    { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    dot:     { control: 'boolean' },
    label:   { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Tag>) => <Tag {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { label: 'Tag', variant: 'subtle', color: 'primary', size: 'md' };

export const Filled   = Template.bind({});
(Filled as any).args   = { label: 'Filled',   variant: 'filled' };

export const Outlined = Template.bind({});
(Outlined as any).args = { label: 'Outlined', variant: 'outlined' };

export const Subtle   = Template.bind({});
(Subtle as any).args   = { label: 'Subtle',   variant: 'subtle' };

export const ColorPrimary   = Template.bind({});
(ColorPrimary as any).args   = { label: 'Primary',   color: 'primary',   variant: 'subtle' };

export const ColorSuccess   = Template.bind({});
(ColorSuccess as any).args   = { label: 'Success',   color: 'success',   variant: 'subtle' };

export const ColorWarning   = Template.bind({});
(ColorWarning as any).args   = { label: 'Warning',   color: 'warning',   variant: 'subtle' };

export const ColorError     = Template.bind({});
(ColorError as any).args     = { label: 'Error',     color: 'error',     variant: 'subtle' };

export const ColorInfo      = Template.bind({});
(ColorInfo as any).args      = { label: 'Info',      color: 'info',      variant: 'subtle' };

export const ColorGray      = Template.bind({});
(ColorGray as any).args      = { label: 'Gray',      color: 'gray',      variant: 'subtle' };

export const WithDot = Template.bind({});
(WithDot as any).args = { label: 'Active', dot: true, color: 'success', variant: 'subtle' };

export const WithLeftIcon = () => (
  <Tag label="Featured" leftIcon={<Star size={10} color={theme.colors.warning[700]} />} color="warning" variant="subtle" />
);

export const WithRightIcon = () => (
  <Tag label="More" rightIcon={<ChevronRight size={10} color={theme.colors.primary[500]} />} color="primary" variant="outlined" />
);

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { label: 'Small',  size: 'sm', variant: 'subtle' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { label: 'Medium', size: 'md', variant: 'subtle' };

export const SizeLarge  = Template.bind({});
(SizeLarge as any).args  = { label: 'Large',  size: 'lg', variant: 'subtle' };

const TAG_COLORS: TagColor[]   = ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'gray'];
const TAG_VARIANTS: TagVariant[] = ['filled', 'outlined', 'subtle'];

export const AllColors = () => (
  <View style={styles.column}>
    {TAG_VARIANTS.map(v => (
      <View key={v} style={styles.row}>
        {TAG_COLORS.map(c => <Tag key={c} label={c} variant={v} color={c} />)}
      </View>
    ))}
  </View>
);

export const AllVariants = () => (
  <View style={styles.column}>
    {TAG_VARIANTS.map(v => (
      <Tag key={v} label={v} variant={v} color="primary" />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.row}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <Tag key={s} label={s.toUpperCase()} size={s} variant="subtle" />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, alignItems: 'center' },
});
