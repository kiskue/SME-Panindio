import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Toast, ToastVariant } from './Toast';
import { Button } from '../atoms/Button';
import { theme } from '../../core/theme';

export default {
  title: 'Molecules/Toast',
  component: Toast,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    variant:  { control: { type: 'select' }, options: ['success', 'error', 'warning', 'info'] },
    position: { control: { type: 'select' }, options: ['top', 'bottom'] },
    duration: { control: 'number' },
    message:  { control: 'text' },
  },
};

const ToastDemo = ({
  variant,
  message,
  position = 'bottom',
  duration = 3000,
  action,
}: {
  variant: ToastVariant;
  message: string;
  position?: 'top' | 'bottom';
  duration?: number;
  action?: { label: string; onPress: () => void };
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.demoContainer}>
      <Button
        title={`Show ${variant} toast`}
        variant="outline"
        onPress={() => setVisible(true)}
        fullWidth
      />
      <Toast
        visible={visible}
        variant={variant}
        message={message}
        position={position}
        duration={duration}
        onDismiss={() => setVisible(false)}
        {...(action !== undefined ? { action } : {})}
      />
    </View>
  );
};

export const Playground = () => (
  <ToastDemo variant="info" message="This is a toast notification." />
);

export const SuccessToast = () => (
  <ToastDemo variant="success" message="Your changes have been saved successfully!" />
);

export const ErrorToast = () => (
  <ToastDemo variant="error" message="Something went wrong. Please try again." />
);

export const WarningToast = () => (
  <ToastDemo variant="warning" message="Your session will expire in 5 minutes." />
);

export const InfoToast = () => (
  <ToastDemo variant="info" message="New version available. Restart to update." />
);

export const TopPosition = () => (
  <ToastDemo variant="success" message="Profile updated." position="top" />
);

export const BottomPosition = () => (
  <ToastDemo variant="info" message="Changes saved." position="bottom" />
);

export const WithAction = () => (
  <ToastDemo
    variant="info"
    message="Item deleted."
    action={{ label: 'UNDO', onPress: () => {} }}
  />
);

export const LongMessage = () => (
  <ToastDemo
    variant="warning"
    message="Your subscription will expire soon. Please renew your plan to avoid service interruption."
  />
);

export const AllVariants = () => {
  const variants: ToastVariant[] = ['success', 'error', 'warning', 'info'];
  const messages: Record<ToastVariant, string> = {
    success: 'Operation successful!',
    error: 'Something went wrong.',
    warning: 'Proceed with caution.',
    info: 'Here is some information.',
  };
  return (
    <View style={styles.column}>
      {variants.map(v => (
        <ToastDemo key={v} variant={v} message={messages[v]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#f5f5f5', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  demoContainer: {
    height: 160,
    justifyContent: 'center',
    position: 'relative',
  },
});
