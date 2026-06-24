/**
 * BottomSheet organism — React Native Modal implementation
 *
 * NOTE (2026-06): This was previously a @gorhom/bottom-sheet `BottomSheetModal`
 * wrapper. On this app's stack (Expo SDK 54 / RN 0.81 / New Architecture /
 * Reanimated 4) the gorhom *modal* variant silently failed to present — the
 * imperative `present()` ran without error but the sheet's open animation never
 * fired (`onAnimate`/`onChange` never emitted), so no sheet anywhere in the app
 * appeared. We replaced the internals with a plain RN `Modal` + bottom-anchored
 * panel (the same proven pattern used by ScanResultSheet) while keeping the
 * exact same public API, so every caller keeps working unchanged.
 *
 * Usage:
 *   const sheetRef = useRef<BottomSheetHandle>(null);
 *   sheetRef.current?.present();   // open
 *   sheetRef.current?.dismiss();   // close
 *
 *   — OR use the `visible` + `onClose` props for fully controlled usage.
 */

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { useAppTheme } from '../../core/theme';
import { theme as staticTheme } from '../../core/theme';

// ─── Public API types ─────────────────────────────────────────────────────────

export type SnapPoint = '25%' | '50%' | '60%' | '75%' | '90%';

/** Imperative handle exposed via forwardRef */
export interface BottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface BottomSheetProps {
  /** Controlled visibility — when true the sheet presents itself */
  visible?: boolean;
  /** Called when the sheet is dismissed (backdrop tap, back press, close btn) */
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Optional sticky footer rendered below the scrollable content area.
   * Use this for confirm/save buttons that must always stay visible.
   */
  footer?: React.ReactNode;
  /**
   * Maximum sheet height as a fraction of the screen. The sheet sizes to its
   * content but never grows past this point (content scrolls beyond it when
   * `scrollable` is set).
   * @default '50%'
   */
  defaultSnapPoint?: SnapPoint;
  showHandle?: boolean;
  showCloseButton?: boolean;
  /** Dismiss when the backdrop is tapped. Defaults to true. */
  dismissOnBackdrop?: boolean;
  /**
   * When true the inner content is wrapped in a ScrollView so it can scroll
   * independently within the sheet's max height.
   */
  scrollable?: boolean;
  /** Backdrop dimming opacity. Defaults to 0.5. */
  backdropOpacity?: number;
  /**
   * When false, the content wrapper has no padding so the caller can control
   * its own padding. Defaults to true.
   */
  contentPadding?: boolean;
}

// ─── Snap point → screen-height fraction ────────────────────────────────────────

const SNAP_FRACTION: Record<SnapPoint, number> = {
  '25%': 0.25,
  '50%': 0.5,
  '60%': 0.6,
  '75%': 0.75,
  '90%': 0.9,
};

// ─── Component ────────────────────────────────────────────────────────────────

const BottomSheetInner = (
  props: BottomSheetProps,
  ref: React.Ref<BottomSheetHandle>,
) => {
  const {
    visible,
    onClose,
    title,
    children,
    footer,
    defaultSnapPoint = '50%',
    showHandle = true,
    showCloseButton = false,
    dismissOnBackdrop = true,
    scrollable = false,
    backdropOpacity = 0.5,
    contentPadding = true,
  } = props;

  const theme  = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Internal open state. Driven by the `visible` prop when controlled, or by
  // the imperative present()/dismiss() handle when used ref-only.
  const [open, setOpen] = useState<boolean>(visible === true);

  // Sync the controlled `visible` prop into internal state.
  useEffect(() => {
    if (visible !== undefined) setOpen(visible);
  }, [visible]);

  // Expose present / dismiss to parent via ref
  useImperativeHandle(ref, () => ({
    present: () => setOpen(true),
    dismiss: () => setOpen(false),
  }));

  const handleClose = useCallback(() => {
    // For uncontrolled (ref-only) usage we must close ourselves. For controlled
    // usage we let the parent flip `visible` (the effect above then closes us),
    // which avoids a reopen race if the parent keeps `visible` true.
    if (visible === undefined) setOpen(false);
    onClose?.();
  }, [visible, onClose]);

  const sheetMaxHeight = Math.round(windowHeight * SNAP_FRACTION[defaultSnapPoint]);

  const headerVisible = title !== undefined || showCloseButton;

  const contentNode = scrollable ? (
    <ScrollView
      style={styles.scrollArea}
      contentContainerStyle={contentPadding ? styles.contentPadded : undefined}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={contentPadding ? styles.contentPadded : undefined}>{children}</View>
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Backdrop — dims content behind and closes on tap. */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: `rgba(0,0,0,${backdropOpacity})` }]}
          onPress={dismissOnBackdrop ? handleClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                maxHeight: sheetMaxHeight,
                // When a sticky footer is supplied it owns the bottom inset
                // (callers already pad it); otherwise guard the home indicator.
                paddingBottom: footer !== undefined
                  ? 0
                  : Math.max(insets.bottom, staticTheme.spacing.md),
              },
            ]}
          >
            {showHandle && (
              <View style={[styles.handle, { backgroundColor: theme.colors.gray[300] }]} />
            )}

            {headerVisible && (
              <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
                {title !== undefined && (
                  <Text variant="h4" weight="semibold" style={styles.headerTitle}>
                    {title}
                  </Text>
                )}
                {showCloseButton && (
                  <Pressable
                    onPress={handleClose}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={20} color={theme.colors.gray[500]} />
                  </Pressable>
                )}
              </View>
            )}

            {contentNode}

            {footer !== undefined && footer}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export const BottomSheet = React.forwardRef<BottomSheetHandle, BottomSheetProps>(
  BottomSheetInner,
);
BottomSheet.displayName = 'BottomSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Anchors the sheet to the bottom; the backdrop fills the area above it.
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius:  staticTheme.borderRadius.xl,
    borderTopRightRadius: staticTheme.borderRadius.xl,
    // Shadow (iOS)
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    // Elevation (Android)
    elevation: 16,
  },
  handle: {
    width:        36,
    height:       4,
    borderRadius: 2,
    alignSelf:    'center',
    marginTop:    8,
    marginBottom: 4,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
  },
  // flexShrink lets the scroll area cap at the sheet's maxHeight and scroll,
  // while the (optional) sticky footer below stays pinned.
  scrollArea: {
    flexShrink: 1,
  },
  contentPadded: {
    padding: staticTheme.spacing.md,
  },
});
