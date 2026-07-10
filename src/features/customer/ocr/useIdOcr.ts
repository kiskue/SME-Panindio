/**
 * OCR — useIdOcr hook
 * ===================
 * Orchestrates the on-device ID OCR pipeline and exposes a thin, UI-friendly API.
 *
 * Pipeline (per the OCR workflow standard):
 *   Capture (custom camera screen OR system camera/library fallback)
 *     -> basic image validation
 *     -> pre-process (resize + compress, see imagePreprocess.ts)
 *     -> on-device recognition (ML Kit, dynamically required)
 *     -> parse (pure parser.ts)
 *     -> QUALITY GATE (blur / darkness / glare / readability, see imageQuality.ts)
 *     -> return structured result (+ verdict) for retake-or-autofill
 *
 * Two capture entry points:
 *   - `recognizeFromUri(uri, w?, h?)` — preferred. The custom expo-camera overlay
 *     screen captures a photo and hands us the URI; we run the rest of the pipeline.
 *   - `captureAndRecognize()` — convenience fallback that opens the system camera
 *     (expo-image-picker) and then calls `recognizeFromUri`. Keep as gallery/system
 *     fallback for environments without the custom camera.
 *
 * Retake loop contract (what the UI does):
 *   1. Camera screen captures -> calls `recognizeFromUri(uri, w, h)`.
 *   2. On resolve, inspect `result.quality.status`:
 *        - `'ok'`     -> navigate to verify-id, auto-fill `result.parsed`.
 *        - anything else -> stay on camera, show `result.quality.reasons[0]` and a
 *          Retake button (call `reset()` then re-capture). `status` is also exposed
 *          as `'low_quality'` so screens can branch on the hook state alone.
 *
 * On-device first (PII): recognition + quality analysis run locally; raw ID text
 * never leaves the device except in the final, user-confirmed submission. If a
 * native/optional module is missing the hook degrades gracefully and never crashes.
 *
 * PII NOTE: this hook never logs raw OCR text. Errors are surfaced via state.
 */

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { preprocessIdImage } from './imagePreprocess';
import { parseIdText } from './parser';
import { assessImageQuality } from './imageQuality';
import type { IdOcrResult, IdOcrStatus, QualityVerdict, NormalizedRect } from './types';

/**
 * Minimal structural type for the ML Kit text-recognition default export (v2). Each
 * block carries an optional pixel `frame` we use for the geometric framing gate; the
 * shape is a subset of the real `TextBlock` so we never hard-depend on the native type.
 */
interface MlKitTextBlock {
  frame?: { left: number; top: number; width: number; height: number };
}
interface MlKitTextRecognition {
  recognize: (uri: string) => Promise<{ text: string; blocks?: MlKitTextBlock[] }>;
}

