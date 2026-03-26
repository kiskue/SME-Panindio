/**
 * BottomSheet organism — @gorhom/bottom-sheet wrapper
 *
 * Wraps BottomSheetModal (programmatic, imperative) so that callers retain a
 * simple `visible` / `onClose` props API while the real animation and gesture
 * handling is done by @gorhom/bottom-sheet.
 *
 * Usage:
 *   const sheetRef = useRef<BottomSheetHandle>(null);
 *   sheetRef.current?.present();   // open
 *   sheetRef.current?.dismiss();   // close
 *
 *   — OR use the `visible` + `onClose` props for fully controlled usage.
 *
 * Layout providers required in the root layout (already added):
 *   <GestureHandlerRootView>
 *     <BottomSheetModalProvider>
 *       ...
 *     </BottomSheetModalProvider>
 *   </GestureHandlerRootView>
 */

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModalRef,
} from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  /** Called when the sheet is dismissed (backdrop tap, swipe, back press) */
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Initial snap point when the sheet opens.
   * The sheet is freely draggable between this point and full-screen.
   * @default '50%'
   */
  defaultSnapPoint?: SnapPoint;
  showHandle?: boolean;
  showCloseButton?: boolean;
  /** Dismiss when the backdrop is tapped. Defaults to true. */
  dismissOnBackdrop?: boolean;
  /**
   * When true the inner content is wrapped in a BottomSheetScrollView so it
   * can scroll independently of the sheet drag gesture.
   */
  scrollable?: boolean;
}

// ─── Snap point map ───────────────────────────────────────────────────────────

const SNAP_MAP: Record<SnapPoint, string> = {
  '25%': '25%',
  '50%': '50%',
  '60%': '60%',
  '75%': '75%',
  '90%': '90%',
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
    defaultSnapPoint = '50%',
    showHandle = true,
    showCloseButton = false,
    dismissOnBackdrop = true,
    scrollable = false,
  } = props;

  const theme     = useAppTheme();
  const modalRef  = useRef<BottomSheetModalRef>(null);

  const snapPoints = useMemo<string[]>(
    () => [SNAP_MAP[defaultSnapPoint]],
    [defaultSnapPoint],
  );

  // Expose present / dismiss to parent via ref
  useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
    dismiss: () => modalRef.current?.dismiss(),
  }));

  // Sync the `visible` prop to the imperative API
  useEffect(() => {
    if (visible === true) {
      modalRef.current?.present();
    } else if (visible === false) {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Backdrop — dims the content behind the sheet
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior={dismissOnBackdrop ? 'close' : 'none'}
        opacity={0.5}
      />
    ),
    [dismissOnBackdrop],
  );

  const handleStyles = useMemo(
    () => ({
      handleIndicator: {
        backgroundColor: theme.colors.gray[300],
        width: 36,
        height: 4,
      },
      handle: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius:  staticTheme.borderRadius.xl,
        borderTopRightRadius: staticTheme.borderRadius.xl,
      },
    }),
    [theme],
  );

  const backgroundStyle = useMemo(
    () => ({ backgroundColor: theme.colors.surface }),
    [theme],
  );

  const Content = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={handleStyles.handleIndicator}
      handleStyle={handleStyles.handle}
      backgroundStyle={backgroundStyle}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {/*
       * SafeAreaView only guards the bottom inset (home-indicator area).
       * The top of the sheet content must clear the gorhom drag-handle chrome.
       * The library's default handle area is ~24 pt (4 pt bar + 10 pt top
       * padding + 10 pt bottom padding). When showHandle is false we suppress
       * that chrome, so we add a smaller manual spacer instead.
       */}
      <SafeAreaView
        edges={['bottom']}
        style={[styles.safeArea, showHandle ? styles.safeAreaHandleOffset : styles.safeAreaNoHandle]}
      >
        {(title !== undefined || showCloseButton) && (
          <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
            {title !== undefined && (
              <Text variant="h4" weight="semibold" style={styles.headerTitle}>
                {title}
              </Text>
            )}
            {showCloseButton && (
              <Pressable
                onPress={() => modalRef.current?.dismiss()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={theme.colors.gray[500]} />
              </Pressable>
            )}
          </View>
        )}

        <Content style={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </Content>
      </SafeAreaView>
    </BottomSheetModal>
  );
};

export const BottomSheet = React.forwardRef<BottomSheetHandle, BottomSheetProps>(
  BottomSheetInner,
);
BottomSheet.displayName = 'BottomSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

// The gorhom BottomSheetModal handle chrome occupies ~24 pt by default
// (4 pt indicator height + 10 pt paddingTop + 10 pt paddingBottom on the
// handle container). We push the SafeAreaView content below this so the
// sheet title / first content line is never occluded.
const HANDLE_CHROME_HEIGHT = 24;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // When the gorhom drag handle IS shown, clear its chrome height at the top.
  safeAreaHandleOffset: {
    paddingTop: HANDLE_CHROME_HEIGHT,
  },
  // When the drag handle is hidden (showHandle=false), a smaller gap is enough.
  safeAreaNoHandle: {
    paddingTop: staticTheme.spacing.sm,
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
  content: {
    padding: staticTheme.spacing.md,
    flex: 1,
  },
});
