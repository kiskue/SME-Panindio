import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { User } from 'lucide-react-native';
import { TopNavBar } from './TopNavBar';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/TopNavBar',
  component: TopNavBar,
  decorators: [
    (Story: () => React.ReactElement) => (
      <View style={styles.decorator}>
        <Story />
      </View>
    ),
  ],
};

// ── Default: logo centre, hamburger left, bell right ─────────────────────────
export const Default = () => (
  <TopNavBar
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={0}
  />
);

// ── With unread badge ─────────────────────────────────────────────────────────
export const WithBadge = () => (
  <TopNavBar
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={5}
  />
);

// ── Large badge (99+) ─────────────────────────────────────────────────────────
export const LargeBadge = () => (
  <TopNavBar
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={127}
  />
);

// ── With screen title instead of logo ────────────────────────────────────────
export const WithTitle = () => (
  <TopNavBar
    title="Notifications"
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={3}
  />
);

// ── Back button variant (nested screen) ──────────────────────────────────────
export const WithBackButton = () => (
  <TopNavBar
    title="Product Details"
    showMenuButton={false}
    showBackButton
    onBackPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={0}
  />
);

// ── With custom right action ──────────────────────────────────────────────────
export const WithRightAction = () => (
  <TopNavBar
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={2}
    rightAction={
      <View style={styles.avatarPlaceholder}>
        <User size={16} color={theme.colors.white} />
      </View>
    }
  />
);

// ── Custom background (e.g. accent green for a specific module) ───────────────
export const AccentBackground = () => (
  <TopNavBar
    title="Inventory"
    onMenuPress={() => {}}
    onNotificationPress={() => {}}
    notificationCount={0}
    backgroundColor={theme.colors.accent[500]}
  />
);

// ── Interactive: toggle badge ─────────────────────────────────────────────────
export const Interactive = () => {
  const [count, setCount] = useState(3);
  return (
    <View>
      <TopNavBar
        onMenuPress={() => {}}
        onNotificationPress={() => setCount(0)}
        notificationCount={count}
      />
      <View style={styles.controls}>
        <Text style={styles.label} onPress={() => setCount(c => c + 1)}>
          + Add notification
        </Text>
        <Text style={styles.label} onPress={() => setCount(0)}>
          Clear all
        </Text>
      </View>
    </View>
  );
};

// ── No buttons ────────────────────────────────────────────────────────────────
export const NoButtons = () => (
  <TopNavBar showMenuButton={false} />
);

const styles = StyleSheet.create({
  decorator: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: 'row',
  },
  label: {
    color: theme.colors.primary[500],
    fontSize: 14,
    fontWeight: '600',
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
    borderRadius: theme.borderRadius.md,
  },
});
