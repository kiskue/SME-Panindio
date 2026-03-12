import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppTheme } from '../../core/theme';
import { theme as staticTheme } from '../../core/theme';
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
  color,
  text,
  fullScreen = false,
  overlay = false,
}) => {
  const theme = useAppTheme();

  // Allow explicit color override; default to theme's primary[500] so it
  // updates dynamically when dark mode is active.
  const spinnerColor = color ?? theme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    overlay: {
      backgroundColor: theme.colors.surface === '#FFFFFF'
        ? 'rgba(255, 255, 255, 0.9)'
        : 'rgba(30, 41, 59, 0.9)',
      borderRadius: staticTheme.borderRadius.lg,
      padding: staticTheme.spacing.lg,
      ...staticTheme.shadows.lg,
    },
    fullScreenContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.surface === '#FFFFFF'
        ? 'rgba(255, 255, 255, 0.8)'
        : 'rgba(15, 23, 42, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
  }), [theme]);

  const content = (
    <View style={[
      styles.container,
      fullScreen && !overlay && styles.fullScreen,
      overlay && dynStyles.overlay,
    ]}>
      <ActivityIndicator size={size} color={spinnerColor} />
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
        dynStyles.fullScreenContainer,
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
    marginLeft: staticTheme.spacing.sm,
  },
  fullScreen: {
    flex: 1,
  },
  overlayContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
