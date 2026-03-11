import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Home, Bell, Settings, User, CreditCard, HelpCircle, LogOut, Trash2 } from 'lucide-react-native';
import { Drawer, DrawerItem } from './Drawer';
import { Button } from '../atoms/Button';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Text } from '../atoms/Text';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/Drawer',
  component: Drawer,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
};

const DrawerDemo = (
  props: Omit<React.ComponentProps<typeof Drawer>, 'visible' | 'onClose'> & {
    triggerLabel?: string;
  },
) => {
  const [visible, setVisible] = useState(false);
  const { triggerLabel = 'Open Drawer', ...rest } = props;
  return (
    <View>
      <Button title={triggerLabel} onPress={() => setVisible(true)} fullWidth variant="outline" />
      <Drawer visible={visible} onClose={() => setVisible(false)} {...rest} />
    </View>
  );
};

const NAV_ITEMS: DrawerItem[] = [
  { key: 'home',     label: 'Home',     icon: <Home     size={20} color={theme.colors.primary[500]} /> },
  { key: 'notifs',   label: 'Notifications', icon: <Bell size={20} color={theme.colors.primary[500]} />, badge: 5 },
  { key: 'profile',  label: 'Profile',  icon: <User     size={20} color={theme.colors.gray[500]} /> },
  { key: 'payment',  label: 'Payments', icon: <CreditCard size={20} color={theme.colors.gray[500]} /> },
  { key: 'settings', label: 'Settings', icon: <Settings size={20} color={theme.colors.gray[500]} />, dividerBefore: true },
  { key: 'help',     label: 'Help & Support', icon: <HelpCircle size={20} color={theme.colors.gray[500]} /> },
  { key: 'delete',   label: 'Delete Account', icon: <Trash2 size={20} color={theme.colors.error[500]} />, destructive: true, dividerBefore: true },
];

export const Default = () => (
  <DrawerDemo triggerLabel="Open Left Drawer" items={NAV_ITEMS.slice(0, 4)} position="left" />
);

export const RightDrawer = () => (
  <DrawerDemo triggerLabel="Open Right Drawer" items={NAV_ITEMS.slice(0, 4)} position="right" />
);

export const WithHeader = () => (
  <DrawerDemo
    triggerLabel="Drawer With Header"
    items={NAV_ITEMS.slice(0, 4)}
    header={
      <View style={styles.headerContent}>
        <Avatar initials="JD" size="lg" backgroundColor={theme.colors.primary[500]} />
        <View style={styles.headerText}>
          <Text variant="h4" weight="semibold">John Doe</Text>
          <Text variant="body-sm" color="gray">john@example.com</Text>
        </View>
      </View>
    }
  />
);

export const WithItems = () => (
  <DrawerDemo triggerLabel="With Items" items={NAV_ITEMS.slice(0, 6)} />
);

export const WithFooter = () => (
  <DrawerDemo
    triggerLabel="With Footer"
    items={NAV_ITEMS.slice(0, 5)}
    footer={
      <Button title="Log Out" variant="outline" onPress={() => {}} fullWidth />
    }
  />
);

export const WithDividers = () => (
  <DrawerDemo triggerLabel="With Dividers" items={NAV_ITEMS} />
);

export const DestructiveItem = () => (
  <DrawerDemo
    triggerLabel="Destructive Items"
    items={[
      { key: 'home', label: 'Home', icon: <Home size={20} color={theme.colors.primary[500]} /> },
      { key: 'logout', label: 'Logout', icon: <LogOut size={20} color={theme.colors.error[500]} />, destructive: true, dividerBefore: true },
    ]}
  />
);

export const NarrowDrawer = () => (
  <DrawerDemo triggerLabel="Narrow Drawer (60%)" items={NAV_ITEMS.slice(0, 4)} width={SCREEN_WIDTH * 0.6} />
);

export const WideDrawer = () => (
  <DrawerDemo triggerLabel="Wide Drawer (90%)" items={NAV_ITEMS.slice(0, 4)} width={SCREEN_WIDTH * 0.9} />
);

export const FullNavDrawer = () => {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Button title="Open Full Navigation Drawer" onPress={() => setVisible(true)} fullWidth />
      <Drawer
        visible={visible}
        onClose={() => setVisible(false)}
        header={
          <View style={styles.headerContent}>
            <Avatar initials="JD" size="lg" online badge={<Badge count={3} variant="error" size="sm" />} />
            <View style={styles.headerText}>
              <Text variant="h4" weight="semibold">John Doe</Text>
              <Text variant="body-sm" color="gray">john@example.com</Text>
              <Text variant="body-sm" style={{ color: theme.colors.success[600] }}>Pro Plan</Text>
            </View>
          </View>
        }
        items={NAV_ITEMS}
        footer={
          <Button
            title="Log Out"
            variant="outline"
            onPress={() => {}}
            fullWidth
            leftIcon={<LogOut size={16} color={theme.colors.primary[500]} />}
          />
        }
      />
    </View>
  );
};

import { Dimensions } from 'react-native';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
});
