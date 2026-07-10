/**
 * OCR — In-app ID Camera Overlay
 * ==============================
 * Full-screen `expo-camera` capture surface for Philippine government IDs.
 *
 * Why a custom camera (vs. the system camera): only an in-app `CameraView` lets us
 * draw a live ID-card-shaped frame guide, run an on-device quality gate the moment
 * a photo is taken, and keep the user in a tight RETAKE loop until the capture is
 * sharp / bright / readable enough for OCR — without ever leaving the flow.
 *
 * Capture → quality-gate → retake loop:
 *   1. User aligns the ID inside the ISO ID-1 (1.585:1) cutout and taps the shutter.
 *   2. `takePictureAsync` → `recognize(uri, w, h)` runs pre-process + ML Kit +
 *      parse + the image-quality gate (see imageQuality.ts).
 *   3. `quality.status === 'ok'`  → success flash, hand the result to the parent.
 *      otherwise                  → show the specific reason + "Capture again" and
 *      stay on the camera (the user never reaches auto-fill with a bad capture).
 *      After repeated failures we surface an "Enter details manually" escape hatch.
 *
 * PII: this component shows only generic, non-PII guidance (its own copy plus the
 * gate's `reasons[0]` as a muted detail). It never logs or displays card text.
 *
 * Reuses the mask/bracket/permission patterns proven in BarcodeScannerModal.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Modal, StyleSheet, TouchableOpacity, Linking,
  useWindowDimensions, ActivityIndicator, AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView } from 'expo-camera';
import { useCameraPermissionWithAppState } from '@/hooks';
import * as ImagePicker from 'expo-image-picker';
import {
  X, Zap, ZapOff, Images, AlertTriangle, Sun, Scan, ScanLine, ShieldCheck, CheckCircle2,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import type { IdOcrResult, ImageQualityStatus, QualityVerdict, NormalizedRect } from './types';

// ── Brand + overlay tokens (match verify-id.tsx) ──────────────────────────────
const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';
const MASK  = 'rgba(15,23,42,0.78)'; // navy-black scrim

/** ISO/IEC 7810 ID-1 aspect ratio (credit-card / most PH gov IDs), landscape. */
const ID1_ASPECT = 1.585;
/** Horizontal inset of the capture frame from each screen edge. */
const FRAME_INSET = 24;
/** Cap the frame width on tablets so the card guide stays believable. */
const FRAME_MAX_W = 520;
/** After this many consecutive failed captures, offer manual entry. */
const MANUAL_ENTRY_AFTER = 3;

const HS = { top: 10, bottom: 10, left: 10, right: 10 };

/** Capture flow phase that drives all overlay affordances. */
type CapturePhase = 'aligning' | 'analyzing' | 'retry' | 'success';

/** Title + body copy per failed-quality status (the gate's reason is a 3rd line). */
const RETRY_COPY: Record<Exclude<ImageQualityStatus, 'ok'>, { title: string; body: string }> = {
  blurry:       { title: 'That photo came out blurry',          body: 'Hold your phone steady and keep your ID in focus.' },
  too_dark:     { title: 'It’s a bit too dark to read',         body: 'Move to brighter light or turn on the flash.' },
  glare:        { title: 'There’s glare on your ID',            body: 'Tilt your ID or phone slightly to remove the reflection.' },
  not_in_frame: { title: 'Fit the whole ID inside the box',     body: 'Part of your ID is outside the frame. Line up all four edges inside the box, then capture again.' },
  unreadable:   { title: 'We couldn’t read your ID this time',  body: 'Try on a flat, plain surface with even lighting — or enter details by hand.' },
};

/** Optional success haptic — no-op when expo-haptics is not installed. */
function successHaptic(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const H = require('expo-haptics') as {
      notificationAsync?: (t?: unknown) => void;
      NotificationFeedbackType?: { Success?: unknown };
    };
    H.notificationAsync?.(H.NotificationFeedbackType?.Success);
  } catch {
    // expo-haptics absent — silent.
  }
}

// ── Cutout → framing geometry ────────────────────────────────────────────────────
// Make the framing box MEANINGFUL without throwing away context: we DON'T pre-crop
// the photo before OCR (that would hide any ID text hanging OUTSIDE the box). Instead
// we map the on-screen cutout into the captured photo as a NORMALIZED rect and hand it
// to the OCR pipeline; the geometric gate (imageQuality.ts) then judges whether the
// recognized text actually sits wholly inside and centred in that box.

