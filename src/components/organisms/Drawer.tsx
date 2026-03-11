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
import { X, ChevronRight } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DrawerItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  onPress?: () => void;
  destructive?: boolean;
  dividerBefore?: boolean;
}

export interface DrawerProps extends ComponentProps {
  visible: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  width?: number;
  header?: React.ReactNode;
  items?: DrawerItem[];
  footer?: React.ReactNode;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  dismissOnBackdrop?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  visible,
  onClose,
  position = 'left',
  width = SCREEN_WIDTH * 0.8,
  header,
  items,
  footer,
  children,
  showCloseButton = true,
  dismissOnBackdrop = true,
}) => {
  const translateX = useRef(
    new Animated.Value(position === 'left' ? -width : width),
  ).current;

  const animateIn = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.timing(translateX, {
      toValue: position === 'left' ? -width : width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => callback?.());
  };

  const handleClose = () => animateOut(onClose);

  useEffect(() => {
    if (visible) {
      translateX.setValue(position === 'left' ? -width : width);
      animateIn();
    } else {
      animateOut();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const drawerContent = (
    <Animated.View
      style={[
        styles.drawer,
        { width, [position]: 0, transform: [{ translateX }] },
      ]}
    >
      {/* Close button */}
      {showCloseButton && (
        <Pressable
          onPress={handleClose}
          style={[
            styles.closeBtn,
            position === 'right' ? { left: theme.spacing.md } : { right: theme.spacing.md },
          ]}
          hitSlop={8}
        >
          <X size={20} color={theme.colors.gray[500]} />
        </Pressable>
      )}

      {/* Header */}
      {header !== undefined && (
        <View style={styles.header}>{header}</View>
      )}

      {/* Items or children */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {children !== undefined
          ? children
          : items?.map(item => (
            <React.Fragment key={item.key}>
              {item.dividerBefore && <View style={styles.divider} />}
              <Pressable
                onPress={() => { item.onPress?.(); handleClose(); }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
              >
                {item.icon !== undefined && (
                  <View style={styles.itemIcon}>{item.icon}</View>
                )}
                <Text
                  variant="body"
                  weight="medium"
                  style={[styles.itemLabel, item.destructive && styles.destructiveText]}
                >
                  {item.label}
                </Text>
                {item.badge !== undefined && item.badge > 0 && (
                  <View style={styles.badge}>
                    <Text variant="body-xs" style={styles.badgeText}>
                      {item.badge > 99 ? '99+' : String(item.badge)}
                    </Text>
                  </View>
                )}
                <ChevronRight size={16} color={item.destructive ? theme.colors.error[400] : theme.colors.gray[400]} />
              </Pressable>
            </React.Fragment>
          ))}
      </ScrollView>

      {/* Footer */}
      {footer !== undefined && (
        <View style={styles.footer}>{footer}</View>
      )}
    </Animated.View>
  );

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
        {drawerContent}
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.white,
    ...theme.shadows.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    zIndex: 10,
    padding: theme.spacing.xs,
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[100],
  },
  body: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  itemPressed: { backgroundColor: theme.colors.gray[50] },
  itemIcon: { width: 24, alignItems: 'center' },
  itemLabel: { flex: 1 },
  destructiveText: { color: theme.colors.error[500] },
  divider: {
    height: 1,
    backgroundColor: theme.colors.gray[100],
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xs,
  },
  badge: {
    backgroundColor: theme.colors.error[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: theme.colors.white },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[100],
  },
});
