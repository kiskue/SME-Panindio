import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Package, Wheat, Wrench } from 'lucide-react-native';
import { CategoryTile } from './CategoryTile';

const meta: Meta<typeof CategoryTile> = {
  title:     'Molecules/CategoryTile',
  component: CategoryTile,
  decorators: [
    (Story) => (
      <View style={{ padding: 16, backgroundColor: '#F2F5FA' }}>
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CategoryTile>;

const noop = () => undefined;

export const Grid: Story = {
  args: {
    label: 'Products',
    subtitle: 'Finished goods',
    count: 47,
    accentColor: '#1E4D8C',
    iconBg: '#EAF0FA',
    Icon: Package,
    variant: 'grid',
    onPress: noop,
  },
};

export const Row: Story = {
  args: {
    label: 'Ingredients',
    subtitle: 'Recipe components',
    count: 63,
    accentColor: '#27AE60',
    iconBg: '#E9F7EF',
    Icon: Wheat,
    variant: 'row',
    onPress: noop,
  },
};

/** The overview bento category grid. */
export const GridRow: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <CategoryTile label="Products" subtitle="Finished goods" count={47} accentColor="#1E4D8C" iconBg="#EAF0FA" Icon={Package} onPress={noop} />
      <CategoryTile label="Ingredients" subtitle="Recipe" count={63} accentColor="#27AE60" iconBg="#E9F7EF" Icon={Wheat} onPress={noop} />
      <CategoryTile label="Equipment" subtitle="Tools" count={12} accentColor="#F5A623" iconBg="#FEF7E8" Icon={Wrench} onPress={noop} />
    </View>
  ),
};
