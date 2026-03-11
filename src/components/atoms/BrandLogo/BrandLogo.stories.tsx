import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { BrandLogo } from './BrandLogo';

const meta: Meta<typeof BrandLogo> = {
  title: 'Atoms/BrandLogo',
  component: BrandLogo,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 32 }}>
        <Story />
      </View>
    ),
  ],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    variant: {
      control: 'select',
      options: ['full', 'icon', 'wordmark'],
    },
  },
};
export default meta;

type Story = StoryObj<typeof BrandLogo>;

export const Default: Story = {
  args: {
    size: 'md',
    variant: 'full',
  },
};

export const IconOnly: Story = {
  args: {
    size: 'lg',
    variant: 'icon',
  },
};

export const WordmarkOnly: Story = {
  args: {
    size: 'lg',
    variant: 'wordmark',
  },
};

export const DifferentSizes: Story = {
  render: () => (
    <View style={{ gap: 32, alignItems: 'center' }}>
      <BrandLogo size="xs" variant="full" />
      <BrandLogo size="sm" variant="full" />
      <BrandLogo size="md" variant="full" />
      <BrandLogo size="lg" variant="full" />
      <BrandLogo size="xl" variant="full" />
    </View>
  ),
};

export const OnDarkBackground: Story = {
  decorators: [
    (Story) => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E4D8C', padding: 32 }}>
        <Story />
      </View>
    ),
  ],
  args: {
    size: 'lg',
    variant: 'full',
  },
};
