import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { LoaderOverlay } from './LoaderOverlay';
import { Button } from '../atoms/Button';
import { theme } from '../../core/theme';

export default {
  title: 'Molecules/LoaderOverlay',
  component: LoaderOverlay,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
  argTypes: {
    message: { control: 'text' },
  },
};

const Demo = ({
  label,
  message,
  color,
}: {
  label:    string;
  message?: string;
  color?:   string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Button
        title={label}
        onPress={() => {
          setVisible(true);
          setTimeout(() => setVisible(false), 2000);
        }}
        variant="outline"
        fullWidth
      />
      <LoaderOverlay
        visible={visible}
        {...(message !== undefined ? { message } : {})}
        {...(color  !== undefined ? { color }   : {})}
      />
    </View>
  );
};

// ─── Default ─────────────────────────────────────────────────────────────────

export const Default = () => <Demo label="Show Overlay (2s)" />;

// ─── Loading ─────────────────────────────────────────────────────────────────

export const Loading = () => <Demo label="Loading state (show for 2s)" />;

// ─── With message ─────────────────────────────────────────────────────────────

export const WithMessage = () => (
  <Demo label="With Message (2s)" message="Loading data…" />
);

// ─── Saving message ───────────────────────────────────────────────────────────

export const SavingMessage = () => (
  <Demo label="Saving (2s)" message="Saving changes…" />
);

// ─── Custom color ─────────────────────────────────────────────────────────────

export const SuccessColor = () => (
  <Demo label="Success Color (2s)" message="Completing…" color={theme.colors.success[500]} />
);

// ─── All variants ─────────────────────────────────────────────────────────────

export const AllVariants = () => (
  <View style={styles.column}>
    <Demo label="No message"      />
    <Demo label="Loading…"        message="Loading data…"    />
    <Demo label="Saving…"         message="Saving changes…"  />
    <Demo label="Success accent"  message="Completing…"      color={theme.colors.success[500]} />
    <Demo label="Error accent"    message="Retrying…"        color={theme.colors.error[500]}   />
  </View>
);

// ─── Disabled — not applicable ────────────────────────────────────────────────

export const Disabled = () => (
  <View style={styles.center}>
    <Button title="Overlay has no disabled state" onPress={() => {}} variant="ghost" />
  </View>
);

// ─── Error state ──────────────────────────────────────────────────────────────

export const Error = () => (
  <Demo label="Error accent (2s)" message="Retrying…" color={theme.colors.error[500]} />
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column:    { gap: theme.spacing.md },
  center:    { alignItems: 'center', padding: theme.spacing.lg },
});
