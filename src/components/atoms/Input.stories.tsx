import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, Text as RNText } from 'react-native';
import { Input, InputProps } from './Input';
import { theme } from '../../core/theme';

// ─── Styles ───────────────────────────────────────────────────────────────────
// Defined before story args so Babel's var-hoisting doesn't leave `styles`
// as `undefined` when WithIcons args are evaluated at module load time.
const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column:    { gap: theme.spacing.xs },
  icon:      { fontSize: 16 },
});

// Stateful wrapper — needed because Input is a controlled component.
// Storybook controls update the args object but can't manage internal state,
// so this wrapper bridges the gap and keeps the field interactive.
const StatefulInput = (args: Omit<InputProps, 'value' | 'onChangeText'> & { _defaultValue?: string }) => {
  const [value, setValue] = useState(args._defaultValue ?? '');
  return <Input {...args} value={value} onChangeText={setValue} />;
};

export default {
  title: 'Atoms/Input',
  component: StatefulInput,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView
        contentContainerStyle={styles.decorator}
        keyboardShouldPersistTaps="handled"
      >
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    label:           { control: 'text' },
    placeholder:     { control: 'text' },
    error:           { control: 'text' },
    helperText:      { control: 'text' },
    _defaultValue:   { control: 'text', name: 'Initial value' },
    variant:         { control: { type: 'select' }, options: ['default', 'filled', 'outlined'] },
    size:            { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    secureTextEntry: { control: 'boolean' },
    multiline:       { control: 'boolean' },
    editable:        { control: 'boolean' },
  },
};

const Template = (args: any) => <StatefulInput {...args} />;

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  label: 'Label',
  placeholder: 'Type something…',
  variant: 'outlined',
  size: 'md',
  secureTextEntry: false,
  multiline: false,
  editable: true,
};

// ─── Variants ────────────────────────────────────────────────────────────────
export const Outlined = Template.bind({});
(Outlined as any).args = { label: 'Outlined', placeholder: 'Outlined variant', variant: 'outlined' };

export const Filled = Template.bind({});
(Filled as any).args = { label: 'Filled', placeholder: 'Filled variant', variant: 'filled' };

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const SizeSmall = Template.bind({});
(SizeSmall as any).args = { label: 'Small (sm)', placeholder: 'Small input…', size: 'sm' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { label: 'Medium (md)', placeholder: 'Medium input…', size: 'md' };

export const SizeLarge = Template.bind({});
(SizeLarge as any).args = { label: 'Large (lg)', placeholder: 'Large input…', size: 'lg' };

// ─── States ──────────────────────────────────────────────────────────────────
export const WithHelperText = Template.bind({});
(WithHelperText as any).args = {
  label: 'Username',
  placeholder: 'Enter a username',
  helperText: 'Letters, numbers and underscores only. 3–20 characters.',
};

export const WithError = Template.bind({});
(WithError as any).args = {
  label: 'Email address',
  placeholder: 'you@example.com',
  _defaultValue: 'not-a-valid-email',
  error: 'Please enter a valid email address.',
};

export const Password = Template.bind({});
(Password as any).args = {
  label: 'Password',
  placeholder: 'Enter your password',
  secureTextEntry: true,
  helperText: 'At least 8 characters.',
};

export const Disabled = Template.bind({});
(Disabled as any).args = {
  label: 'Read-only field',
  _defaultValue: 'Cannot be edited',
  editable: false,
};

export const WithIcons = Template.bind({});
(WithIcons as any).args = {
  label: 'Search',
  placeholder: 'Search for anything…',
  leftIcon: <RNText style={styles.icon}>🔍</RNText>,
  rightIcon: <RNText style={styles.icon}>✕</RNText>,
};

export const Multiline = Template.bind({});
(Multiline as any).args = {
  label: 'Bio',
  placeholder: 'Tell us about yourself…',
  multiline: true,
  numberOfLines: 4,
  helperText: 'Max 200 characters.',
};

// ─── Composites ──────────────────────────────────────────────────────────────
export const AllVariants = () => (
  <View style={styles.column}>
    {(['outlined', 'filled', 'default'] as const).map(v => (
      <StatefulInput key={v} label={`Variant: ${v}`} placeholder="Type here…" variant={v} />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <StatefulInput key={s} label={`Size: ${s}`} placeholder={`${s} input`} size={s} />
    ))}
  </View>
);

export const AllStates = () => (
  <View style={styles.column}>
    <StatefulInput label="Default"     placeholder="Type here…" />
    <StatefulInput label="Helper text" placeholder="…" helperText="Helpful hint below the field." />
    <StatefulInput label="Error"       _defaultValue="bad input" error="This value is invalid." />
    <StatefulInput label="Password"    placeholder="••••••••" secureTextEntry />
    <StatefulInput label="Disabled"    _defaultValue="Read only value" editable={false} />
    <StatefulInput label="Multiline"   placeholder="Long text…" multiline numberOfLines={3} />
  </View>
);
