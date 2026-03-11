import React from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  StyleSheet,
  Text as RNText,
} from 'react-native';
import { theme } from '../../core/theme';

export interface LoaderOverlayProps {
  visible: boolean;
  message?: string;
  opacity?: number;
  color?: string;
  blurred?: boolean;
}

export const LoaderOverlay: React.FC<LoaderOverlayProps> = ({
  visible,
  message,
  opacity = 0.5,
  color = theme.colors.primary[500],
  blurred = true,
}) => {
  if (!visible) return null;

  const overlayBg = blurred
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;

  const spinnerColor = blurred ? color : theme.colors.white;
  const textColor    = blurred ? theme.colors.text : theme.colors.white;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
        <View style={[styles.card, blurred && styles.cardLight]}>
          <ActivityIndicator size="large" color={spinnerColor} />
          {message !== undefined && (
            <RNText style={[styles.message, { color: textColor }]}>{message}</RNText>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    gap: theme.spacing.md,
    minWidth: 120,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cardLight: {
    backgroundColor: theme.colors.white,
    ...theme.shadows.lg,
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    textAlign: 'center',
  },
});
