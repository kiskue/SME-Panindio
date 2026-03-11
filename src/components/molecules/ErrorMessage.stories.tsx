import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { ErrorMessage } from './ErrorMessage';
import { Text } from '../atoms/Text';

export default {
  title: 'Molecules/ErrorMessage',
  component: ErrorMessage,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    message:     { control: 'text' },
    variant:     { control: { type: 'select' }, options: ['error', 'warning', 'info', 'success'] },
    dismissible: { control: 'boolean' },
    onDismiss:   { action: 'dismissed' },
  },
};

const Template = (args: React.ComponentProps<typeof ErrorMessage>) => (
  <ErrorMessage {...args} />
);

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  message: 'Something went wrong. Please try again.',
  variant: 'error',
  dismissible: false,
};

// ─── Variants ────────────────────────────────────────────────────────────────
export const Error = Template.bind({});
(Error as any).args = {
  variant: 'error',
  message: 'Your session has expired. Please sign in again.',
};

export const Warning = Template.bind({});
(Warning as any).args = {
  variant: 'warning',
  message: 'Your subscription expires in 3 days. Renew to avoid interruption.',
};

export const Info = Template.bind({});
(Info as any).args = {
  variant: 'info',
  message: 'A new version is available. Restart the app to update.',
};

export const Success = Template.bind({});
(Success as any).args = {
  variant: 'success',
  message: 'Your profile has been updated successfully.',
};

// ─── Dismissible ─────────────────────────────────────────────────────────────
export const DismissibleError = Template.bind({});
(DismissibleError as any).args = {
  variant: 'error',
  message: 'Network request failed. Check your connection.',
  dismissible: true,
};

export const DismissibleWarning = Template.bind({});
(DismissibleWarning as any).args = {
  variant: 'warning',
  message: 'Unsaved changes will be lost if you leave this screen.',
  dismissible: true,
};

export const DismissibleSuccess = Template.bind({});
(DismissibleSuccess as any).args = {
  variant: 'success',
  message: 'File uploaded successfully.',
  dismissible: true,
};

// ─── With icon ───────────────────────────────────────────────────────────────
export const WithIconError = Template.bind({});
(WithIconError as any).args = {
  variant: 'error',
  message: 'Authentication failed. Invalid credentials.',
  icon: <Text variant="body-sm">🔒</Text>,
};

export const WithIconInfo = Template.bind({});
(WithIconInfo as any).args = {
  variant: 'info',
  message: 'Two-factor authentication is required for this action.',
  icon: <Text variant="body-sm">ℹ️</Text>,
};

export const WithIconSuccess = Template.bind({});
(WithIconSuccess as any).args = {
  variant: 'success',
  message: 'Payment processed successfully.',
  icon: <Text variant="body-sm">✅</Text>,
};

// ─── Long message ────────────────────────────────────────────────────────────
export const LongMessage = Template.bind({});
(LongMessage as any).args = {
  variant: 'error',
  message:
    'We were unable to process your payment. Please check your card details and ensure your billing address matches what your bank has on file, then try again.',
};

// ─── Composites ──────────────────────────────────────────────────────────────
export const AllVariants = () => (
  <View style={styles.column}>
    {([
      { variant: 'error'   as const, message: 'Something went wrong. Please try again.',               icon: '❌' },
      { variant: 'warning' as const, message: 'Proceed with caution — this action cannot be undone.',  icon: '⚠️' },
      { variant: 'info'    as const, message: 'You have 3 unread notifications.',                       icon: 'ℹ️' },
      { variant: 'success' as const, message: 'Changes saved successfully.',                            icon: '✅' },
    ]).map(({ variant, message, icon }) => (
      <View key={variant}>
        <Text variant="caption" color="gray" style={styles.label}>{variant}</Text>
        <ErrorMessage
          variant={variant}
          message={message}
          icon={<Text variant="body-sm">{icon}</Text>}
          dismissible
          onDismiss={() => {}}
        />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column:    { gap: theme.spacing.sm },
  label:     { marginBottom: theme.spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
});
