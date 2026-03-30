/**
 * AppDialog
 *
 * A modern modal dialog that replaces React Native's native Alert.alert().
 * Renders over a dimmed backdrop with a spring-animated card and variant-
 * specific icon badge. Supports single-button (info/success/error/warning)
 * and two-button (confirm/cancel) layouts.
 *
 * Usage:
 *   const dialog = useAppDialog();
 *   dialog.show({ variant: 'error', title: 'Oops', message: 'Something failed.' });
 *   dialog.confirm({ title: 'Delete?', message: 'This cannot be undone.', onConfirm: doDelete });
 *   // In JSX: <dialog.Dialog />
 *
 * Design language: Square POS / Shopify POS aesthetic — clean, rounded, high-contrast.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppDialogVariant = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AppDialogProps {
  visible:      boolean;
  variant?:     AppDialogVariant;
  title:        string;
  message:      string;
  /** Primary action button label (default: 'OK') */
  confirmText?: string;
  onConfirm?:   () => void;
  /** Secondary/cancel button — shown when provided */
  cancelText?:  string;
  onCancel?:    () => void;
  /** Whether tapping the backdrop dismisses. Default: true */
  dismissable?: boolean;
}

// ─── Variant config ───────────────────────────────────────────────────────────

interface VariantConfig {
  accent:    string;
  bgCircle:  string;
  icon:      (size: number, color: string) => React.ReactElement;
}

const VARIANT_CONFIG: Record<AppDialogVariant, VariantConfig> = {
  success: {
    accent:   '#3DD68C',
    bgCircle: 'rgba(61,214,140,0.15)',
    icon: (size, color) => <CheckCircle   size={size} color={color} />,
  },
  error: {
    accent:   '#FF6B6B',
    bgCircle: 'rgba(255,107,107,0.15)',
    icon: (size, color) => <XCircle       size={size} color={color} />,
  },
  warning: {
    accent:   '#FFB020',
    bgCircle: 'rgba(255,176,32,0.15)',
    icon: (size, color) => <AlertTriangle size={size} color={color} />,
  },
  info: {
    accent:   '#4F9EFF',
    bgCircle: 'rgba(79,158,255,0.15)',
    icon: (size, color) => <Info          size={size} color={color} />,
  },
  confirm: {
    accent:   '#A78BFA',
    bgCircle: 'rgba(167,139,250,0.15)',
    icon: (size, color) => <HelpCircle   size={size} color={color} />,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  variant = 'info',
  title,
  message,
  confirmText = 'OK',
  onConfirm,
  cancelText,
  onCancel,
  dismissable = true,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  // ── Animation ──────────────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue:        0,
          useNativeDriver: true,
          tension:         80,
          friction:        10,
        }),
        Animated.timing(opacity, {
          toValue:         1,
          duration:        180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for the next open
      translateY.setValue(60);
      opacity.setValue(0);
    }
  }, [visible, translateY, opacity]);

  // ── Colors ─────────────────────────────────────────────────────────────────
  const config = VARIANT_CONFIG[variant];

  const cardBg      = isDark ? '#1A1F2E'                : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const titleColor  = isDark ? '#FFFFFF'                : staticTheme.colors.gray[900];
  const msgColor    = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[500];
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleBackdropPress = () => {
    if (dismissable) {
      // Prefer cancel if available, otherwise confirm
      if (onCancel !== undefined) {
        handleCancel();
      } else {
        handleConfirm();
      }
    }
  };

  const hasTwoButtons = cancelText !== undefined;

  // ── Card shadow (platform-aware) ───────────────────────────────────────────
  const cardShadow = Platform.OS === 'ios'
    ? {
        shadowColor:   '#000000',
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.55 : 0.14,
        shadowRadius:  24,
      }
    : { elevation: 16 };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={staticStyles.backdrop} onPress={handleBackdropPress}>
        {/* Card — stopPropagation prevents backdrop tap closing when tapping card */}
        <Pressable onPress={(e) => e.stopPropagation()} style={staticStyles.cardTouchable}>
          <Animated.View
            style={[
              staticStyles.card,
              cardShadow,
              {
                backgroundColor: cardBg,
                borderColor:     cardBorder,
                transform:       [{ translateY }],
                opacity,
              },
            ]}
          >
            {/* Icon badge */}
            <View
              style={[
                staticStyles.iconBadge,
                { backgroundColor: config.bgCircle },
              ]}
            >
              {config.icon(22, config.accent)}
            </View>

            {/* Title */}
            <Text
              variant="h5"
              weight="bold"
              align="center"
              style={[staticStyles.title, { color: titleColor }]}
            >
              {title}
            </Text>

            {/* Message */}
            <Text
              variant="body-sm"
              align="center"
              style={[staticStyles.message, { color: msgColor }]}
            >
              {message}
            </Text>

            {/* Divider */}
            <View style={[staticStyles.divider, { backgroundColor: dividerColor }]} />

            {/* Buttons */}
            {hasTwoButtons ? (
              <View style={staticStyles.btnRow}>
                <Button
                  title={cancelText ?? 'Cancel'}
                  onPress={handleCancel}
                  variant="outline"
                  size="md"
                  style={staticStyles.btnHalf}
                />
                <Button
                  title={confirmText}
                  onPress={handleConfirm}
                  variant="primary"
                  size="md"
                  style={[staticStyles.btnHalf, { backgroundColor: config.accent, borderColor: config.accent }]}
                />
              </View>
            ) : (
              <Button
                title={confirmText}
                onPress={handleConfirm}
                variant="primary"
                size="md"
                fullWidth
                style={{ backgroundColor: config.accent, borderColor: config.accent }}
              />
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

AppDialog.displayName = 'AppDialog';

// ─── Static styles ────────────────────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: staticTheme.spacing.lg,
  },
  cardTouchable: {
    width:    '100%',
    maxWidth: 340,
  },
  card: {
    width:        '100%',
    borderRadius: 24,
    borderWidth:  1,
    padding:      staticTheme.spacing.lg,
    alignItems:   'center',
  },
  iconBadge: {
    width:          56,
    height:         56,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   staticTheme.spacing.md,
  },
  title: {
    marginBottom: staticTheme.spacing.xs,
  },
  message: {
    marginBottom: staticTheme.spacing.md,
    lineHeight:   20,
  },
  divider: {
    alignSelf: 'stretch',
    height:    1,
    marginBottom: staticTheme.spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
    alignSelf:     'stretch',
  },
  btnHalf: {
    flex: 1,
  },
});
