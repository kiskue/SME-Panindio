import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { BreakevenProgress } from './BreakevenProgress';

const meta: Meta<typeof BreakevenProgress> = {
  title:     'Molecules/BreakevenProgress',
  component: BreakevenProgress,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#F8F9FA' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BreakevenProgress>;

export const Default: Story = {
  args: {
    unitsSold:      320,
    breakevenUnits: 500,
  },
};

export const LowProgress: Story = {
  args: {
    unitsSold:      60,
    breakevenUnits: 500,
    label:          'Units to Breakeven',
  },
};

export const HalfWay: Story = {
  args: {
    unitsSold:      250,
    breakevenUnits: 500,
  },
};

export const Reached: Story = {
  args: {
    unitsSold:      550,
    breakevenUnits: 500,
    label:          'Breakeven Achieved',
  },
};

export const ZeroSold: Story = {
  args: {
    unitsSold:      0,
    breakevenUnits: 400,
  },
};

export const Loading: Story = {
  args: {
    unitsSold:      0,
    breakevenUnits: 0,
  },
};

export const Error: Story = {
  args: {
    unitsSold:      0,
    breakevenUnits: 0,
    label:          'No data available',
  },
};

export const DifferentSizes: Story = {
  render: () => (
    <View style={{ gap: 16 }}>
      <BreakevenProgress unitsSold={50}  breakevenUnits={500} label="Early stage (10%)" />
      <BreakevenProgress unitsSold={250} breakevenUnits={500} label="Halfway there (50%)" />
      <BreakevenProgress unitsSold={500} breakevenUnits={500} label="Breakeven reached!" />
    </View>
  ),
};
