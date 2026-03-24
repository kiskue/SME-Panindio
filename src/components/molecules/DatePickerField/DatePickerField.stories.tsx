/**
 * DatePickerField stories
 *
 * Covers the full Storybook story matrix required by the design system:
 *   Default, WithValue, Disabled, Error, WithHelperText, WithDateRange
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { DatePickerField } from './DatePickerField';

const meta: Meta<typeof DatePickerField> = {
  title:     'Molecules/DatePickerField',
  component: DatePickerField,
  decorators: [
    (Story) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DatePickerField>;

// ── Stateful wrapper ──────────────────────────────────────────────────────────
// Storybook controls work best with controlled components.

const ControlledDatePicker = (
  props: Omit<React.ComponentProps<typeof DatePickerField>, 'value' | 'onChange'> & {
    initialValue?: string;
  },
) => {
  const { initialValue = '', ...rest } = props;
  const [value, setValue] = useState(initialValue);
  return <DatePickerField {...rest} value={value} onChange={setValue} />;
};

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <ControlledDatePicker label="Expense Date" />
  ),
};

export const WithValue: Story = {
  render: () => (
    <ControlledDatePicker
      label="Expense Date"
      initialValue="2026-03-24"
    />
  ),
};

export const WithHelperText: Story = {
  render: () => (
    <ControlledDatePicker
      label="Purchase Date"
      helperText="Date the equipment was bought"
    />
  ),
};

export const Error: Story = {
  render: () => (
    <ControlledDatePicker
      label="Expense Date"
      initialValue=""
      error="Please enter a valid date"
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <ControlledDatePicker
      label="Expense Date"
      initialValue="2026-03-01"
      disabled
    />
  ),
};

export const WithDateRange: Story = {
  render: () => (
    <ControlledDatePicker
      label="Expense Date"
      helperText="Must be within this calendar year"
      minimumDate={new Date(2026, 0, 1)}
      maximumDate={new Date(2026, 11, 31)}
    />
  ),
};

export const NoLabel: Story = {
  render: () => (
    <ControlledDatePicker placeholder="Select a date" />
  ),
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    padding: 24,
    maxWidth: 400,
  },
});
