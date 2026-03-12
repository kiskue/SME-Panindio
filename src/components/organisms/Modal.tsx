import React, { useMemo } from 'react';
import {
  Modal as RNModal,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { ComponentProps } from '@/types';
import { useAppTheme } from '../../core/theme';
import { theme as staticTheme } from '../../core/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ModalProps extends ComponentProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  showCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
  footer?: React.ReactNode;
  primaryAction?: { label: string; onPress: () => void; loading?: boolean };
  secondaryAction?: { label: string; onPress: () => void };
  scrollable?: boolean;
}

const SIZE_MAP = {
  sm:         { width: SCREEN_WIDTH * 0.8,  maxHeight: SCREEN_HEIGHT * 0.4 },
  md:         { width: SCREEN_WIDTH * 0.9,  maxHeight: SCREEN_HEIGHT * 0.6 },
  lg:         { width: SCREEN_WIDTH * 0.95, maxHeight: SCREEN_HEIGHT * 0.8 },
  fullscreen: { width: SCREEN_WIDTH,        maxHeight: SCREEN_HEIGHT },
};

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  dismissOnBackdrop = true,
  footer,
  primaryAction,
  secondaryAction,
  scrollable = false,
}) => {
  const theme = useAppTheme();

  const { width, maxHeight } = SIZE_MAP[size];
  const isFullscreen = size === 'fullscreen';

  const hasFooter = footer !== undefined || primaryAction !== undefined || secondaryAction !== undefined;

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: theme.colors.surface,
      borderRadius: staticTheme.borderRadius.xl,
      overflow: 'hidden',
      ...staticTheme.shadows.xl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: staticTheme.spacing.md,
      paddingTop: staticTheme.spacing.md,
      paddingBottom: staticTheme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
      padding: staticTheme.spacing.md,
    },
  }), [theme]);

  const body = scrollable
    ? <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={styles.body}>{children}</View>;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdrop ? onClose : undefined}
      >
        <Pressable
          style={[
            dynStyles.sheet,
            { width, maxHeight },
            isFullscreen && styles.fullscreen,
          ]}
          onPress={() => {}}  // stop propagation to backdrop
        >
          {/* Header */}
          {(title !== undefined || showCloseButton) && (
            <View style={dynStyles.header}>
              {title !== undefined && (
                <Text variant="h4" weight="semibold" style={styles.headerTitle}>
                  {title}
                </Text>
              )}
              {showCloseButton && (
                <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                  <X size={20} color={theme.colors.gray[500]} />
                </Pressable>
              )}
            </View>
          )}

          {/* Body */}
          {body}

          {/* Footer */}
          {hasFooter && (
            <View style={dynStyles.footer}>
              {footer !== undefined ? footer : (
                <View style={styles.footerActions}>
                  {secondaryAction !== undefined && (
                    <Button
                      title={secondaryAction.label}
                      onPress={secondaryAction.onPress}
                      variant="outline"
                      size="md"
                      style={styles.footerBtn}
                    />
                  )}
                  {primaryAction !== undefined && (
                    <Button
                      title={primaryAction.label}
                      onPress={primaryAction.onPress}
                      variant="primary"
                      size="md"
                      loading={primaryAction.loading ?? false}
                      style={styles.footerBtn}
                    />
                  )}
                </View>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreen: {
    borderRadius: 0,
    flex: 1,
    alignSelf: 'stretch',
  },
  headerTitle: { flex: 1 },
  closeBtn: {
    padding: staticTheme.spacing.xs,
    marginLeft: staticTheme.spacing.sm,
  },
  scrollBody: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.md,
  },
  body: {
    padding: staticTheme.spacing.md,
  },
  footerActions: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
    justifyContent: 'flex-end',
  },
  footerBtn: { flexShrink: 1 },
});
