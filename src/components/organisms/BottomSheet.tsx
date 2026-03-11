import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal,
  View,
  Pressable,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SNAP_MAP: Record<string, number> = {
  '25%': SCREEN_HEIGHT * 0.25,
  '50%': SCREEN_HEIGHT * 0.50,
  '75%': SCREEN_HEIGHT * 0.75,
  '90%': SCREEN_HEIGHT * 0.90,
};

export type SnapPoint = '25%' | '50%' | '75%' | '90%';

export interface BottomSheetProps extends ComponentProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  defaultSnapPoint?: SnapPoint;
  showHandle?: boolean;
  showCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
  scrollable?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  defaultSnapPoint = '50%',
  showHandle = true,
  showCloseButton = false,
  dismissOnBackdrop = true,
  scrollable = false,
}) => {
  const sheetHeight = SNAP_MAP[defaultSnapPoint] ?? SCREEN_HEIGHT * 0.5;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;

  const animateIn = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => callback?.());
  };

  const handleClose = () => {
    animateOut(onClose);
  };

  useEffect(() => {
    if (visible) {
      translateY.setValue(sheetHeight);
      animateIn();
    } else {
      animateOut();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={dismissOnBackdrop ? handleClose : undefined}
        />

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, transform: [{ translateY }] },
          ]}
        >
          {showHandle && <View style={styles.handle} />}

          {(title !== undefined || showCloseButton) && (
            <View style={styles.header}>
              {title !== undefined && (
                <Text variant="h4" weight="semibold" style={styles.headerTitle}>
                  {title}
                </Text>
              )}
              {showCloseButton && (
                <Pressable onPress={handleClose} hitSlop={8}>
                  <X size={20} color={theme.colors.gray[500]} />
                </Pressable>
              )}
            </View>
          )}

          {scrollable
            ? (
              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            )
            : <View style={styles.content}>{children}</View>}
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray[300],
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  headerTitle: { flex: 1 },
  content: {
    padding: theme.spacing.md,
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
});
