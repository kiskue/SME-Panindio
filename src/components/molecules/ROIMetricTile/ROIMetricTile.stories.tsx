import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { ROIMetricTile } from './ROIMetricTile';

const meta: Meta<typeof ROIMetricTile> = {
  title:     'Molecules/ROIMetricTile',
  component: ROIMetricTile,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#F8F9FA' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ROIMetricTile>;

export const Default: Story = {
  args: {
    label: 'Total Revenue',
    value: '₱125,400.00',
  },
};

export const WithTrendUp: Story = {
  args: {
    label:    'Net Profit',
    value:    '₱38,200.00',
    subValue: '+12% vs last month',
    trend:    'up',
    color:    '#27AE60',
  },
};

export const WithTrendDown: Story = {
  args: {
    label:    'Monthly Burn',
    value:    '₱18,500.00',
    subValue: 'Overhead + Utilities',
    trend:    'down',
    color:    '#FF3B30',
  },
};

export const Neutral: Story = {
  args: {
    label: 'Total COGS',
    value: '₱72,100.00',
    trend: 'neutral',
  },
};

export const Highlight: Story = {
  args: {
    label:     'Total Investment',
    value:     '₱215,000.00',
    subValue:  'Equipment + Overhead + Utilities',
    highlight: true,
    color:     '#1E4D8C',
  },
};

export const Loading: Story = {
  args: {
    label: 'Total Revenue',
    value: '—',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Equipment Cost',
    value: 'N/A',
    color: '#9CA3AF',
  },
};

export const DifferentSizes: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <ROIMetricTile label="Small Value" value="₱1,200" />
      <ROIMetricTile label="Medium Value" value="₱48,750.00" trend="up" />
      <ROIMetricTile label="Large Value" value="₱1,250,000.00" highlight color="#1E4D8C" />
    </View>
  ),
};
