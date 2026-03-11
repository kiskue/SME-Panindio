import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Star, Heart, Bell, Plus, Trash2, Settings } from 'lucide-react-native';
import { IconButton } from './IconButton';
import { theme } from '../../core/theme';

const noop = () => {};

const whiteIcon  = (size: number) => <Star size={size} color={theme.colors.white} />;
const accentIcon = (size: number) => <Star size={size} color={theme.colors.primary[500]} />;

export default {
  title: 'Atoms/IconButton',
  component: IconButton,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:   { control: { type: 'select' }, options: ['primary', 'secondary', 'outline', 'ghost'] },
    size:      { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    shape:     { control: { type: 'select' }, options: ['circle', 'square'] },
    disabled:  { control: 'boolean' },
    loading:   { control: 'boolean' },
    onPress:   { action: 'pressed' },
  },
};

const Template = (args: React.ComponentProps<typeof IconButton>) => <IconButton {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = {
  icon: whiteIcon(20),
  accessibilityLabel: 'Star',
  variant: 'primary',
  size: 'md',
  shape: 'circle',
  disabled: false,
  loading: false,
  onPress: noop,
};

export const Primary = Template.bind({});
(Primary as any).args = { icon: whiteIcon(20),  accessibilityLabel: 'Primary',   variant: 'primary',   onPress: noop };

export const Secondary = Template.bind({});
(Secondary as any).args = { icon: <Heart size={20} color={theme.colors.white} />, accessibilityLabel: 'Secondary', variant: 'secondary', onPress: noop };

export const Outline = Template.bind({});
(Outline as any).args = { icon: accentIcon(20), accessibilityLabel: 'Outline',   variant: 'outline',   onPress: noop };

export const Ghost = Template.bind({});
(Ghost as any).args = { icon: <Plus size={20} color={theme.colors.primary[500]} />, accessibilityLabel: 'Ghost', variant: 'ghost', onPress: noop };

export const SizeSmall = Template.bind({});
(SizeSmall as any).args = { icon: whiteIcon(16), accessibilityLabel: 'Small', size: 'sm', onPress: noop };

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = { icon: whiteIcon(20), accessibilityLabel: 'Medium', size: 'md', onPress: noop };

export const SizeLarge = Template.bind({});
(SizeLarge as any).args = { icon: whiteIcon(24), accessibilityLabel: 'Large', size: 'lg', onPress: noop };

export const Loading = Template.bind({});
(Loading as any).args = { icon: whiteIcon(20), accessibilityLabel: 'Loading', loading: true, onPress: noop };

export const Disabled = Template.bind({});
(Disabled as any).args = { icon: whiteIcon(20), accessibilityLabel: 'Disabled', disabled: true, onPress: noop };

export const ShapeCircle = Template.bind({});
(ShapeCircle as any).args = { icon: whiteIcon(20), accessibilityLabel: 'Circle', shape: 'circle', onPress: noop };

export const ShapeSquare = Template.bind({});
(ShapeSquare as any).args = { icon: whiteIcon(20), accessibilityLabel: 'Square', shape: 'square', onPress: noop };

export const AllVariants = () => (
  <View style={styles.row}>
    {(['primary', 'secondary', 'outline', 'ghost'] as const).map(v => (
      <IconButton
        key={v}
        icon={
          v === 'primary' || v === 'secondary'
            ? <Star size={20} color={theme.colors.white} />
            : <Star size={20} color={theme.colors.primary[500]} />
        }
        accessibilityLabel={v}
        variant={v}
        onPress={noop}
      />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.row}>
    <IconButton icon={whiteIcon(16)} accessibilityLabel="sm" size="sm" onPress={noop} />
    <IconButton icon={whiteIcon(20)} accessibilityLabel="md" size="md" onPress={noop} />
    <IconButton icon={whiteIcon(24)} accessibilityLabel="lg" size="lg" onPress={noop} />
  </View>
);

export const ActionRow = () => (
  <View style={styles.row}>
    <IconButton icon={<Bell size={20} color={theme.colors.white} />}    accessibilityLabel="Bell"     variant="primary"   onPress={noop} />
    <IconButton icon={<Heart size={20} color={theme.colors.white} />}   accessibilityLabel="Heart"    variant="secondary" onPress={noop} />
    <IconButton icon={<Settings size={20} color={theme.colors.primary[500]} />} accessibilityLabel="Settings" variant="outline"   onPress={noop} />
    <IconButton icon={<Trash2 size={20} color={theme.colors.error[500]} />}    accessibilityLabel="Delete"   variant="ghost"     onPress={noop} />
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
});
