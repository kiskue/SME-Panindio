import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Home, Bell, User, Settings, Star, Heart } from 'lucide-react-native';
import { Tabs, Tab, TabPanel } from './Tabs';
import { Text } from '../atoms/Text';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/Tabs',
  component: Tabs,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
};

const BASIC_TABS: Tab[] = [
  { key: 'home',     label: 'Home' },
  { key: 'profile',  label: 'Profile' },
  { key: 'settings', label: 'Settings' },
];

const TabsWrapper = (props: Omit<React.ComponentProps<typeof Tabs>, 'activeTab' | 'onTabChange'>) => {
  const [active, setActive] = useState(props.tabs[0]?.key ?? '');
  return <Tabs {...props} activeTab={active} onTabChange={setActive} />;
};

export const Playground = () => <TabsWrapper tabs={BASIC_TABS} variant="line" />;

export const LineVariant = () => {
  const [active, setActive] = useState('home');
  return (
    <View>
      <Tabs tabs={BASIC_TABS} activeTab={active} onTabChange={setActive} variant="line" />
      <View style={styles.panel}>
        <TabPanel tabKey="home"     activeTab={active}><Text variant="body">Home content</Text></TabPanel>
        <TabPanel tabKey="profile"  activeTab={active}><Text variant="body">Profile content</Text></TabPanel>
        <TabPanel tabKey="settings" activeTab={active}><Text variant="body">Settings content</Text></TabPanel>
      </View>
    </View>
  );
};

export const PillVariant = () => <TabsWrapper tabs={BASIC_TABS} variant="pill" />;

export const ButtonVariant = () => <TabsWrapper tabs={BASIC_TABS} variant="button" />;

export const WithIcons = () => {
  const tabs: Tab[] = [
    { key: 'home',     label: 'Home',     icon: <Home     size={16} color={theme.colors.gray[500]} /> },
    { key: 'notifs',   label: 'Alerts',   icon: <Bell     size={16} color={theme.colors.gray[500]} /> },
    { key: 'profile',  label: 'Profile',  icon: <User     size={16} color={theme.colors.gray[500]} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} color={theme.colors.gray[500]} /> },
  ];
  return <TabsWrapper tabs={tabs} variant="line" />;
};

export const WithBadge = () => {
  const tabs: Tab[] = [
    { key: 'home',    label: 'Home' },
    { key: 'notifs',  label: 'Notifications', badge: 5 },
    { key: 'profile', label: 'Profile',       badge: 1 },
  ];
  return <TabsWrapper tabs={tabs} variant="line" />;
};

export const ScrollableTabs = () => {
  const tabs: Tab[] = [
    'Overview', 'Features', 'Pricing', 'Reviews', 'FAQ', 'Support', 'Blog', 'Contact',
  ].map((label, i) => ({ key: `tab-${i}`, label }));
  return <TabsWrapper tabs={tabs} variant="line" scrollable />;
};

export const FullWidth = () => <TabsWrapper tabs={BASIC_TABS} variant="line" fullWidth />;

export const SizeSmall  = () => <TabsWrapper tabs={BASIC_TABS} variant="line" size="sm" />;
export const SizeMedium = () => <TabsWrapper tabs={BASIC_TABS} variant="line" size="md" />;
export const SizeLarge  = () => <TabsWrapper tabs={BASIC_TABS} variant="line" size="lg" />;

export const WithDisabled = () => {
  const tabs: Tab[] = [
    { key: 'home',     label: 'Home' },
    { key: 'premium',  label: 'Premium', disabled: true },
    { key: 'settings', label: 'Settings' },
  ];
  return <TabsWrapper tabs={tabs} variant="line" />;
};

export const AllVariants = () => {
  const [a1, setA1] = useState('home');
  const [a2, setA2] = useState('home');
  const [a3, setA3] = useState('home');

  const tabs: Tab[] = [
    { key: 'home',    label: 'Home',    icon: <Home    size={14} color={theme.colors.gray[500]} /> },
    { key: 'starred', label: 'Starred', icon: <Star    size={14} color={theme.colors.gray[500]} /> },
    { key: 'liked',   label: 'Liked',   icon: <Heart   size={14} color={theme.colors.gray[500]} /> },
  ];

  return (
    <View style={styles.column}>
      <Tabs tabs={tabs} activeTab={a1} onTabChange={setA1} variant="line" />
      <Tabs tabs={tabs} activeTab={a2} onTabChange={setA2} variant="pill" />
      <Tabs tabs={tabs} activeTab={a3} onTabChange={setA3} variant="button" />
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.xl },
  panel: { padding: theme.spacing.md },
});
