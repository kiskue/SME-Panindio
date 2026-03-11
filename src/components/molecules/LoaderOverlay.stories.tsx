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
    blurred: { control: 'boolean' },
    opacity: { control: { type: 'number', min: 0, max: 1, step: 0.1 } },
    message: { control: 'text' },
  },
};

const Demo = ({
  label,
  blurred = true,
  message,
}: {
  label: string;
  blurred?: boolean;
  message?: string;
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
        blurred={blurred}
        {...(message !== undefined ? { message } : {})}
      />
    </View>
  );
};

export const Playground = () => <Demo label="Show Overlay (2s)" />;

export const LightOverlay = () => (
  <Demo label="Light Overlay (blurred)" blurred={true} />
);

export const DarkOverlay = () => (
  <Demo label="Dark Overlay" blurred={false} />
);

export const WithMessage = () => (
  <Demo label="With Message" blurred={true} message="Loading data…" />
);

export const AllModes = () => (
  <View style={styles.column}>
    <Demo label="Light Overlay"          blurred={true}  />
    <Demo label="Dark Overlay"           blurred={false} />
    <Demo label="Light + Message"        blurred={true}  message="Please wait…" />
    <Demo label="Dark + Message"         blurred={false} message="Saving changes…" />
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
});
