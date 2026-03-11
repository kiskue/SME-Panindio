import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Bell, Search, MessageCircle, Package } from 'lucide-react-native';
import { EmptyState } from './EmptyState';
import { theme } from '../../core/theme';

const noop = () => {};

export default {
  title: 'Molecules/EmptyState',
  component: EmptyState,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    size:    { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    compact: { control: 'boolean' },
    title:   { control: 'text' },
    description: { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof EmptyState>) => <EmptyState {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = {
  title: 'Nothing here yet',
  description: 'Start by adding some content.',
  size: 'md',
};

export const NoData = Template.bind({});
(NoData as any).args = {
  icon: <Package size={28} color={theme.colors.gray[400]} />,
  title: 'No items found',
  description: 'Your list is empty. Add your first item to get started.',
};

export const NoResults = Template.bind({});
(NoResults as any).args = {
  icon: <Search size={28} color={theme.colors.gray[400]} />,
  title: 'No results',
  description: 'We couldn\'t find any results for your search. Try different keywords.',
};

export const NoNotifications = Template.bind({});
(NoNotifications as any).args = {
  icon: <Bell size={28} color={theme.colors.gray[400]} />,
  title: 'No notifications',
  description: 'You\'re all caught up! We\'ll notify you when something new arrives.',
};

export const NoMessages = Template.bind({});
(NoMessages as any).args = {
  icon: <MessageCircle size={28} color={theme.colors.gray[400]} />,
  title: 'No messages yet',
  description: 'Start a conversation to see your messages here.',
};

export const WithAction = Template.bind({});
(WithAction as any).args = {
  icon: <Package size={28} color={theme.colors.gray[400]} />,
  title: 'No products',
  description: 'Add your first product to start selling.',
  action: { label: 'Add Product', onPress: noop },
};

export const WithBothActions = Template.bind({});
(WithBothActions as any).args = {
  icon: <Package size={28} color={theme.colors.gray[400]} />,
  title: 'No orders yet',
  description: 'Explore our catalog and place your first order.',
  action: { label: 'Browse Catalog', onPress: noop },
  secondaryAction: { label: 'Import Orders', onPress: noop },
};

export const Compact = Template.bind({});
(Compact as any).args = {
  icon: <Search size={20} color={theme.colors.gray[400]} />,
  title: 'No results',
  description: 'Try a different search.',
  compact: true,
  action: { label: 'Clear', onPress: noop, variant: 'outline' },
};

export const SizeSmall = Template.bind({});
(SizeSmall as any).args = {
  icon: <Bell size={20} color={theme.colors.gray[400]} />,
  title: 'Empty',
  description: 'Nothing to show.',
  size: 'sm',
};

export const SizeMedium = Template.bind({});
(SizeMedium as any).args = {
  icon: <Bell size={28} color={theme.colors.gray[400]} />,
  title: 'No notifications',
  description: 'You\'re all caught up.',
  size: 'md',
};

export const SizeLarge = Template.bind({});
(SizeLarge as any).args = {
  icon: <Bell size={36} color={theme.colors.gray[400]} />,
  title: 'Inbox Zero',
  description: 'Great job! You have no unread notifications.',
  size: 'lg',
  action: { label: 'Refresh', onPress: noop },
};

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg'] as const).map(s => (
      <View key={s} style={styles.sizeBlock}>
        <EmptyState
          icon={<Bell size={s === 'sm' ? 20 : s === 'md' ? 28 : 36} color={theme.colors.gray[400]} />}
          title={`Size: ${s}`}
          description="Empty state description."
          size={s}
        />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  sizeBlock: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.md,
  },
});
