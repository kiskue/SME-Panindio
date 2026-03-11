import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { LoginForm } from './LoginForm';
import { Text } from '../atoms/Text';

export default {
  title: 'Organisms/LoginForm',
  component: LoginForm,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView
        contentContainerStyle={styles.decorator}
        keyboardShouldPersistTaps="handled"
      >
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    isLoading:    { control: 'boolean' },
    error:        { control: 'text' },
    onSubmit:     { action: 'submitted' },
    onDemoPress:  { action: 'demo-pressed' },
  },
};

const Template = (args: React.ComponentProps<typeof LoginForm>) => (
  <View style={styles.card}>
    <LoginForm {...args} />
  </View>
);

// ─── Playground ───────────────────────────────────────────────────────────────
export const Playground = Template.bind({});
(Playground as any).args = {
  isLoading: false,
  error: '',
};

// ─── Individual states ───────────────────────────────────────────────────────
export const Default = Template.bind({});
(Default as any).args = { onSubmit: () => {} };

export const WithError = Template.bind({});
(WithError as any).args = {
  onSubmit: () => {},
  error: 'Invalid email or password. Please try again.',
};

export const Loading = Template.bind({});
(Loading as any).args = {
  onSubmit: () => {},
  isLoading: true,
};

export const WithDemoButton = Template.bind({});
(WithDemoButton as any).args = {
  onDemoPress: () => {},
};

export const WithDemoAndError = Template.bind({});
(WithDemoAndError as any).args = {
  onDemoPress: () => {},
  error: 'Your account has been temporarily locked. Try again in 10 minutes.',
};

export const NetworkError = Template.bind({});
(NetworkError as any).args = {
  onSubmit: () => {},
  error: 'Unable to connect. Check your internet connection and try again.',
};

// ─── In-page context ─────────────────────────────────────────────────────────
export const InPageContext = () => (
  <View style={styles.page}>
    <View style={styles.header}>
      <Text variant="h2" weight="bold" color="primary" align="center">Welcome back</Text>
      <Text variant="body-sm" color="gray" align="center" style={styles.subtitle}>
        Sign in to your account to continue.
      </Text>
    </View>
    <View style={styles.card}>
      <LoginForm onSubmit={() => {}} onDemoPress={() => {}} />
    </View>
  </View>
);

export const InPageContextWithError = () => (
  <View style={styles.page}>
    <View style={styles.header}>
      <Text variant="h2" weight="bold" color="primary" align="center">Welcome back</Text>
      <Text variant="body-sm" color="gray" align="center" style={styles.subtitle}>
        Sign in to your account to continue.
      </Text>
    </View>
    <View style={styles.card}>
      <LoginForm
        onSubmit={() => {}}
        onDemoPress={() => {}}
        error="Incorrect email or password. Please check your credentials and try again."
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, flexGrow: 1 },
  page:      { flex: 1, justifyContent: 'center' },
  header:    { marginBottom: theme.spacing.xl },
  subtitle:  { marginTop: theme.spacing.xs },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
});