interface CropRect { originX: number; originY: number; width: number; height: number }

/**
 * Map the on-screen ID-1 cutout rect to PHOTO pixel coordinates.
 *
 * The live preview is rendered "cover" — the camera frame is scaled to fill the
 * whole screen and the overflow is centre-cropped. We invert that transform:
 * compute the cover scale + centre offsets between the captured photo and the
 * screen, convert the cutout rect (screen px → photo px), then clamp to bounds.
 *
 * Returns null — "crop not safe, use the full image" — when dims are missing /
 * degenerate, OR when the photo's orientation differs from the screen's. In the
 * latter case the manipulator's crop coordinates may not line up with the saved
 * pixel buffer, so we decline rather than risk clipping an otherwise-good capture.
 */
export function computeCutoutCrop(
  photoW: number,
  photoH: number,
  screenW: number,
  screenH: number,
  frameLeft: number,
  frameTop: number,
  frameW: number,
  frameH: number,
): CropRect | null {
  if (!(photoW > 0) || !(photoH > 0) || !(screenW > 0) || !(screenH > 0)) return null;

  // The saved JPEG is assumed upright (matching the preview). Only proceed when the
  // photo and the screen share an orientation; otherwise decline (see above).
  const screenPortrait = screenH >= screenW;
  const photoPortrait = photoH >= photoW;
  if (photoPortrait !== screenPortrait) return null;

  const scale = Math.max(screenW / photoW, screenH / photoH);
  if (!(scale > 0) || !Number.isFinite(scale)) return null;

  const offsetX = (photoW * scale - screenW) / 2;
  const offsetY = (photoH * scale - screenH) / 2;

  let originX = (frameLeft + offsetX) / scale;
  let originY = (frameTop + offsetY) / scale;
  let width = frameW / scale;
  let height = frameH / scale;

  // Clamp to photo bounds (origin first, then size against the remaining room).
  originX = Math.max(0, Math.min(originX, photoW));
  originY = Math.max(0, Math.min(originY, photoH));
  width = Math.max(1, Math.min(width, photoW - originX));
  height = Math.max(1, Math.min(height, photoH - originY));

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Map the on-screen ID-1 cutout into NORMALIZED photo fractions (0–1) for the
 * geometric framing gate. Returns undefined — "framing geometry unavailable; the gate
 * falls back to its readability heuristic" — when the photo dims are missing or the
 * cover mapping declines (e.g. orientation mismatch). Pure; never throws.
 */
function cutoutToNormalized(
  photoW: number | undefined,
  photoH: number | undefined,
  screenW: number,
  screenH: number,
  frameLeft: number,
  frameTop: number,
  frameW: number,
  frameH: number,
): NormalizedRect | undefined {
  if (photoW === undefined || photoH === undefined || !(photoW > 0) || !(photoH > 0)) {
    return undefined;
  }
  const rect = computeCutoutCrop(
    photoW, photoH, screenW, screenH, frameLeft, frameTop, frameW, frameH,
  );
  if (!rect) return undefined;
  return {
    fx: rect.originX / photoW,
    fy: rect.originY / photoH,
    fw: rect.width / photoW,
    fh: rect.height / photoH,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface IdCameraOverlayProps {
  /** Whether the full-screen camera is shown. */
  visible: boolean;
  /** Close the camera (cancel) without a confirmed capture. */
  onClose: () => void;
  /** Called once with the result when the quality gate passes (`status === 'ok'`). */
  onConfirmed: (result: IdOcrResult) => void;
  /**
   * Runs the full OCR + quality pipeline on a captured photo URI. Wire this to
   * `useIdOcr().recognizeFromUri`. The optional `cutout` (normalized photo fractions)
   * drives the geometric framing gate. Resolves with the result (incl. `quality`).
   */
  recognize: (
    uri: string,
    width?: number,
    height?: number,
    cutout?: NormalizedRect,
  ) => Promise<IdOcrResult | null>;
  /**
   * Escape hatch: keep the captured image but let the user type the fields by hand
   * (offered after repeated quality failures, or immediately when unreadable).
   * Receives the last (low-quality) result, whose `imageUri` is still usable.
   */
  onManualEntry: (result: IdOcrResult | null) => void;
}

// ── Component ───────────────────────────────────────────────────────────────────
export const IdCameraOverlay: React.FC<IdCameraOverlayProps> = ({
  visible, onClose, onConfirmed, recognize, onManualEntry,
}) => {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissionWithAppState({ autoRequestOnMount: visible });
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<CapturePhase>('aligning');
  const [verdict, setVerdict] = useState<QualityVerdict | null>(null);
  const [torch, setTorch] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const lastResultRef = useRef<IdOcrResult | null>(null);
  const busyRef = useRef(false);

  // Reset to a clean capture state each time the overlay (re)opens. The component
  // stays mounted while the Modal is hidden, so without this the prior session's
  // `phase` (e.g. left at 'success' after a confirmed capture) would persist and
  // disable the shutter on reopen — forcing the user to close before retaking.
  useEffect(() => {
    if (!visible) return;
    setPhase('aligning');
    setVerdict(null);
    setFailCount(0);
    setTorch(false);
    busyRef.current = false;
  }, [visible]);

  // ── Frame geometry (computed → stays ID-1 across phones/tablets) ─────────────
  const FRAME_W = Math.min(SW - FRAME_INSET * 2, FRAME_MAX_W);
  const FRAME_H = FRAME_W / ID1_ASPECT;
  const FRAME_LEFT = (SW - FRAME_W) / 2;
  const FRAME_TOP = (SH - FRAME_H) / 2 - SH * 0.06; // nudge up ~6% to clear controls

  const bracketColor = phase === 'success' ? GREEN : '#FFFFFF';

  const resetToAligning = useCallback(() => {
    setPhase('aligning');
    setVerdict(null);
  }, []);

  const handleClose = useCallback(() => {
    setTorch(false);
    setFailCount(0);
    resetToAligning();
    onClose();
  }, [resetToAligning, onClose]);

  const runRecognize = useCallback(
    async (uri: string, w?: number, h?: number, cutout?: NormalizedRect) => {
      setPhase('analyzing');
      AccessibilityInfo.announceForAccessibility('Captured. Reading your ID.');
      const result = await recognize(uri, w, h, cutout);
      lastResultRef.current = result;

      if (result && result.quality.status === 'ok') {
        setPhase('success');
        setTorch(false);
        setFailCount(0);
        successHaptic();
        AccessibilityInfo.announceForAccessibility('Looks good. Continuing.');
        // Brief success flash, then hand off to the parent (auto-fill + close).
        setTimeout(() => onConfirmed(result), 560);
        return;
      }

      const v: QualityVerdict =
        result?.quality ?? { status: 'unreadable', score: 0, reasons: [] };
      setVerdict(v);
      setPhase('retry');
      setFailCount((n) => n + 1);
      const copy = v.status !== 'ok' ? RETRY_COPY[v.status] : RETRY_COPY.unreadable;
      AccessibilityInfo.announceForAccessibility(`${copy.title}. Please capture again.`);
    },
    [recognize, onConfirmed],
  );

  const handleCapture = useCallback(async () => {
    if (busyRef.current || !cameraRef.current) return;
    busyRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, exif: false });
      if (photo?.uri) {
        // OCR the FULL frame (no pre-crop) so text OUTSIDE the box is visible to the
        // geometric framing gate; pass the on-screen cutout as a normalized rect. When
        // the cover mapping declines (missing dims / orientation) `cutout` is undefined
        // and the gate degrades to its readability-only signal.
        const cutout = cutoutToNormalized(
          photo.width, photo.height, SW, SH, FRAME_LEFT, FRAME_TOP, FRAME_W, FRAME_H,
        );
        await runRecognize(photo.uri, photo.width, photo.height, cutout);
      } else {
        setVerdict({ status: 'unreadable', score: 0, reasons: [] });
        setPhase('retry');
        setFailCount((n) => n + 1);
      }
    } catch {
      setVerdict({ status: 'unreadable', score: 0, reasons: [] });
      setPhase('retry');
      setFailCount((n) => n + 1);
    } finally {
      busyRef.current = false;
    }
  }, [runRecognize, SW, SH, FRAME_LEFT, FRAME_TOP, FRAME_W, FRAME_H]);

  const handleGallery = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) return;
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false,
      });
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset?.uri) await runRecognize(asset.uri, asset.width, asset.height);
    } catch {
      // Library unavailable / cancelled — stay on camera.
    } finally {
      busyRef.current = false;
    }
  }, [runRecognize]);

  // ── Permission gates ─────────────────────────────────────────────────────────
  const renderPermission = (denied: boolean) => (
    <View style={styles.permWrap}>
      <View style={styles.permCard}>
        <View style={styles.permIcon}>
          {denied ? <AlertTriangle size={28} color={AMBER} /> : <ScanLine size={28} color={NAVY} />}
        </View>
        <Text variant="h5" weight="bold" style={styles.permHeading}>
          {denied ? 'Camera permission needed' : 'Allow camera access'}
        </Text>
        <Text variant="body-sm" style={styles.permBody}>
          {denied
            ? 'To scan your ID, enable camera access for this app in your device settings.'
            : 'We use the camera to scan your ID on this device. Your photo stays private.'}
        </Text>
        <Button
          title={denied ? 'Open Settings' : 'Allow Camera'}
          onPress={denied ? () => Linking.openSettings() : requestPermission}
          variant="primary" size="md" fullWidth
        />
        <Button title="Cancel" onPress={handleClose} variant="outline" size="md" fullWidth />
      </View>
    </View>
  );

  // ── Guidance pill (above the cutout) ───────────────────────────────────────────
  const pillTitle =
    phase === 'analyzing' ? 'Reading your ID…'
    : phase === 'success' ? 'Got it! Check your details on the next screen.'
    : 'Center the front of your ID';

  const renderPill = () => (
    <View style={[styles.pill, { top: FRAME_TOP - 92, maxWidth: Math.min(SW - 48, 360) }]} pointerEvents="none">
      <Text style={styles.pillTitle}>{pillTitle}</Text>
      {phase === 'aligning' && (
        <Text style={styles.pillSub}>Fit the whole ID inside the box — show all 4 corners</Text>
      )}
    </View>
  );

  // ── Retry banner (bottom, replaces the control row on a failed gate) ───────────
  const renderBanner = () => {
    if (!verdict || verdict.status === 'ok') return null;
    const status = verdict.status;
    const copy = RETRY_COPY[status];
    const reason = verdict.reasons[0];
    const isWarning = status !== 'unreadable';
    const BannerIcon =
      status === 'too_dark' ? Sun
      : status === 'not_in_frame' ? Scan
      : status === 'unreadable' ? ScanLine
      : AlertTriangle;

    // Secondary action: flash for darkness, manual entry when unreadable / repeated.
    const offerManual = status === 'unreadable' || failCount >= MANUAL_ENTRY_AFTER;
    const secondary =
      status === 'too_dark' && !torch
        ? { label: 'Turn on flash', onPress: () => { setTorch(true); resetToAligning(); } }
        : offerManual
          ? { label: 'Enter details manually', onPress: () => onManualEntry(lastResultRef.current) }
          : null;

    return (
      <View
        style={[styles.banner, { paddingBottom: insets.bottom + 20 }, isWarning ? styles.bannerWarn : styles.bannerInfo]}
        accessibilityLiveRegion="assertive"
      >
        <BannerIcon size={20} color={isWarning ? AMBER : '#7FB2FF'} style={styles.bannerIcon} />
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle}>{copy.title}</Text>
          <Text style={styles.bannerBody}>{copy.body}</Text>
          {!!reason && <Text style={styles.bannerReason}>{reason}</Text>}
        </View>
        <View style={styles.bannerActions}>
          <Button title="Capture again" onPress={resetToAligning} size="md" />
          {secondary && (
            <TouchableOpacity onPress={secondary.onPress} hitSlop={HS}>
              <Text style={styles.bannerSecondary}>{secondary.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Bottom control row (capture / gallery / flash) ─────────────────────────────
  const renderControls = () => {
    const capturing = phase === 'analyzing' || phase === 'success';
    return (
      <View style={[styles.ctrlRow, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          onPress={handleGallery}
          style={styles.galleryBtn}
          hitSlop={HS}
          accessibilityRole="button"
          accessibilityLabel="Choose a saved photo of your ID"
        >
          <Images size={22} color="#FFFFFF" />
          <Text style={styles.galleryTxt}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCapture}
          disabled={capturing}
          style={styles.shutterOuter}
          accessibilityRole="button"
          accessibilityLabel="Capture ID photo"
          accessibilityState={{ disabled: capturing }}
        >
          {capturing ? (
            <ActivityIndicator color={NAVY} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>

        <View style={styles.ctrlSpacer} />
      </View>
    );
  };

  // ── Live capture surface ───────────────────────────────────────────────────────
  const renderCamera = () => (
    <>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter={false}
      />

      {/* Dimmed mask: 4 opaque panels around a transparent ID-1 cutout. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.mask, { top: 0, left: 0, right: 0, height: FRAME_TOP }]} />
        <View style={[styles.mask, { top: FRAME_TOP + FRAME_H, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.mask, { top: FRAME_TOP, left: 0, width: FRAME_LEFT, height: FRAME_H }]} />
        <View style={[styles.mask, { top: FRAME_TOP, right: 0, width: FRAME_LEFT, height: FRAME_H }]} />

        <View style={[styles.cutout, { top: FRAME_TOP, left: FRAME_LEFT, width: FRAME_W, height: FRAME_H }]}>
          <View style={[styles.corner, styles.cTL, { borderColor: bracketColor }]} />
          <View style={[styles.corner, styles.cTR, { borderColor: bracketColor }]} />
          <View style={[styles.corner, styles.cBL, { borderColor: bracketColor }]} />
          <View style={[styles.corner, styles.cBR, { borderColor: bracketColor }]} />

          {phase === 'analyzing' && (
            <View style={styles.frameCenter}><ActivityIndicator color="#FFFFFF" size="large" /></View>
          )}
          {phase === 'success' && (
            <View style={styles.frameCenter}>
              <View style={styles.successPill}>
                <CheckCircle2 size={18} color="#FFFFFF" />
                <Text style={styles.successPillText}>Captured</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Guidance pill above the frame */}
      {renderPill()}

      {/* Privacy reassurance just under the frame */}
      <View style={[styles.privacyRow, { top: FRAME_TOP + FRAME_H + 16 }]} pointerEvents="none">
        <ShieldCheck size={13} color={GREEN} />
        <Text style={styles.privacyText}>Scanned on your device — stays private</Text>
      </View>

      {/* Bottom: retry banner OR control row */}
      {phase === 'retry' ? renderBanner() : renderControls()}
    </>
  );

  const resolveContent = () => {
    if (!permission) return <View style={styles.permWrap}><ActivityIndicator color="#FFFFFF" size="large" /></View>;
    if (!permission.granted) return renderPermission(!permission.canAskAgain);
    return renderCamera();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Top bar: Cancel · STEP 1 OF 2 · Flash */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={HS}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.eyebrow}>STEP 1 OF 2</Text>

          <TouchableOpacity
            onPress={() => setTorch((t) => !t)}
            hitSlop={HS}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
          >
            {torch ? <Zap size={24} color={AMBER} /> : <ZapOff size={24} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>

        {resolveContent()}
      </View>
    </Modal>
  );
};

IdCameraOverlay.displayName = 'IdCameraOverlay';

// ── Styles ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: AMBER },

  // Mask + cutout
  mask: { position: 'absolute', backgroundColor: MASK },
  cutout: {
    position: 'absolute', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  corner: { position: 'absolute', width: 34, height: 34 },
  cTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },

  frameCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  successPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
  },
  successPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Guidance pill
  pill: {
    position: 'absolute', alignSelf: 'center', backgroundColor: MASK, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center', justifyContent: 'center',
  },
  pillTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  pillSub: { fontSize: 12, lineHeight: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 3 },

  // Privacy
  privacyRow: {
    position: 'absolute', left: 0, right: 0, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  privacyText: { color: 'rgba(255,255,255,0.70)', fontSize: 12 },

  // Control row
  ctrlRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 28, paddingTop: 8,
  },
  galleryBtn: { width: 64, alignItems: 'center', gap: 4 },
  galleryTxt: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  ctrlSpacer: { width: 64 },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },

  // Retry banner
  banner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  bannerWarn: { backgroundColor: '#1F2433', borderTopWidth: 2, borderTopColor: AMBER },
  bannerInfo: { backgroundColor: '#16233B', borderTopWidth: 2, borderTopColor: '#4F9EFF' },
  bannerIcon: { marginTop: 2 },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  bannerBody: { fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 3, lineHeight: 18 },
  bannerReason: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, lineHeight: 15 },
  bannerActions: { justifyContent: 'center', gap: 8 },
  bannerSecondary: { fontSize: 12.5, fontWeight: '700', color: AMBER, textAlign: 'center' },

  // Permission
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, gap: 12, width: '100%', maxWidth: 360,
    alignItems: 'center',
  },
  permIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(30,77,140,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  permHeading: { color: '#0F172A', textAlign: 'center' },
  permBody: { color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
