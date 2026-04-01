/**
 * BarcodeScannerModal
 *
 * Full-screen barcode scanner with a fixed centred scan zone.
 * The user aligns the barcode within the frame — no coordinate-snapping
 * is attempted. This is the same pattern used by Amazon, Shopee, and every
 * major retail scanner app: it is reliable across all devices and platforms
 * regardless of how the camera driver reports barcode coordinates.
 *
 * Scanning flow:
 *   1. Camera permission is checked on mount.
 *   2. A fixed scan zone sits in the centre of the screen, surrounded by a
 *      dark vignette. A laser line sweeps top-to-bottom inside the zone.
 *   3. `onBarcodeScanned` fires on the first valid code. The brackets turn
 *      green, a success flash plays, then the modal closes.
 *
 * Props:
 *   visible   — controls modal visibility
 *   onClose   — called when the user taps ✕ or back
 *   onScanned — called with the raw barcode string on successful scan
 *
 * Supported formats:
 *   ean13, ean8, upc_a, upc_e, code39, code128, qr, pdf417, aztec,
 *   datamatrix, itf14, codabar
 */

import React, {
  useCallback,
  useRef,
  useState,
  useMemo,
} from 'react';
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

const SUPPORTED_BARCODE_TYPES: BarcodeType[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128',
  'qr', 'pdf417', 'aztec', 'datamatrix', 'itf14', 'codabar',
];

/** How long (ms) the green success flash is visible before the modal closes. */
const SUCCESS_FLASH_DURATION_MS = 800;

/** Fixed scan zone — wide enough for all barcode types in portrait. */
const RETICLE_W = 280;
const RETICLE_H = 180;

const BRACKET_ARM    = 28;
const BRACKET_STROKE = 3;
const BRACKET_RADIUS = 5;

const IDLE_BRACKET_COLOR = '#FFFFFF';
const SUCCESS_COLOR      = '#3DD68C';
const LASER_COLOR        = '#4F9EFF';
const OVERLAY_COLOR      = 'rgba(0,0,0,0.75)';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BarcodeScannerModalProps {
  visible:   boolean;
  onClose:   () => void;
  onScanned: (barcode: string) => void;
}

// ─── Corner bracket sub-component ─────────────────────────────────────────────

type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface CornerBracketProps {
  position: CornerPosition;
  color:    string;
}

const CornerBracket: React.FC<CornerBracketProps> = ({ position, color }) => {
  const isTop  = position === 'topLeft'  || position === 'topRight';
  const isLeft = position === 'topLeft'  || position === 'bottomLeft';

  const hStyle = isLeft
    ? { left: 0, borderTopLeftRadius: isTop ? BRACKET_RADIUS : 0, borderBottomLeftRadius: isTop ? 0 : BRACKET_RADIUS }
    : { right: 0, borderTopRightRadius: isTop ? BRACKET_RADIUS : 0, borderBottomRightRadius: isTop ? 0 : BRACKET_RADIUS };

  const vStyle = hStyle;
  const vPos   = isTop ? { top: 0 } : { bottom: 0 };

  return (
    <View
      style={[
        cornerStyles.wrapper,
        isTop  ? cornerStyles.top    : cornerStyles.bottom,
        isLeft ? cornerStyles.left   : cornerStyles.right,
      ]}
      pointerEvents="none"
    >
      <View style={[cornerStyles.armH, { backgroundColor: color }, hStyle, vPos]} />
      <View style={[cornerStyles.armV, { backgroundColor: color }, vStyle, vPos]} />
    </View>
  );
};

const cornerStyles = StyleSheet.create({
  wrapper: { position: 'absolute', width: BRACKET_ARM, height: BRACKET_ARM },
  top:     { top: 0 },
  bottom:  { bottom: 0 },
  left:    { left: 0 },
  right:   { right: 0 },
  armH: { position: 'absolute', width: BRACKET_ARM, height: BRACKET_STROKE },
  armV: { position: 'absolute', width: BRACKET_STROKE, height: BRACKET_ARM },
});

