import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Layers, TrendingDown, AlertTriangle, ShoppingBag } from 'lucide-react-native';
import { StatTile } from './StatTile';

const meta: Meta<typeof StatTile> = {
  title:     'Molecules/StatTile',
  component: StatTile,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#F2F5FA' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StatTile>;

export const Compact: Story = {
  args: {
    label: 'Total Items',
    value: '132',
    variant: 'compact',
    accentColor: '#1E4D8C',
    icon: <Layers size={16} color="#1E4D8C" />,
  },
};

export const Hero: Story = {
  args: {
    label: 'Stock value',
    value: '₱94,200',
    subValue: '132 items · 8 low',
    variant: 'hero',
    highlight: true,
    accentColor: '#27AE60',
    icon: <ShoppingBag size={20} color="#27AE60" />,
  },
};

/** The inventory overview bento row: one hero + a compact grid. */
export const BentoRow: Story = {
  render: () => (
    <View style={{ gap: 8 }}>
      <StatTile
        label="Stock value"
        value="₱94,200"
        subValue="132 items · 8 low"
        variant="hero"
        highlight
        accentColor="#27AE60"
        icon={<ShoppingBag size={20} color="#27AE60" />}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile label="Total" value="132" accentColor="#1E4D8C" icon={<Layers size={16} color="#1E4D8C" />} />
        <StatTile label="Low Stock" value="8" accentColor="#FF9500" trend="down" icon={<TrendingDown size={16} color="#FF9500" />} />
        <StatTile label="Out of Stock" value="2" accentColor="#FF3B30" icon={<AlertTriangle size={16} color="#FF3B30" />} />
      </View>
    </View>
  ),
};
