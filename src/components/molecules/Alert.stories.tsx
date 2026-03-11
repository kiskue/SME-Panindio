import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Alert, AlertVariant } from './Alert';
import { theme } from '../../core/theme';

export default {
  title: 'Molecules/Alert',
  component: Alert,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:    { control: { type: 'select' }, options: ['success', 'error', 'warning', 'info'] },
    size:       { control: { type: 'select' }, options: ['sm', 'md'] },
    dismissible:{ control: 'boolean' },
    title:      { control: 'text' },
    message:    { control: 'text' },
  },
};

const Template = (args: React.ComponentProps<typeof Alert>) => <Alert {...args} />;

export const Playground = Template.bind({});
(Playground as any).args = {
  variant: 'info',
  title: 'Heads up!',
  message: 'This is an alert message with some important information.',
};

export const Success = Template.bind({});
(Success as any).args = {
  variant: 'success',
  title: 'Success',
  message: 'Your account has been created successfully.',
};

export const Error = Template.bind({});
(Error as any).args = {
  variant: 'error',
  title: 'Error',
  message: 'Unable to complete the request. Please try again.',
};

export const Warning = Template.bind({});
(Warning as any).args = {
  variant: 'warning',
  title: 'Warning',
  message: 'Your session will expire in 10 minutes.',
};

export const Info = Template.bind({});
(Info as any).args = {
  variant: 'info',
  title: 'Information',
  message: 'A new update is available for your account.',
};

export const Dismissible = Template.bind({});
(Dismissible as any).args = {
  variant: 'info',
  title: 'Dismissible',
  message: 'Click the X to close this alert.',
  dismissible: true,
};

export const WithAction = Template.bind({});
(WithAction as any).args = {
  variant: 'warning',
  title: 'Subscription Expiring',
  message: 'Your Pro plan expires in 3 days.',
  action: { label: 'Renew Now', onPress: () => {} },
};

export const WithTitle = Template.bind({});
(WithTitle as any).args = {
  variant: 'success',
  title: 'Payment Confirmed',
  message: 'Your payment of $29.99 has been processed successfully.',
};

export const SmallSize = Template.bind({});
(SmallSize as any).args = {
  variant: 'info',
  message: 'Compact alert with no title.',
  size: 'sm',
};

export const MediumSize = Template.bind({});
(MediumSize as any).args = {
  variant: 'info',
  title: 'Medium Alert',
  message: 'Full size alert with title and description.',
  size: 'md',
};

const VARIANTS: AlertVariant[] = ['success', 'error', 'warning', 'info'];
const MESSAGES: Record<AlertVariant, string> = {
  success: 'Operation completed successfully.',
  error: 'An error occurred. Please try again.',
  warning: 'Please review before continuing.',
  info: 'Here is some useful information.',
};

export const AllVariants = () => (
  <View style={styles.column}>
    {VARIANTS.map(v => (
      <Alert key={v} variant={v} title={v.charAt(0).toUpperCase() + v.slice(1)} message={MESSAGES[v]} />
    ))}
  </View>
);

export const AllSizes = () => (
  <View style={styles.column}>
    <Alert variant="info" message="Compact (sm) alert — no title." size="sm" />
    <Alert variant="info" title="Full (md) Alert" message="Full size alert with title." size="md" />
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
