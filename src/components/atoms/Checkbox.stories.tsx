import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Checkbox, CheckboxColor } from './Checkbox';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:    { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    color:   { control: { type: 'select' }, options: ['primary', 'success', 'error'] },
    checked: { control: 'boolean' },
    disabled:{ control: 'boolean' },
    indeterminate: { control: 'boolean' },
    label:   { control: 'text' },
    error:   { control: 'text' },
  },
};

const noop = (_: boolean) => {};

const Template = (args: React.ComponentProps<typeof Checkbox>) => {
  const [checked, setChecked] = useState(args.checked ?? false);
  return <Checkbox {...args} checked={checked} onChange={setChecked} />;
};

export const Playground = Template.bind({});
(Playground as any).args = { checked: false, label: 'Accept terms', color: 'primary', size: 'md' };

export const Unchecked = Template.bind({});
(Unchecked as any).args = { checked: false, label: 'Unchecked', onChange: noop };

export const Checked = Template.bind({});
(Checked as any).args = { checked: true, label: 'Checked', onChange: noop };

export const Indeterminate = Template.bind({});
(Indeterminate as any).args = { checked: false, indeterminate: true, label: 'Indeterminate', onChange: noop };

export const WithLabel = Template.bind({});
(WithLabel as any).args = { checked: false, label: 'I agree to the terms of service' };

export const Disabled = Template.bind({});
(Disabled as any).args = { checked: false, label: 'Disabled', disabled: true, onChange: noop };

export const DisabledChecked = Template.bind({});
(DisabledChecked as any).args = { checked: true, label: 'Disabled checked', disabled: true, onChange: noop };

export const ColorPrimary = Template.bind({});
(ColorPrimary as any).args = { checked: true, label: 'Primary', color: 'primary' };

export const ColorSuccess = Template.bind({});
(ColorSuccess as any).args = { checked: true, label: 'Success', color: 'success' };

export const ColorError = Template.bind({});
(ColorError as any).args = { checked: true, label: 'Error', color: 'error' };

export const WithError = Template.bind({});
(WithError as any).args = { checked: false, label: 'Required field', error: 'This field is required' };

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { checked: true, label: 'Small',  size: 'sm' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { checked: true, label: 'Medium', size: 'md' };

export const SizeLarge  = Template.bind({});
(SizeLarge as any).args  = { checked: true, label: 'Large',  size: 'lg' };

const COLORS: CheckboxColor[] = ['primary', 'success', 'error'];

export const AllColors = () => (
  <View style={styles.column}>
    {COLORS.map(c => (
      <Checkbox key={c} checked label={c} color={c} onChange={noop} />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <Checkbox key={s} checked label={`Size: ${s}`} size={s} onChange={noop} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
