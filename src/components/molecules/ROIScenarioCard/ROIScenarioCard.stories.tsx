import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { ROIScenarioCard } from './ROIScenarioCard';

const meta: Meta<typeof ROIScenarioCard> = {
  title:     'Molecules/ROIScenarioCard',
  component: ROIScenarioCard,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#0F0F14', flex: 1, flexDirection: 'row', gap: 8 }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ROIScenarioCard>;

export const Default: Story = {
  args: {
    label:           'Current',
    roi:             38.4,
    breakevenMonths: 4,
    unitsNeeded:     280,
    grossMargin:     42.5,
    riskLevel:       'low',
    isHighlighted:   false,
  },
};

export const Highlighted: Story = {
  args: {
    label:           'Current',
    roi:             38.4,
    breakevenMonths: 4,
    unitsNeeded:     280,
    grossMargin:     42.5,
    riskLevel:       'low',
    isHighlighted:   true,
  },
};

export const Optimistic: Story = {
  args: {
    label:           'Optimistic (+10%)',
    roi:             54.2,
    breakevenMonths: 3,
    unitsNeeded:     240,
    grossMargin:     49.6,
    riskLevel:       'low',
    isHighlighted:   false,
  },
};

export const Conservative: Story = {
  args: {
    label:           'Conservative (-10%)',
    roi:             14.8,
    breakevenMonths: 9,
    unitsNeeded:     340,
    grossMargin:     31.2,
    riskLevel:       'medium',
    isHighlighted:   false,
  },
};

export const HighRisk: Story = {
  args: {
    label:           'Conservative (-10%)',
    roi:             -8.2,
    breakevenMonths: 22,
    unitsNeeded:     520,
    grossMargin:     12.1,
    riskLevel:       'high',
    isHighlighted:   false,
  },
};
