/**
 * BarcodeScannerModal
 *
 * Full-screen modal that activates the device camera in barcode scanning mode.
 * Supports all common retail and logistics barcode formats (EAN-13, UPC-A,
 * QR, Code128, PDF417, etc.).
 *
 * ERP rationale:
 *   Barcode scanning is the primary data-entry method in warehouse and POS
 *   operations. Operators should never type SKUs by hand — human error rates
 *   on manual entry are 1-in-300; scanners are effectively error-free.
 *   This component makes scanning a first-class, zero-friction action on the
 *   product creation form.
 *
 * Scanning flow:
 *   1. Camera permission is checked on mount via `useCameraPermissions()`.
 *   2. If denied, a friendly UI prompts the user to open Settings.
 *   3. Once the camera is live, `onBarcodeScanned` fires on every detected
 *      frame. A `scannedRef` flag prevents duplicate fire events.
 *   4. On first successful scan: the value is passed to `onScanned`, a brief
 *      green success flash is shown, then the modal closes automatically.
 *
 * Props:
 *   visible   — controls modal visibility
 *   onClose   — called when the user taps the X / back button
 *   onScanned — called with the raw barcode string when a code is detected
 *
 * Supported formats:
 *   ean13, ean8, upc_a, upc_e, code39, code128, qr, pdf417, aztec,
 *   datamatrix, itf14, codabar
 *
 * Usage:
 *   <BarcodeScannerModal
 *     visible={scannerVisible}
 *     onClose={() => setScannerVisible(false)}
 *     onScanned={(barcode) => {
 *       setValue('sku', barcode);
 *       setScannerVisible(false);
 *     }}
 *   />
 */

import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import { X, ScanLine, AlertTriangle } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { theme as staticTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * All barcode formats commonly encountered in Philippine retail, logistics, and
 * manufacturing SME operations. The list is exhaustive on purpose — there is no
 * performance cost to enabling multiple types in expo-camera v17.
 */
const SUPPORTED_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code128',
  'qr',
  'pdf417',
  'aztec',
  'datamatrix',
  'itf14',
  'codabar',
];

/** Duration (ms) the green success overlay is visible before the modal closes. */
const SUCCESS_FLASH_DURATION_MS = 650;

/** Height of the transparent scanning reticle in the middle overlay band. */
const RETICLE_HEIGHT = 180;

/** Width of the transparent scanning reticle. */
const RETICLE_WIDTH = 264;

