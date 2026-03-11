import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { Text } from '../atoms/Text';

export interface ErrorMessageProps {
  message: string;
  variant?: 'error' | 'warning' | 'info' | 'success';
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  variant = 'error',
  icon,
  dismissible = false,
  onDismiss,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return {
          backgroundColor: theme.colors.error[50],
          borderColor: theme.colors.error[500],
          textColor: theme.colors.error[700],
          iconColor: theme.colors.error[500],
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning[50],
          borderColor: theme.colors.warning[500],
          textColor: theme.colors.warning[700],
          iconColor: theme.colors.warning[500],
        };
      case 'info':
        return {
          backgroundColor: theme.colors.info[50],
          borderColor: theme.colors.info[500],
          textColor: theme.colors.info[700],
          iconColor: theme.colors.info[500],
        };
      case 'success':
        return {
          backgroundColor: theme.colors.success[50],
          borderColor: theme.colors.success[500],
          textColor: theme.colors.success[700],
          iconColor: theme.colors.success[500],
        };
      default:
        return {
          backgroundColor: theme.colors.error[50],
          borderColor: theme.colors.error[500],
          textColor: theme.colors.error[700],
          iconColor: theme.colors.error[500],
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: variantStyles.backgroundColor,
        borderColor: variantStyles.borderColor,
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
      },
    ]}>
      <View style={styles.content}>
        {icon && (
          <View style={styles.iconContainer}>
            {icon}
          </View>
        )}
        <Text
          variant="body-sm"
          style={[styles.message, { color: variantStyles.textColor }]}
        >
          {message}
        </Text>
        {dismissible && onDismiss && (
          <Text
            variant="body-sm"
            weight="medium"
            style={[styles.dismiss, { color: variantStyles.iconColor }]}
            onPress={onDismiss}
          >
            ✕
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  message: {
    flex: 1,
    lineHeight: 20,
  },
  dismiss: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
});