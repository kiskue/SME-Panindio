import React, { useEffect, useRef } from 'react';
import { View, Animated, Pressable, StyleSheet, Text as RNText } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { theme } from '../../core/theme';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
  visible: boolean;
  position?: 'top' | 'bottom';
  action?: { label: string; onPress: () => void };
}

const VARIANT_CONFIG: Record<
  ToastVariant,
  { color: string; icon: React.ReactElement }
> = {
  success: { color: theme.colors.success[500], icon: <CheckCircle  size={18} color={theme.colors.success[500]} /> },
  error:   { color: theme.colors.error[500],   icon: <XCircle      size={18} color={theme.colors.error[500]} /> },
  warning: { color: theme.colors.warning[500], icon: <AlertTriangle size={18} color={theme.colors.warning[500]} /> },
  info:    { color: theme.colors.info[500],    icon: <Info         size={18} color={theme.colors.info[500]} /> },
};

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
  visible,
  position = 'bottom',
  action,
}) => {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(position === 'top' ? -20 : 20)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: position === 'top' ? -20 : 20, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(position === 'top' ? -20 : 20);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();

      if (duration > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(dismiss, duration);
      }
    } else {
      dismiss();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const config = VARIANT_CONFIG[variant];

  const positionStyle = position === 'top'
    ? { top: 60 }
    : { bottom: 40 };

  return (
    <Animated.View
      style={[
        styles.container,
        positionStyle,
        { opacity, transform: [{ translateY }] },
        { borderLeftColor: config.color },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.icon}>{config.icon}</View>

      <RNText style={styles.message} numberOfLines={3}>{message}</RNText>

      {action !== undefined && (
        <Pressable onPress={action.onPress} style={styles.action}>
          <RNText style={[styles.actionLabel, { color: config.color }]}>{action.label}</RNText>
        </Pressable>
      )}

      <Pressable onPress={dismiss} style={styles.close} hitSlop={8}>
        <X size={14} color={theme.colors.gray[400]} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    paddingVertical: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
    zIndex: 999,
  },
  icon: { flexShrink: 0 },
  message: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  action: { flexShrink: 0 },
  actionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  close: { flexShrink: 0 },
});
