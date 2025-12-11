import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { theme } from '../../../core/theme';

export default {
  title: 'Atoms/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Button component with multiple variants, sizes, and states.',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      defaultValue: 'Click Me',
    },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost'],
      defaultValue: 'primary',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      defaultValue: 'md',
    },
    disabled: {
      control: 'boolean',
      defaultValue: false,
    },
    loading: {
      control: 'boolean',
      defaultValue: false,
    },
    fullWidth: {
      control: 'boolean',
      defaultValue: false,
    },
  },
};

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  title: 'Primary Button',
  variant: 'primary',
};

export const Secondary = Template.bind({});
Secondary.args = {
  title: 'Secondary Button',
  variant: 'secondary',
};

export const Outline = Template.bind({});
Outline.args = {
  title: 'Outline Button',
  variant: 'outline',
};

export const Ghost = Template.bind({});
Ghost.args = {
  title: 'Ghost Button',
  variant: 'ghost',
};

export const Small = Template.bind({});
Small.args = {
  title: 'Small Button',
  size: 'sm',
};

export const Medium = Template.bind({});
Medium.args = {
  title: 'Medium Button',
  size: 'md',
};

export const Large = Template.bind({});
Large.args = {
  title: 'Large Button',
  size: 'lg',
};

export const Loading = Template.bind({});
Loading.args = {
  title: 'Loading Button',
  loading: true,
};

export const Disabled = Template.bind({});
Disabled.args = {
  title: 'Disabled Button',
  disabled: true,
};

export const FullWidth = Template.bind({});
FullWidth.args = {
  title: 'Full Width Button',
  fullWidth: true,
};

export const WithIcons = Template.bind({});
WithIcons.args = {
  title: 'With Icons',
  leftIcon: <Text style={{ marginRight: 8 }}>🚀</Text>,
  rightIcon: <Text style={{ marginLeft: 8 }}>⭐</Text>,
};

export const AllVariants = () => (
  <View style={styles.container}>
    <View style={styles.row}>
      <Button title="Primary" variant="primary" style={styles.button} />
      <Button title="Secondary" variant="secondary" style={styles.button} />
    </View>
    <View style={styles.row}>
      <Button title="Outline" variant="outline" style={styles.button} />
      <Button title="Ghost" variant="ghost" style={styles.button} />
    </View>
    <View style={styles.row}>
      <Button title="Loading" loading style={styles.button} />
      <Button title="Disabled" disabled style={styles.button} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
  },
});