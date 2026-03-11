import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Text as RNText } from 'react-native';
import { Modal } from './Modal';
import { Button } from '../atoms/Button';
import { Text } from '../atoms/Text';
import { theme } from '../../core/theme';

export default {
  title: 'Organisms/Modal',
  component: Modal,
  decorators: [
    (Story: () => React.ReactElement) => (
      <ScrollView contentContainerStyle={styles.decorator}>
        <Story />
      </ScrollView>
    ),
  ],
};

const ModalDemo = (props: Omit<React.ComponentProps<typeof Modal>, 'visible' | 'onClose' | 'children'> & {
  triggerLabel?: string;
  body?: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  const { triggerLabel = 'Open Modal', body, ...rest } = props;
  return (
    <View>
      <Button title={triggerLabel} onPress={() => setVisible(true)} fullWidth />
      <Modal
        visible={visible}
        onClose={() => setVisible(false)}
        {...rest}
      >
        {body ?? (
          <Text variant="body" color="gray">
            This is the modal content. You can put anything here.
          </Text>
        )}
      </Modal>
    </View>
  );
};

export const Default = () => <ModalDemo title="Default Modal" />;

export const WithTitle = () => (
  <ModalDemo title="Confirm Action" triggerLabel="Open With Title" />
);

export const WithFooterActions = () => (
  <ModalDemo
    title="Delete Item"
    triggerLabel="Open With Actions"
    body={<Text variant="body">Are you sure you want to delete this item? This action cannot be undone.</Text>}
    primaryAction={{ label: 'Delete', onPress: () => {} }}
    secondaryAction={{ label: 'Cancel', onPress: () => {} }}
  />
);

export const WithScrollableContent = () => (
  <ModalDemo
    title="Terms of Service"
    triggerLabel="Open Scrollable"
    scrollable
    body={
      <View style={styles.column}>
        {Array.from({ length: 10 }, (_, i) => (
          <RNText key={i} style={styles.lorem}>
            Section {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </RNText>
        ))}
      </View>
    }
    primaryAction={{ label: 'Accept', onPress: () => {} }}
  />
);

export const SizeSmall = () => (
  <ModalDemo title="Small Modal" size="sm" triggerLabel="Small (sm)" />
);

export const SizeMedium = () => (
  <ModalDemo title="Medium Modal" size="md" triggerLabel="Medium (md)" />
);

export const SizeLarge = () => (
  <ModalDemo title="Large Modal" size="lg" triggerLabel="Large (lg)" />
);

export const Fullscreen = () => (
  <ModalDemo title="Fullscreen Modal" size="fullscreen" triggerLabel="Fullscreen" />
);

export const WithoutCloseButton = () => (
  <ModalDemo
    title="No Close Button"
    showCloseButton={false}
    triggerLabel="No Close Button"
    primaryAction={{ label: 'OK', onPress: () => {} }}
    body={<Text variant="body">This modal can only be closed with the button below.</Text>}
  />
);

export const ConfirmationDialog = () => (
  <ModalDemo
    title="Confirm Deletion"
    size="sm"
    triggerLabel="Confirmation Dialog"
    body={
      <Text variant="body">
        This will permanently delete your account and all associated data.
      </Text>
    }
    primaryAction={{ label: 'Delete Account', onPress: () => {} }}
    secondaryAction={{ label: 'Cancel', onPress: () => {} }}
  />
);

export const AlertModal = () => (
  <ModalDemo
    title="Session Expired"
    size="sm"
    triggerLabel="Alert Modal"
    body={<Text variant="body">Your session has expired. Please log in again to continue.</Text>}
    primaryAction={{ label: 'Log In', onPress: () => {} }}
  />
);

export const AllSizes = () => (
  <View style={styles.column}>
    {(['sm', 'md', 'lg', 'fullscreen'] as const).map(s => (
      <ModalDemo key={s} title={`${s} Modal`} size={s} triggerLabel={`Open ${s}`} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  decorator: { padding: theme.spacing.md, backgroundColor: '#fff', flexGrow: 1 },
  column: { gap: theme.spacing.md },
  lorem: {
    fontSize: 14,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
});
