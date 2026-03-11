import React, { useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { theme } from '../../core/theme';
import { FormField } from './FormField';

// FormField requires a live react-hook-form Control — every story
// wraps the component in a tiny useForm hook so controls and validation work.

type FieldArgs = Omit<React.ComponentProps<typeof FormField>, 'control'>;

const FormFieldWrapper = (args: FieldArgs) => {
  const { control } = useForm({ defaultValues: { [args.name]: '' } });
  return <FormField {...args} control={control} />;
};

// Wrapper that pre-wires a validation error so the error state is immediately visible.
const FormFieldWithError = (args: FieldArgs & { errorMessage: string }) => {
  const { control, setError } = useForm({ defaultValues: { [args.name]: '' } });
  useEffect(() => {
    setError(args.name, { type: 'manual', message: args.errorMessage });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { errorMessage: _ignored, ...rest } = args;
  return <FormField {...rest} control={control} />;
};

export default {
  title: 'Molecules/FormField',
  component: FormFieldWrapper,
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
    helperText:      { control: 'text' },
    variant:         { control: { type: 'select' }, options: ['default', 'filled', 'outlined'] },
    size:            { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    secureTextEntry: { control: 'boolean' },
    multiline:       { control: 'boolean' },
    editable:        { control: 'boolean' },
  },
};

const Template = (args: any) => <FormFieldWrapper {...args} />;

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  name: 'field',
  label: 'Field Label',
  placeholder: 'Type something…',
  variant: 'outlined',
  size: 'md',
  secureTextEntry: false,
  multiline: false,
  editable: true,
};

// ─── Field types ─────────────────────────────────────────────────────────────
export const Email = Template.bind({});
(Email as any).args = {
  name: 'email',
  label: 'Email address',
  placeholder: 'you@example.com',
  keyboardType: 'email-address',
  autoCapitalize: 'none',
  autoComplete: 'email',
  helperText: 'Enter the email associated with your account.',
};

export const Password = Template.bind({});
(Password as any).args = {
  name: 'password',
  label: 'Password',
  placeholder: 'Enter your password',
  secureTextEntry: true,
  autoComplete: 'password',
  helperText: 'At least 8 characters.',
};

export const Username = Template.bind({});
(Username as any).args = {
  name: 'username',
  label: 'Username',
  placeholder: 'e.g. john_doe',
  helperText: 'Letters, numbers and underscores only. 3–20 characters.',
  autoCapitalize: 'none',
};

export const Phone = Template.bind({});
(Phone as any).args = {
  name: 'phone',
  label: 'Phone number',
  placeholder: '+1 (555) 000-0000',
  keyboardType: 'phone-pad',
};

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const SizeSmall = Template.bind({});
(SizeSmall as any).args = { name: 'sm', label: 'Small (sm)', placeholder: 'Small size…', size: 'sm' };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { name: 'md', label: 'Medium (md)', placeholder: 'Medium size…', size: 'md' };

export const SizeLarge = Template.bind({});
(SizeLarge as any).args = { name: 'lg', label: 'Large (lg)', placeholder: 'Large size…', size: 'lg' };

// ─── Variants ────────────────────────────────────────────────────────────────
export const VariantOutlined = Template.bind({});
(VariantOutlined as any).args = { name: 'outlined', label: 'Outlined', placeholder: 'Outlined variant', variant: 'outlined' };

export const VariantFilled = Template.bind({});
(VariantFilled as any).args = { name: 'filled', label: 'Filled', placeholder: 'Filled variant', variant: 'filled' };

// ─── States ──────────────────────────────────────────────────────────────────
export const Multiline = Template.bind({});
(Multiline as any).args = {
  name: 'bio',
  label: 'Bio',
  placeholder: 'Tell us about yourself…',
  multiline: true,
  numberOfLines: 4,
  helperText: 'Max 200 characters.',
};

export const Disabled = Template.bind({});
(Disabled as any).args = {
  name: 'readonly',
  label: 'Read-only field',
  placeholder: 'Cannot be edited',
  editable: false,
};

export const WithValidationError = () => (
  <FormFieldWithError
    name="email"
    label="Email address"
    placeholder="you@example.com"
    errorMessage="Please enter a valid email address."
    keyboardType="email-address"
    autoCapitalize="none"
  />
);

// ─── Composite: Login form ────────────────────────────────────────────────────
export const LoginFormFields = () => {
  const { control } = useForm({ defaultValues: { email: '', password: '' } });
  return (
    <View>
      <FormField
        name="email"
        control={control}
        label="Email address"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        rules={{ required: 'Email is required' }}
      />
      <FormField
        name="password"
        control={control}
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        autoComplete="password"
        rules={{
          required: 'Password is required',
          minLength: { value: 6, message: 'Minimum 6 characters' },
        }}
      />
    </View>
  );
};

// ─── Composite: Registration form ────────────────────────────────────────────
export const RegistrationFormFields = () => {
  const { control } = useForm({
    defaultValues: { name: '', email: '', password: '', bio: '' },
  });
  return (
    <View>
      <FormField name="name"     control={control} label="Full name"     placeholder="Jane Smith" />
      <FormField name="email"    control={control} label="Email"         placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" />
      <FormField name="password" control={control} label="Password"      placeholder="Min 8 characters" secureTextEntry />
      <FormField name="bio"      control={control} label="Bio"           placeholder="Tell us about yourself…" multiline numberOfLines={3} />
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
});
