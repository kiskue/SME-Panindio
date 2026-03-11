import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { Text } from '../atoms/Text';

export interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = theme.colors.primary[500],
  text,
  fullScreen = false,
  overlay = false,
}) => {
  const content = (
    <View style={[
      styles.container,
      fullScreen && styles.fullScreen,
      overlay && styles.overlay,
    ]}>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text variant="body-sm" color="gray" style={styles.text}>
          {text}
        </Text>
      )}
    </View>
  );

  if (fullScreen || overlay) {
    return (
      <View style={[
        styles.fullScreenContainer,
        overlay && styles.overlayContainer,
      ]}>
        {content}
      </View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginLeft: theme.spacing.sm,
  },
  fullScreen: {
    flex: 1,
  },
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayContainer: {
    backgroundColor: 'transparent',
  },
});