/** Vertical offset from the top of the screen where the reticle band starts (as %). */
const RETICLE_TOP_PERCENT = 28;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BarcodeScannerModalProps {
  visible:   boolean;
  onClose:   () => void;
  onScanned: (barcode: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
}) => {
  const insets = useSafeAreaInsets();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  // Camera permission state managed by expo-camera hook.
  // `permission` is null while the status is being determined.
  const [permission, requestPermission] = useCameraPermissions();

  // Prevents multiple `onScanned` calls from rapid successive camera frames.
  const scannedRef = useRef(false);

  // Controls the green success overlay flash.
  const [showSuccess, setShowSuccess] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Reset the scanned guard each time the modal opens so repeat-opens work.
  const handleModalShow = useCallback(() => {
    scannedRef.current = false;
    setShowSuccess(false);
    flashOpacity.setValue(0);
  }, [flashOpacity]);

  // ── Success flash animation ──────────────────────────────────────────────

  const triggerSuccessFlash = useCallback(() => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.delay(SUCCESS_FLASH_DURATION_MS - 200),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccess(false);
    });
  }, [flashOpacity]);

  // ── Barcode detected ────────────────────────────────────────────────────

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      // Guard: only process the very first scan frame.
      if (scannedRef.current) return;
      scannedRef.current = true;

      const barcodeValue = result.data.trim();
      if (barcodeValue.length === 0) {
        // Empty data — allow retry by releasing the guard.
        scannedRef.current = false;
        return;
      }

      triggerSuccessFlash();

      // Give the flash time to be visible, then propagate upward and close.
      setTimeout(() => {
        onScanned(barcodeValue);
        onClose();
      }, SUCCESS_FLASH_DURATION_MS);
    },
    [onScanned, onClose, triggerSuccessFlash],
  );

  // ── Theme-derived colors ─────────────────────────────────────────────────

  const accent       = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const successColor = '#3DD68C';

  // ── Dynamic styles ───────────────────────────────────────────────────────

  const dynStyles = useMemo(() => StyleSheet.create({
    reticle: {
      width: RETICLE_WIDTH,
      height: RETICLE_HEIGHT,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: showSuccess ? successColor : accent,
      backgroundColor: 'transparent',
    },
    closeBtnCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    hintPillText: {
      color: showSuccess ? successColor : '#FFFFFF',
    },
    permissionCard: {
      backgroundColor: isDark ? '#1A1F2E' : '#FFFFFF',
      borderRadius: 20,
      padding: staticTheme.spacing.lg,
      marginHorizontal: staticTheme.spacing.lg,
      alignItems: 'center' as const,
      gap: staticTheme.spacing.md,
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.08)'
        : staticTheme.colors.gray[200],
    },
    permissionIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${accent}18`,
      borderWidth: 1,
      borderColor: `${accent}30`,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    permissionHeading: {
      color: isDark ? '#FFFFFF' : staticTheme.colors.gray[900],
      textAlign: 'center' as const,
    },
    permissionBody: {
      color: isDark
        ? 'rgba(255,255,255,0.55)'
        : staticTheme.colors.gray[500],
      textAlign: 'center' as const,
      lineHeight: 20,
    },
  }), [showSuccess, accent, isDark]);

  // ─────────────────────────────────────────────────────────────────────────
  // Permission-denied screen
  // ─────────────────────────────────────────────────────────────────────────

  const renderPermissionDenied = () => (
    <View style={staticStyles.permissionContainer}>
      <View style={dynStyles.permissionCard}>
        <View style={dynStyles.permissionIconCircle}>
          <AlertTriangle size={28} color={accent} />
        </View>
        <Text variant="h5" weight="bold" style={dynStyles.permissionHeading}>
          Camera Permission Required
        </Text>
        <Text variant="body-sm" style={dynStyles.permissionBody}>
          To scan product barcodes, allow this app to access your camera in your
          device settings.
        </Text>
        <Button
          title="Open Settings"
          onPress={() => Linking.openSettings()}
          variant="primary"
          size="md"
          fullWidth
        />
        <Button
          title="Cancel"
          onPress={onClose}
          variant="outline"
          size="md"
          fullWidth
        />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Permission-request screen (not yet asked, or "ask again" still possible)
  // ─────────────────────────────────────────────────────────────────────────

  const renderPermissionPending = () => (
    <View style={staticStyles.permissionContainer}>
      <View style={dynStyles.permissionCard}>
        <View style={dynStyles.permissionIconCircle}>
          <ScanLine size={28} color={accent} />
        </View>
        <Text variant="h5" weight="bold" style={dynStyles.permissionHeading}>
          Allow Camera Access
        </Text>
        <Text variant="body-sm" style={dynStyles.permissionBody}>
          Camera access is needed to scan product barcodes and auto-fill the SKU
          field.
        </Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
          variant="primary"
          size="md"
          fullWidth
        />
        <Button
          title="Cancel"
          onPress={onClose}
          variant="outline"
          size="md"
          fullWidth
        />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Live scanner UI
  // ─────────────────────────────────────────────────────────────────────────

  const renderScanner = () => (
    <>
      {/* Full-screen camera feed behind all overlays */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
      />

      {/*
       * Dark overlay layout:
       *   The approach avoids calc() (unsupported in RN) by using a flex
       *   column that exactly mirrors the overlay geometry:
       *
       *   ┌─────────────────────────────┐
       *   │  overlayTop (flex: 1)       │  ~28% of screen height
       *   ├──────┬──────────────┬───────┤
       *   │ side │   RETICLE    │  side │  RETICLE_HEIGHT px
       *   ├──────┴──────────────┴───────┤
       *   │  overlayBottom (flex: 1)    │  remainder
       *   └─────────────────────────────┘
       */}
      <View style={staticStyles.overlayColumn} pointerEvents="none">
        {/* Top dark band */}
        <View style={[staticStyles.overlayBand, { flex: RETICLE_TOP_PERCENT }]} />

        {/* Middle row: left dark | clear reticle | right dark */}
        <View style={[staticStyles.overlayRow, { height: RETICLE_HEIGHT }]}>
          <View style={staticStyles.overlaySide} />
          <View style={dynStyles.reticle} />
          <View style={staticStyles.overlaySide} />
        </View>

        {/* Bottom dark band + hint pill */}
        <View style={[staticStyles.overlayBand, { flex: 100 - RETICLE_TOP_PERCENT }]}>
          {/* Hint text sits just below the reticle */}
          <View style={staticStyles.hintContainer}>
            <View style={staticStyles.hintPill}>
              <ScanLine
                size={14}
                color={showSuccess ? successColor : accent}
              />
              <Text
                variant="body-sm"
                weight="medium"
                style={dynStyles.hintPillText}
              >
                {showSuccess
                  ? 'Barcode detected!'
                  : 'Align barcode within the frame'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Success flash — full-screen green tint */}
      {showSuccess && (
        <Animated.View
          style={[staticStyles.successFlash, { opacity: flashOpacity }]}
          pointerEvents="none"
        />
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Permission state resolver
  // ─────────────────────────────────────────────────────────────────────────

  const resolveContent = () => {
    // `permission` is null briefly on first render while expo-camera resolves
    // the OS permission status. Show the request UI until it resolves.
    if (permission === null || !permission.granted) {
      if (permission !== null && !permission.canAskAgain) {
        return renderPermissionDenied();
      }
      return renderPermissionPending();
    }
    return renderScanner();
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={handleModalShow}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={staticStyles.container}>
        {/* Header row: back button + centred title */}
        <View
          style={[
            staticStyles.headerRow,
            { paddingTop: insets.top + staticTheme.spacing.sm },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={dynStyles.closeBtnCircle}
            accessibilityLabel="Close scanner"
            accessibilityRole="button"
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>

          <Text
            variant="body"
            weight="semibold"
            style={staticStyles.headerTitle}
          >
            Scan Barcode
          </Text>

          {/* Right spacer keeps title visually centred */}
          <View style={staticStyles.headerSpacer} />
        </View>

        {resolveContent()}
      </View>
    </Modal>
  );
};

BarcodeScannerModal.displayName = 'BarcodeScannerModal';

// ─── Static styles ────────────────────────────────────────────────────────────

const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.72)';

const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // ── Header ───────────────────────────────────────────────────────────────
  headerRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom: staticTheme.spacing.sm,
  },
  headerTitle: {
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },

  // ── Overlay ───────────────────────────────────────────────────────────────
  // Full-screen absolute column for the cutout overlay pattern.
  overlayColumn: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlayBand: {
    backgroundColor: OVERLAY_COLOR,
    width: '100%',
  },
  overlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: OVERLAY_COLOR,
  },

  // ── Hint pill ─────────────────────────────────────────────────────────────
  hintContainer: {
    alignItems: 'center',
    marginTop: staticTheme.spacing.md,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // ── Success flash ─────────────────────────────────────────────────────────
  successFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 214, 140, 0.18)',
  },

  // ── Permission screens ────────────────────────────────────────────────────
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
