import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { theme } from '../../core/theme';

export default {
  title: 'Atoms/Avatar',
  component: Avatar,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:    { control: { type: 'select' }, options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    variant: { control: { type: 'select' }, options: ['circle', 'rounded', 'square'] },
    online:  { control: 'boolean' },
    initials:{ control: 'text' },
  },
};

const SAMPLE_IMAGE = { uri: 'https://i.pravatar.cc/150?img=3' };

const Template = (args: React.ComponentProps<typeof Avatar>) => <Avatar {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { initials: 'JD', size: 'md', variant: 'circle' };

export const WithImage = Template.bind({});
(WithImage as any).args = { source: SAMPLE_IMAGE, size: 'md' };

export const WithInitials = Template.bind({});
(WithInitials as any).args = { initials: 'AB', size: 'md' };

export const Online = Template.bind({});
(Online as any).args = { initials: 'JD', size: 'md', online: true };

export const WithBadge = () => (
  <Avatar
    initials="JD"
    size="lg"
    badge={<Badge count={3} variant="error" size="sm" />}
  />
);

export const SizeXS = Template.bind({});
(SizeXS as any).args = { initials: 'AB', size: 'xs' };

export const SizeSM = Template.bind({});
(SizeSM as any).args = { initials: 'AB', size: 'sm' };

export const SizeMD = Template.bind({});
(SizeMD as any).args = { initials: 'AB', size: 'md' };

export const SizeLG = Template.bind({});
(SizeLG as any).args = { initials: 'AB', size: 'lg' };

export const SizeXL = Template.bind({});
(SizeXL as any).args = { initials: 'AB', size: 'xl' };

export const ShapeCircle = Template.bind({});
(ShapeCircle as any).args = { initials: 'JD', variant: 'circle', size: 'md' };

export const ShapeRounded = Template.bind({});
(ShapeRounded as any).args = { initials: 'JD', variant: 'rounded', size: 'md' };

export const ShapeSquare = Template.bind({});
(ShapeSquare as any).args = { initials: 'JD', variant: 'square', size: 'md' };

export const AllSizes = () => (
  <View style={styles.row}>
    {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
      <Avatar key={s} initials="JD" size={s} />
    ))}
  </View>
);

export const AllShapes = () => (
  <View style={styles.row}>
    {(['circle', 'rounded', 'square'] as const).map(v => (
      <Avatar key={v} initials="JD" variant={v} size="md" />
    ))}
  </View>
);

export const ColorVariants = () => (
  <View style={styles.row}>
    <Avatar initials="JD" size="md" backgroundColor={theme.colors.primary[500]} />
    <Avatar initials="JD" size="md" backgroundColor={theme.colors.success[500]} />
    <Avatar initials="JD" size="md" backgroundColor={theme.colors.warning[500]} />
    <Avatar initials="JD" size="md" backgroundColor={theme.colors.error[500]} />
    <Avatar initials="JD" size="md" backgroundColor={theme.colors.secondary[500]} />
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md, alignItems: 'center' },
});
