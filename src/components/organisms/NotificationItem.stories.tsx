import React from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { theme } from '../../core/theme';
import { Notification, NotificationType } from '../../types';
import { NotificationItem } from './NotificationItem';
import { Text } from '../atoms/Text';

// ─── Mock factory ────────────────────────────────────────────────────────────
const makeNotification = (overrides: Partial<Notification> & Pick<Notification, 'type'>): Notification => ({
  id: `notif-${overrides.type.toLowerCase()}`,
  userId: 'user-123',
  title: overrides.title ?? 'Notification title',
  body: overrides.body ?? 'This is the notification body text.',
  isRead: overrides.isRead ?? false,
  createdAt: overrides.createdAt ?? new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  ...overrides,
});

// Flatten notification fields into top-level Storybook controls so the
// Controls panel can drive every visual aspect of the component.
interface PlaygroundArgs {
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  showTime: boolean;
  minutesAgo: number;
}

const PlaygroundWrapper = ({ type, title, body, isRead, showTime, minutesAgo }: PlaygroundArgs) => {
  const notification = makeNotification({
    type,
    title,
    body,
    isRead,
    createdAt: new Date(Date.now() - minutesAgo * 60 * 1000).toISOString(),
  });
  return (
    <NotificationItem
      notification={notification}
      showTime={showTime}
      onPress={() => Alert.alert('Notification pressed', title)}
      onDismiss={() => Alert.alert('Dismissed', title)}
    />
  );
};

export default {
  title: 'Organisms/NotificationItem',
  component: PlaygroundWrapper,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    type:       { control: { type: 'select' }, options: ['INFO', 'WARNING', 'ALERT', 'CHAT_MESSAGE'] },
    title:      { control: 'text' },
    body:       { control: 'text' },
    isRead:     { control: 'boolean' },
    showTime:   { control: 'boolean' },
    minutesAgo: { control: { type: 'range', min: 0, max: 10080, step: 1 } },
  },
};

const Template = (args: PlaygroundArgs) => <PlaygroundWrapper {...args} />;

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  type: 'INFO',
  title: 'System Update Available',
  body: "Version 2.1.0 is ready to install. Tap to learn what's new.",
  isRead: false,
  showTime: true,
  minutesAgo: 5,
};

// ─── By type ─────────────────────────────────────────────────────────────────
export const InfoType = Template.bind({});
(InfoType as any).args = {
  type: 'INFO',
  title: 'System Update Available',
  body: "Version 2.1.0 is ready to install. Tap to learn what's new.",
  isRead: false,
  showTime: true,
  minutesAgo: 3,
};

export const WarningType = Template.bind({});
(WarningType as any).args = {
  type: 'WARNING',
  title: 'Storage Running Low',
  body: 'You have used 92% of your allocated storage. Consider archiving old files.',
  isRead: false,
  showTime: true,
  minutesAgo: 25,
};

export const AlertType = Template.bind({});
(AlertType as any).args = {
  type: 'ALERT',
  title: 'Unusual Sign-in Detected',
  body: 'A sign-in from a new device was detected. If this was not you, secure your account immediately.',
  isRead: false,
  showTime: true,
  minutesAgo: 120,
};

export const ChatMessageType = Template.bind({});
(ChatMessageType as any).args = {
  type: 'CHAT_MESSAGE',
  title: 'New message from Alex',
  body: 'Hey, are you available for a quick call this afternoon?',
  isRead: false,
  showTime: true,
  minutesAgo: 1,
};

// ─── Read / unread ───────────────────────────────────────────────────────────
export const Unread = Template.bind({});
(Unread as any).args = {
  type: 'INFO',
  title: 'New notification',
  body: 'Unread items have a left accent border and a filled background.',
  isRead: false,
  showTime: true,
  minutesAgo: 2,
};

export const Read = Template.bind({});
(Read as any).args = {
  type: 'INFO',
  title: 'Monthly Report Ready',
  body: 'Your analytics report for January is ready to view.',
  isRead: true,
  showTime: true,
  minutesAgo: 4320, // 3 days
};

// ─── Options ─────────────────────────────────────────────────────────────────
export const WithoutTimestamp = Template.bind({});
(WithoutTimestamp as any).args = {
  type: 'INFO',
  title: 'No timestamp shown',
  body: 'The time indicator is hidden when showTime is false.',
  isRead: false,
  showTime: false,
  minutesAgo: 10,
};

// ─── With metadata ───────────────────────────────────────────────────────────
// Metadata requires passing a full notification object, so this story renders directly.
export const WithMetadata = () => (
  <NotificationItem
    notification={makeNotification({
      type: 'ALERT',
      title: 'Payment Failed',
      body: 'We were unable to process your payment. Please update your billing details.',
      isRead: false,
      data: { amount: 49.99, currency: 'USD', attempt: 2 },
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    })}
    onDismiss={() => Alert.alert('Dismissed')}
  />
);

// ─── Composite: All types ────────────────────────────────────────────────────
export const AllTypes = () => {
  const items: Array<{ type: NotificationType; title: string; body: string; minutesAgo: number }> = [
    { type: 'INFO',         title: 'System Update Available', body: "Version 2.1.0 is ready.",                minutesAgo: 3   },
    { type: 'WARNING',      title: 'Storage Running Low',     body: 'You have used 92% of storage.',          minutesAgo: 25  },
    { type: 'ALERT',        title: 'Unusual Sign-in',         body: 'A sign-in from new device detected.',    minutesAgo: 120 },
    { type: 'CHAT_MESSAGE', title: 'New message from Alex',   body: 'Are you free for a call?',               minutesAgo: 1   },
  ];

  return (
    <View style={styles.column}>
      <Text variant="h6" weight="semibold" color="gray" style={styles.sectionLabel}>Unread</Text>
      {items.map(item => (
        <NotificationItem
          key={item.type}
          notification={makeNotification({
            ...item,
            isRead: false,
            createdAt: new Date(Date.now() - item.minutesAgo * 60 * 1000).toISOString(),
          })}
          onPress={() => Alert.alert('Pressed', item.title)}
          onDismiss={() => Alert.alert('Dismissed', item.title)}
        />
      ))}

      <Text variant="h6" weight="semibold" color="gray" style={styles.sectionLabel}>Read</Text>
      <NotificationItem
        notification={makeNotification({
          type: 'INFO',
          title: 'Monthly Report Ready',
          body: 'Your January analytics report is available.',
          isRead: true,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  decorator:    { padding: theme.spacing.md, backgroundColor: theme.colors.surface, flexGrow: 1 },
  column:       { gap: theme.spacing.xs },
  sectionLabel: { marginTop: theme.spacing.md, marginBottom: theme.spacing.xs },
});
