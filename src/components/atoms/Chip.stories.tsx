import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Star } from 'lucide-react-native';
import { Chip, ChipColor } from './Chip';
import { Avatar } from './Avatar';
import { theme } from '../../core/theme';

const noop = () => {};

export default {
  title: 'Atoms/Chip',
  component: Chip,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:  { control: { type: 'select' }, options: ['filled', 'outlined', 'ghost'] },
    color:    { control: { type: 'select' }, options: ['primary', 'secondary', 'success', 'warning', 'error', 'gray'] },
    size:     { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label:    { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Chip>) => <Chip {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { label: 'Chip', variant: 'filled', color: 'primary', size: 'md' };

export const FilledDefault   = Template.bind({});
(FilledDefault as any).args   = { label: 'Filled',    variant: 'filled',   color: 'primary', onPress: noop };

export const FilledSelected  = Template.bind({});
(FilledSelected as any).args  = { label: 'Selected',  variant: 'filled',   color: 'primary', selected: true, onPress: noop };

export const OutlinedDefault = Template.bind({});
(OutlinedDefault as any).args = { label: 'Outlined',  variant: 'outlined', color: 'primary', onPress: noop };

export const OutlinedSelected = Template.bind({});
(OutlinedSelected as any).args = { label: 'Selected', variant: 'outlined', color: 'primary', selected: true, onPress: noop };

export const GhostDefault    = Template.bind({});
(GhostDefault as any).args    = { label: 'Ghost',     variant: 'ghost',    color: 'primary', onPress: noop };

export const WithRemove = Template.bind({});
(WithRemove as any).args = { label: 'Removable', onPress: noop, onRemove: noop };

export const WithIcon = () => (
  <Chip
    label="Featured"
    selected
    leftIcon={<Star size={14} color={theme.colors.primary[700]} />}
    onPress={noop}
  />
);

export const WithAvatar = () => (
  <Chip
    label="John Doe"
    avatar={<Avatar initials="JD" size="xs" />}
    onPress={noop}
  />
);

export const Disabled  = Template.bind({});
(Disabled as any).args  = { label: 'Disabled', disabled: true };

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { label: 'Small',  size: 'sm', selected: true };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { label: 'Medium', size: 'md', selected: true };

export const SizeLarge  = Template.bind({});
(SizeLarge as any).args  = { label: 'Large',  size: 'lg', selected: true };

const CHIP_COLORS: ChipColor[] = ['primary', 'secondary', 'success', 'warning', 'error', 'gray'];

export const ColorPrimary  = Template.bind({});
(ColorPrimary as any).args  = { label: 'Primary',   color: 'primary',   selected: true };

export const ColorSuccess  = Template.bind({});
(ColorSuccess as any).args  = { label: 'Success',   color: 'success',   selected: true };

export const ColorError    = Template.bind({});
(ColorError as any).args    = { label: 'Error',     color: 'error',     selected: true };

export const AllVariants = () => (
  <View style={styles.column}>
    {(['filled', 'outlined', 'ghost'] as const).map(v => (
      <View key={v} style={styles.row}>
        {CHIP_COLORS.map(c => (
          <Chip key={c} label={c} variant={v} color={c} selected onPress={noop} />
        ))}
      </View>
    ))}
  </View>
);

export const FilterExample = () => {
  const categories = ['All', 'Tech', 'Design', 'Business', 'Science', 'Art'];
  const [active, setActive] = useState('All');
  return (
    <View style={styles.row}>
      {categories.map(cat => (
        <Chip
          key={cat}
          label={cat}
          selected={active === cat}
          onPress={() => setActive(cat)}
          variant="outlined"
          color="primary"
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
});