// ─── Component ────────────────────────────────────────────────────────────────

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScanned,
}) => {
  const insets = useSafeAreaInsets();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  // ── Permission ───────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();

  // ── State ────────────────────────────────────────────────────────────────
  const scannedRef               = useRef(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [bracketColor, setBracketColor] = useState(IDLE_BRACKET_COLOR);

  // ── Animated values ──────────────────────────────────────────────────────
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const laserY       = useRef(new Animated.Value(0)).current;
  const hintOpacity  = useRef(new Animated.Value(0.5)).current;

  // ── Laser loop ───────────────────────────────────────────────────────────
  const laserLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startLaserLoop = useCallback(() => {
    laserLoopRef.current?.stop();
    laserY.setValue(0);
    laserLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, { toValue: RETICLE_H, duration: 1600, useNativeDriver: true }),
        Animated.timing(laserY, { toValue: 0,         duration: 1600, useNativeDriver: true }),
      ]),
    );
    laserLoopRef.current.start();
  }, [laserY]);

  const stopLaserLoop = useCallback(() => {
    laserLoopRef.current?.stop();
    laserLoopRef.current = null;
  }, []);

  // ── Hint pulse ───────────────────────────────────────────────────────────
  const hintPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startHintPulse = useCallback(() => {
    hintPulseRef.current?.stop();
    hintOpacity.setValue(0.5);
    hintPulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(hintOpacity, { toValue: 1,   duration: 900, useNativeDriver: true }),
        Animated.timing(hintOpacity, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ]),
    );
    hintPulseRef.current.start();
  }, [hintOpacity]);

  const stopHintPulse = useCallback(() => {
    hintPulseRef.current?.stop();
    hintPulseRef.current = null;
    hintOpacity.setValue(1);
  }, [hintOpacity]);

  // ── Modal lifecycle ──────────────────────────────────────────────────────
  const handleModalShow = useCallback(() => {
    scannedRef.current = false;
    setShowSuccess(false);
    setBracketColor(IDLE_BRACKET_COLOR);
    flashOpacity.setValue(0);
    startLaserLoop();
    startHintPulse();
  }, [flashOpacity, startLaserLoop, startHintPulse]);

  const handleModalHide = useCallback(() => {
    stopLaserLoop();
    stopHintPulse();
  }, [stopLaserLoop, stopHintPulse]);

  // ── Success flash ────────────────────────────────────────────────────────
  const triggerSuccessFlash = useCallback(() => {
    setShowSuccess(true);
    stopLaserLoop();
    stopHintPulse();
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1,   duration: 80,  useNativeDriver: true }),
      Animated.delay(SUCCESS_FLASH_DURATION_MS - 180),
      Animated.timing(flashOpacity, { toValue: 0,   duration: 100, useNativeDriver: true }),
    ]).start(() => setShowSuccess(false));
  }, [flashOpacity, stopLaserLoop, stopHintPulse]);

  // ── Barcode detected ─────────────────────────────────────────────────────
  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scannedRef.current) return;
      scannedRef.current = true;

      const barcodeValue = result.data.trim();
      if (!barcodeValue) {
        scannedRef.current = false;
        return;
      }

      setBracketColor(SUCCESS_COLOR);
      triggerSuccessFlash();

      setTimeout(() => {
        onScanned(barcodeValue);
        onClose();
      }, SUCCESS_FLASH_DURATION_MS);
    },
    [onScanned, onClose, triggerSuccessFlash],
  );

  // ── Theme ────────────────────────────────────────────────────────────────
  const accent = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    closeBtnCircle: {
      width:           44,
      height:          44,
      borderRadius:    22,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems:      'center'  as const,
      justifyContent:  'center'  as const,
      borderWidth:     1,
      borderColor:     'rgba(255,255,255,0.15)',
    },
    permissionCard: {
      backgroundColor:  isDark ? '#1A1F2E' : '#FFFFFF',
      borderRadius:     20,
      padding:          staticTheme.spacing.lg,
      marginHorizontal: staticTheme.spacing.lg,
      alignItems:       'center' as const,
      gap:              staticTheme.spacing.md,
      borderWidth:      1,
      borderColor:      isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200],
    },
    permissionIconCircle: {
      width:           64,
      height:          64,
      borderRadius:    32,
      backgroundColor: `${accent}18`,
      borderWidth:     1,
      borderColor:     `${accent}30`,
      alignItems:      'center'  as const,
      justifyContent:  'center'  as const,
    },
    permissionHeading: {
      color:     isDark ? '#FFFFFF' : staticTheme.colors.gray[900],
      textAlign: 'center' as const,
    },
    permissionBody: {
      color:      isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[500],
      textAlign:  'center' as const,
      lineHeight: 20,
    },
  }), [isDark, accent]);

  // ─────────────────────────────────────────────────────────────────────────
  // Permission screens
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
        <Button title="Open Settings" onPress={() => Linking.openSettings()} variant="primary" size="md" fullWidth />
        <Button title="Cancel"        onPress={onClose}                       variant="outline"  size="md" fullWidth />
      </View>
    </View>
  );

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
        <Button title="Grant Permission" onPress={requestPermission} variant="primary" size="md" fullWidth />
        <Button title="Cancel"           onPress={onClose}           variant="outline"  size="md" fullWidth />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Live scanner
  // ─────────────────────────────────────────────────────────────────────────

  const renderScanner = () => (
    <>
      {/* Full-screen camera feed */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
      />

      {/*
       * Vignette with transparent cutout.
       *
       * Four dark strips surround the scan zone, created entirely with flex
       * layout — no absolute positioning, no coordinate mapping. The scan
       * zone itself is transparent so the camera shows through clearly.
       *
       * Layout (column):
       *   ┌──────────────────────────┐
       *   │  vigTop  (flex 1.5)      │  ← larger top margin → zone above centre
       *   ├────┬─────────────┬───────┤
       *   │ L  │  scan zone  │  R    │  ← RETICLE_H tall
       *   ├────┴─────────────┴───────┤
       *   │  hintStrip               │  ← fixed height, hint text
       *   │  vigBottom (flex 1)      │
       *   └──────────────────────────┘
       */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top dark strip */}
        <View style={staticStyles.vigTop} />

        {/* Middle row: left | scan zone | right */}
        <View style={staticStyles.vigMiddleRow}>
          <View style={staticStyles.vigSide} />

          {/* Scan zone — transparent, corners + laser inside */}
          <View style={staticStyles.scanZone}>
            <CornerBracket position="topLeft"     color={bracketColor} />
            <CornerBracket position="topRight"    color={bracketColor} />
            <CornerBracket position="bottomLeft"  color={bracketColor} />
            <CornerBracket position="bottomRight" color={bracketColor} />

            {!showSuccess && (
              <Animated.View
                style={[
                  staticStyles.laserLine,
                  { transform: [{ translateY: laserY }] },
                ]}
              />
            )}
          </View>

          <View style={staticStyles.vigSide} />
        </View>

        {/* Hint strip — sits directly below scan zone */}
        <View style={staticStyles.hintStrip}>
          <Animated.View style={[staticStyles.hintPill, { opacity: hintOpacity }]}>
            <ScanLine size={14} color={showSuccess ? SUCCESS_COLOR : LASER_COLOR} />
            <Text
              variant="body-sm"
              weight="medium"
              style={{ color: showSuccess ? SUCCESS_COLOR : '#FFFFFF' }}
            >
              {showSuccess ? 'Barcode detected!' : 'Align barcode within the frame'}
            </Text>
          </Animated.View>

          {!showSuccess && (
            <View style={staticStyles.formatPill}>
              <Text variant="body-xs" style={staticStyles.formatPillText}>
                EAN · UPC · QR · Code128 · PDF417
              </Text>
            </View>
          )}
        </View>

        {/* Bottom dark strip */}
        <View style={staticStyles.vigBottom} />
      </View>

      {/* Full-screen green flash on success */}
      {showSuccess && (
        <Animated.View
          style={[staticStyles.successFlash, { opacity: flashOpacity }]}
          pointerEvents="none"
        />
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────

  const resolveContent = () => {
    if (permission === null || !permission.granted) {
      if (permission !== null && !permission.canAskAgain) {
        return renderPermissionDenied();
      }
      return renderPermissionPending();
    }
    return renderScanner();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onShow={handleModalShow}
      onDismiss={handleModalHide}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={staticStyles.container}>
        {/* Header — floats above everything at zIndex 20 */}
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

          <Text variant="body" weight="semibold" style={staticStyles.headerTitle}>
            Scan Barcode
          </Text>

          {/* Spacer keeps title visually centred */}
          <View style={staticStyles.headerSpacer} />
        </View>

        {resolveContent()}
      </View>
    </Modal>
  );
};

BarcodeScannerModal.displayName = 'BarcodeScannerModal';

// ─── Static styles ────────────────────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#000000',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  headerRow: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    zIndex:            20,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.sm,
  },
  headerTitle: {
    color:     '#FFFFFF',
    flex:      1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },

  // ── Vignette strips ───────────────────────────────────────────────────────
  vigTop: {
    flex:            1.5,       // larger than bottom → zone sits above centre
    backgroundColor: OVERLAY_COLOR,
  },
  vigMiddleRow: {
    flexDirection: 'row',
    height:        RETICLE_H,
  },
  vigSide: {
    flex:            1,
    backgroundColor: OVERLAY_COLOR,
  },
  vigBottom: {
    flex:            1,
    backgroundColor: OVERLAY_COLOR,
  },

  // ── Scan zone (transparent cutout) ───────────────────────────────────────
  scanZone: {
    width:    RETICLE_W,
    height:   RETICLE_H,
    overflow: 'hidden',
  },

  // ── Laser sweep line ──────────────────────────────────────────────────────
  laserLine: {
    position:        'absolute',
    left:            4,
    right:           4,
    height:          2,
    borderRadius:    1,
    backgroundColor: LASER_COLOR,
    shadowColor:     LASER_COLOR,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    6,
    elevation:       6,
  },

  // ── Hint strip (directly below scan zone) ────────────────────────────────
  hintStrip: {
    backgroundColor: OVERLAY_COLOR,
    alignItems:      'center',
    paddingTop:      20,
    paddingBottom:   16,
    gap:             10,
  },
  hintPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   'rgba(0,0,0,0.60)',
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:      24,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.14)',
  },

  // ── Format pill ───────────────────────────────────────────────────────────
  formatPill: {
    backgroundColor:   'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      14,
  },
  formatPillText: {
    color:     'rgba(255,255,255,0.38)',
    textAlign: 'center',
  },

  // ── Success flash ─────────────────────────────────────────────────────────
  successFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61,214,140,0.20)',
    zIndex:          15,
  },

  // ── Permission screens ────────────────────────────────────────────────────
  permissionContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
