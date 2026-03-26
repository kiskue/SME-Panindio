import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { AIInsightCard } from './AIInsightCard';

const meta: Meta<typeof AIInsightCard> = {
  title:     'Organisms/AIInsightCard',
  component: AIInsightCard,
  decorators: [
    (Story: () => React.ReactElement) => (
      <View style={{ padding: 16, backgroundColor: '#0F0F14', flex: 1 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof AIInsightCard>;

export const Default: Story = {
  args: {
    insight:   'Break even in 4 months 12 days at your current volume of 320 units/month. Gross margin is a healthy 42.5%.',
    riskLevel: 'low',
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    insight:   '',
    riskLevel: 'low',
    isLoading: true,
  },
};

export const MediumRisk: Story = {
  args: {
    insight:   'Gross margin of 18.2% is thin. Aim for at least 20% to absorb unexpected costs.',
    riskLevel: 'medium',
    isLoading: false,
  },
};

export const HighRisk: Story = {
  args: {
    insight:   'At current prices, break-even takes 22 months — consider raising your price or cutting fixed costs to bring this under 18 months.',
    riskLevel: 'high',
    isLoading: false,
  },
};

export const Empty: Story = {
  args: {
    insight:   'Enter your numbers to generate an AI-powered insight.',
    riskLevel: 'low',
    isLoading: false,
  },
};
