import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { PhoneInput } from './index';
import type { Country } from './countries';

const meta: Meta<typeof PhoneInput> = {
  title: 'Molecules/PhoneInput',
  component: PhoneInput,
  decorators: [
    (Story) => (
      <View style={styles.wrapper}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PhoneInput>;

// Controlled wrapper for interactive stories
function Controlled(props: Partial<React.ComponentProps<typeof PhoneInput>> & { isDark?: boolean }) {
  const [value, setValue] = useState('');
  const [country, setCountry] = useState<Country | undefined>(undefined);
  return (
    <PhoneInput
      value={value}
      onChangeText={setValue}
      label="Phone Number *"
      {...(country !== undefined ? { onChangeCountry: setCountry } : { onChangeCountry: setCountry })}
      {...props}
      {...(value !== '' ? {} : {})}
    />
  );
}

/** Default Philippine phone input — light mode */
export const Default: Story = {
  render: () => <Controlled />,
};

/** Dark mode variant */
export const DarkMode: Story = {
  render: () => (
    <View style={styles.darkWrapper}>
      <Controlled isDark label="Phone Number *" />
    </View>
  ),
};

/** Shows error state (prop-driven) */
export const Error: Story = {
  render: () => (
    <PhoneInput
      value="123"
      onChangeText={() => undefined}
      label="Phone Number *"
      error="Enter a valid Philippine phone number"
    />
  ),
};

/** Disabled — cannot edit */
export const Disabled: Story = {
  render: () => (
    <PhoneInput
      value="09171234567"
      onChangeText={() => undefined}
      label="Phone Number"
      editable={false}
    />
  ),
};

/** No label variant (used when the label is rendered outside the component) */
export const WithoutLabel: Story = {
  // Omit label entirely — exactOptionalPropertyTypes forbids label={undefined}
  render: () => <Controlled />,
};

/** Custom primary colour (matches the NAVY/AMBER palette in customer-register) */
export const WithCustomPrimaryColor: Story = {
  render: () => <Controlled label="Phone Number *" primaryColor="#1E4D8C" />,
};

/** Dark mode + error */
export const DarkError: Story = {
  render: () => (
    <View style={styles.darkWrapper}>
      <PhoneInput
        value="0917"
        onChangeText={() => undefined}
        label="Phone Number *"
        isDark
        error="Enter a valid Philippine phone number"
      />
    </View>
  ),
};

const styles = StyleSheet.create({
  wrapper: {
    padding: 24,
    backgroundColor: '#F0F4F8',
  },
  darkWrapper: {
    padding: 24,
    backgroundColor: '#0F1117',
  },
});
