import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Radio, RadioGroup, RadioColor } from './Radio';
import { theme } from '../../core/theme';

const noop = () => {};

export default {
  title: 'Atoms/Radio',
  component: Radio,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:     { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    color:    { control: { type: 'select' }, options: ['primary', 'success', 'error'] },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label:    { control: 'text' },
    description: { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Radio>) => {
  const [selected, setSelected] = useState(args.selected ?? false);
  return <Radio {...args} selected={selected} onSelect={() => setSelected(s => !s)} />;
};

export const Playground = Template.bind({});
(Playground as any).args = { selected: false, label: 'Option A', color: 'primary', size: 'md' };

export const Selected = Template.bind({});
(Selected as any).args = { selected: true, label: 'Selected', onSelect: noop };

export const Unselected = Template.bind({});
(Unselected as any).args = { selected: false, label: 'Unselected', onSelect: noop };

export const WithLabel = Template.bind({});
(WithLabel as any).args = { selected: false, label: 'Option A' };

export const WithDescription = Template.bind({});
(WithDescription as any).args = {
  selected: true,
  label: 'Standard',
  description: 'Delivered in 3-5 business days',
};

export const Disabled = Template.bind({});
(Disabled as any).args = { selected: false, label: 'Disabled', disabled: true, onSelect: noop };

export const DisabledSelected = Template.bind({});
(DisabledSelected as any).args = { selected: true, label: 'Disabled Selected', disabled: true, onSelect: noop };

export const ColorPrimary = Template.bind({});
(ColorPrimary as any).args = { selected: true, label: 'Primary', color: 'primary' };

export const ColorSuccess = Template.bind({});
(ColorSuccess as any).args = { selected: true, label: 'Success', color: 'success' };

export const ColorError = Template.bind({});
(ColorError as any).args = { selected: true, label: 'Error', color: 'error' };

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { selected: true, label: 'Small',  size: 'sm' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { selected: true, label: 'Medium', size: 'md' };

export const SizeLarge  = Template.bind({});
(SizeLarge as any).args  = { selected: true, label: 'Large',  size: 'lg' };

const COLORS: RadioColor[] = ['primary', 'success', 'error'];

export const AllColors = () => (
  <View style={styles.column}>
    {COLORS.map(c => (
      <Radio key={c} selected label={c} color={c} onSelect={noop} />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <Radio key={s} selected label={`Size: ${s}`} size={s} onSelect={noop} />
    ))}
  </View>
);

export const RadioGroupExample = () => {
  const [value, setValue] = useState('standard');
  return (
    <RadioGroup
      value={value}
      onChange={setValue}
      options={[
        { value: 'standard',  label: 'Standard',  description: 'Delivered in 3-5 business days' },
        { value: 'express',   label: 'Express',   description: 'Delivered in 1-2 business days' },
        { value: 'overnight', label: 'Overnight', description: 'Next business day delivery' },
        { value: 'pickup',    label: 'Pickup',    description: 'Pick up at store', disabled: true },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
