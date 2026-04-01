/**
 * LoaderOverlay — full-screen modal overlay for blocking CRUD operations.
 *
 * Wraps a Modal so it sits above all content. Shows the modern dot-pulse
 * spinner from LoadingSpinner with a glass-card treatment.
 *
 * Usage:
 *   <LoaderOverlay visible={isSaving} message="Saving changes…" />
 *
 * Design:
 *   - Semi-transparent backdrop (dark ≈ 72% slate-900, light ≈ 80% white)
 *   - Frosted-glass card with subtle border + shadow
 *   - Uses dot-pulse variant of LoadingSpinner (not ActivityIndicator)
 *   - Message line uses Text atom for proper font scaling
 *
 * Props:
 *   visible  — controls Modal visibility
 *   message  — optional label below the dots
 *   color    — dot color override; defaults to theme primary[500]
 */

import React from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import { LoadingSpinner } from './LoadingSpinner';
import { Text } from '../atoms/Text';

export interface LoaderOverlayProps {
  visible:  boolean;
  message?: string;
  color?:   string;
}

export const LoaderOverlay: React.FC<LoaderOverlayProps> = ({
  visible,
  message,
  color,
}) => {
  const theme  = useAppTheme();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  if (!visible) return null;

  const backdropBg = isDark
    ? 'rgba(10,14,26,0.82)'
    : 'rgba(248,249,250,0.82)';

  const cardBg     = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const msgColor   = isDark ? 'rgba(255,255,255,0.65)' : staticTheme.colors.gray[500];

  const spinnerColor = color ?? theme.colors.primary[500];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: backdropBg }]}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <LoadingSpinner size="large" color={spinnerColor} variant="dots" />
          {message !== undefined && message.length > 0 && (
            <Text
              variant="body-sm"
              style={[styles.message, { color: msgColor }]}
            >
              {message}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  card: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: staticTheme.spacing.xxl,
    paddingVertical:   staticTheme.spacing.xl,
    borderRadius:      staticTheme.borderRadius.xl,
    borderWidth:       1,
    minWidth:          140,
    gap:               staticTheme.spacing.sm,
    ...staticTheme.shadows.xl,
  },
  message: {
    textAlign: 'center',
  },
});
