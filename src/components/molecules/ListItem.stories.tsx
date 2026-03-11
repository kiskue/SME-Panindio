import React from 'react';
import { View, StyleSheet, ScrollView, Alert as RNAlert } from 'react-native';
import { User, Settings, Bell, Trash2, CreditCard } from 'lucide-react-native';
import { ListItem } from './ListItem';
import { Badge } from '../atoms/Badge';
import { Avatar } from '../atoms/Avatar';
import { theme } from '../../core/theme';

const noop = () => {};

export default {
  title: 'Molecules/ListItem',
  component: ListItem,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    title:       { control: 'text' },
    subtitle:    { control: 'text' },
    padding:     { control: { type: 'select' }, options: ['sm', 'md', 'lg'] },
    divider:     { control: 'boolean' },
    disabled:    { control: 'boolean' },
    destructive: { control: 'boolean' },
  },
};

const Template = (args: React.ComponentProps<typeof ListItem>) => <ListItem {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = { title: 'List Item', onPress: noop };

export const Simple = Template.bind({});
(Simple as any).args = { title: 'Simple Item' };

export const WithSubtitle = Template.bind({});
(WithSubtitle as any).args = {
  title: 'John Doe',
  subtitle: 'john@example.com',
};

export const WithLeftIcon = Template.bind({});
(WithLeftIcon as any).args = {
  title: 'Profile',
  subtitle: 'View your profile',
  leftIcon: <User size={20} color={theme.colors.primary[500]} />,
  onPress: noop,
};

export const WithRightIcon = Template.bind({});
(WithRightIcon as any).args = {
  title: 'Settings',
  leftIcon: <Settings size={20} color={theme.colors.gray[500]} />,
  rightIcon: <Settings size={16} color={theme.colors.gray[400]} />,
  onPress: noop,
};

export const WithBadge = Template.bind({});
(WithBadge as any).args = {
  title: 'Notifications',
  leftIcon: <Bell size={20} color={theme.colors.primary[500]} />,
  badge: <Badge count={5} variant="error" />,
  onPress: noop,
};

export const Destructive = Template.bind({});
(Destructive as any).args = {
  title: 'Delete Account',
  leftIcon: <Trash2 size={20} color={theme.colors.error[500]} />,
  destructive: true,
  onPress: noop,
};

export const Disabled = Template.bind({});
(Disabled as any).args = { title: 'Disabled Item', disabled: true, onPress: noop };

export const WithDivider = Template.bind({});
(WithDivider as any).args = { title: 'Item with Divider', divider: true, onPress: noop };

export const PaddingSm = Template.bind({});
(PaddingSm as any).args = { title: 'Small Padding', padding: 'sm', onPress: noop };

export const PaddingLg = Template.bind({});
(PaddingLg as any).args = { title: 'Large Padding', padding: 'lg', onPress: noop };

export const PressableItem = Template.bind({});
(PressableItem as any).args = {
  title: 'Press me',
  subtitle: 'Tap to trigger action',
  leftIcon: <Bell size={20} color={theme.colors.primary[500]} />,
  onPress: () => RNAlert.alert('Pressed!'),
};

export const ListGroup = () => (
  <View style={styles.group}>
    <ListItem
      title="Profile"
      subtitle="Manage your profile"
      leftIcon={<User size={20} color={theme.colors.primary[500]} />}
      divider
      onPress={noop}
    />
    <ListItem
      title="Notifications"
      subtitle="Push, email, SMS"
      leftIcon={<Bell size={20} color={theme.colors.primary[500]} />}
      badge={<Badge count={3} variant="error" />}
      divider
      onPress={noop}
    />
    <ListItem
      title="Payment Methods"
      subtitle="Manage cards"
      leftIcon={<CreditCard size={20} color={theme.colors.primary[500]} />}
      divider
      onPress={noop}
    />
    <ListItem
      title="Settings"
      leftIcon={<Settings size={20} color={theme.colors.gray[500]} />}
      onPress={noop}
    />
  </View>
);

export const WithAvatar = () => (
  <View style={styles.group}>
    {['Alice Johnson', 'Bob Smith', 'Carol White'].map((name, i) => (
      <ListItem
        key={name}
        title={name}
        subtitle="Active 2m ago"
        leftIcon={
          <Avatar
            initials={name.split(' ').map(n => n[0]).join('')}
            size="sm"
            backgroundColor={[theme.colors.primary[400], theme.colors.success[400], theme.colors.warning[400]][i]}
          />
        }
        divider={i < 2}
        onPress={noop}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  group: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
});