function loadMlKit(): MlKitTextRecognition | null {
  try {
    // Dynamic require so the app never crashes when the native module is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition') as {
      default?: MlKitTextRecognition;
    } & MlKitTextRecognition;
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export interface UseIdOcrResult {
  /** Current pipeline status. `'low_quality'` ⇒ finished but the gate failed. */
  status: IdOcrStatus;
  /** Latest OCR result (image + raw text + parsed fields + quality), or null. */
  result: IdOcrResult | null;
  /** Convenience accessor for `result.quality` (the retake-loop verdict), or null. */
  verdict: QualityVerdict | null;
  /** Non-PII, user-facing error message, or null. */
  error: string | null;
  /** True while capturing or processing. */
  isBusy: boolean;
  /**
   * Run the full pipeline on an already-captured photo URI (the custom camera
   * screen's path). Optionally pass the capture's width/height for a fast too-small
   * reject, and the on-screen `cutout` (normalized to the source-photo fractions) to
   * enable the GEOMETRIC framing gate — ML Kit runs on the FULL frame so text outside
   * the box is visible, and the cutout maps the box into the same fraction space.
   * Returns the result (also stored in `result`) or null on error.
   */
  recognizeFromUri: (
    uri: string,
    width?: number,
    height?: number,
    cutout?: NormalizedRect,
  ) => Promise<IdOcrResult | null>;
  /**
   * Fallback: open the system camera (expo-image-picker), capture an ID photo,
   * then run the full pipeline. Returns the result or null if cancelled/failed.
   */
  captureAndRecognize: () => Promise<IdOcrResult | null>;
  /** Clear the current result/error back to idle (e.g. on retake). */
  reset: () => void;
}

export function useIdOcr(): UseIdOcrResult {
  const [status, setStatus] = useState<IdOcrStatus>('idle');
  const [result, setResult] = useState<IdOcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  const recognizeFromUri = useCallback(
    async (
      uri: string,
      width?: number,
      height?: number,
      cutout?: NormalizedRect,
    ): Promise<IdOcrResult | null> => {
      setError(null);

      // ── Validation (lightweight) ───────────────────────────────────────────
      // Reject obviously-too-small captures that cannot contain a readable ID.
      // Only enforced when the caller knows the width (system picker / camera asset).
      if (width !== undefined && width > 0 && width < 600) {
        setError('That photo is too small or low-resolution. Move closer and fill the frame with your ID.');
        setStatus('error');
        return null;
      }

      setStatus('processing');

      // ── Pre-process (resize + compress) ─────────────────────────────────────
      const pre = await preprocessIdImage(uri, width, height);

      // ── Recognition (on-device ML Kit, optional) ────────────────────────────
      // NOTE: we OCR the FULL pre-processed frame (not a box-crop) so text that
      // falls OUTSIDE the cutout is visible to the geometric framing check below.
      const mlkit = loadMlKit();
      let rawText = '';
      let ocrAvailable = false;
      let blocks: MlKitTextBlock[] | undefined;
      if (mlkit) {
        try {
          const recognized = await mlkit.recognize(pre.uri);
          rawText = recognized.text ?? '';
          blocks = recognized.blocks;
          ocrAvailable = true;
        } catch {
          // Recognition failed at runtime — keep image, fall back to manual entry.
          ocrAvailable = false;
        }
      }

      // ── Parse ───────────────────────────────────────────────────────────────
      const parsed = parseIdText(rawText);

      // ── Quality gate (framing geometry + blur / darkness / glare / readability) ─
      // Pass the ML Kit block geometry, the OCR image dims (the space those frames
      // are in) and the normalized cutout so the gate can judge framing on ACTUAL
      // text positions. exactOptionalPropertyTypes ⇒ spread optionals conditionally.
      const quality = await assessImageQuality({
        imageUri: pre.uri,
        rawText,
        ocrAvailable,
        parsed,
        ...(blocks ? { blocks } : {}),
        ...(pre.width > 0 ? { imageWidth: pre.width } : {}),
        ...(pre.height > 0 ? { imageHeight: pre.height } : {}),
        ...(cutout ? { cutout } : {}),
      });

      const ocrResult: IdOcrResult = {
        imageUri: pre.uri,
        rawText,
        parsed,
        ocrAvailable,
        quality,
      };
      setResult(ocrResult);
      // 'low_quality' lets the UI branch on hook state alone to show a retake prompt.
      setStatus(quality.status === 'ok' ? 'done' : 'low_quality');
      return ocrResult;
    },
    [],
  );

  const captureAndRecognize = useCallback(async (): Promise<IdOcrResult | null> => {
    setError(null);

    // ── Permission ──────────────────────────────────────────────────────────
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is required to scan your ID. Please enable it in Settings.');
      setStatus('error');
      return null;
    }

    // ── Capture ─────────────────────────────────────────────────────────────
    setStatus('capturing');
    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      const picked = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1, // capture at full quality; we compress in pre-processing
        allowsEditing: false,
        exif: false,
      });
      if (picked.canceled) {
        setStatus(result ? 'done' : 'idle');
        return null;
      }
      asset = picked.assets[0];
    } catch {
      setError('Could not open the camera. Please try again.');
      setStatus('error');
      return null;
    }

    if (!asset?.uri) {
      setError('No photo was captured. Please try again.');
      setStatus('error');
      return null;
    }

    return recognizeFromUri(asset.uri, asset.width, asset.height);
  }, [result, recognizeFromUri]);

  return {
    status,
    result,
    verdict: result?.quality ?? null,
    error,
    isBusy: status === 'capturing' || status === 'processing',
    recognizeFromUri,
    captureAndRecognize,
    reset,
  };
}
