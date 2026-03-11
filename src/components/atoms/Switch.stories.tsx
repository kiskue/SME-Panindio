import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Switch, SwitchColor } from './Switch';
import { theme } from '../../core/theme';

const noop = (_: boolean) => {};

export default {
  title: 'Atoms/Switch',
  component: Switch,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:          { control: { type: 'select' }, options: ['sm', 'md'] },
    color:         { control: { type: 'select' }, options: ['primary', 'success', 'error'] },
    labelPosition: { control: { type: 'select' }, options: ['left', 'right'] },
    value:         { control: 'boolean' },
    disabled:      { control: 'boolean' },
    label:         { control: 'text' },
    description:   { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Switch>) => {
  const [value, setValue] = useState(args.value ?? false);
  return <Switch {...args} value={value} onValueChange={setValue} />;
};

export const Playground = Template.bind({});
(Playground as any).args = { value: false, label: 'Enable notifications', color: 'primary', size: 'md' };

export const On = Template.bind({});
(On as any).args = { value: true, onValueChange: noop };

export const Off = Template.bind({});
(Off as any).args = { value: false, onValueChange: noop };

export const WithLabel = Template.bind({});
(WithLabel as any).args = { value: false, label: 'Dark mode' };

export const WithDescription = Template.bind({});
(WithDescription as any).args = {
  value: true,
  label: 'Push Notifications',
  description: 'Receive alerts for new messages',
};

export const LabelLeft = Template.bind({});
(LabelLeft as any).args = { value: true, label: 'Enabled', labelPosition: 'left' };

export const LabelRight = Template.bind({});
(LabelRight as any).args = { value: true, label: 'Enabled', labelPosition: 'right' };

export const Disabled = Template.bind({});
(Disabled as any).args = { value: false, label: 'Disabled', disabled: true, onValueChange: noop };

export const DisabledOn = Template.bind({});
(DisabledOn as any).args = { value: true, label: 'Disabled On', disabled: true, onValueChange: noop };

export const ColorPrimary = Template.bind({});
(ColorPrimary as any).args = { value: true, label: 'Primary', color: 'primary' };

export const ColorSuccess = Template.bind({});
(ColorSuccess as any).args = { value: true, label: 'Success', color: 'success' };

export const ColorError = Template.bind({});
(ColorError as any).args = { value: true, label: 'Error', color: 'error' };

export const SizeSmall  = Template.bind({});
(SizeSmall as any).args  = { value: true, label: 'Small',  size: 'sm' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { value: true, label: 'Medium', size: 'md' };

const COLORS: SwitchColor[] = ['primary', 'success', 'error'];

export const AllColors = () => (
  <View style={styles.column}>
    {COLORS.map(c => (
      <Switch key={c} value label={c} color={c} onValueChange={noop} />
    ))}
  </View>
);

export const SettingsList = () => {
  const [state, setState] = useState({
    notifications: true,
    darkMode: false,
    location: true,
    analytics: false,
  });
  return (
    <View style={styles.column}>
      {(Object.keys(state) as (keyof typeof state)[]).map(key => (
        <Switch
          key={key}
          value={state[key]}
          label={key.charAt(0).toUpperCase() + key.slice(1)}
          onValueChange={v => setState(s => ({ ...s, [key]: v }))}
          labelPosition="left"
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
