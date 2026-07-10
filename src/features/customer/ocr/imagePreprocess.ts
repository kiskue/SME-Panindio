/**
 * OCR — Image Pre-processing
 * ==========================
 * Improves text-recognition accuracy AND shrinks the payload before it leaves
 * the device by resizing + compressing the captured ID photo with
 * `expo-image-manipulator`.
 *
 * Why pre-process:
 *  - ML Kit accuracy plateaus around ~1600px on the long edge; full-resolution
 *    phone captures (4000px+) waste memory and CPU without improving OCR.
 *  - A compressed JPEG is also what we upload, so the raw multi-MB capture never
 *    leaves the device (privacy + bandwidth).
 *
 * Note: ML Kit's text recognizer already performs its own binarization/contrast
 * normalization internally, so we deliberately do NOT grayscale here (the legacy
 * `expo-image-manipulator` API exposes only resize/crop/rotate/flip — no
 * contrast/grayscale ops — and forcing grayscale via other means tends to hurt,
 * not help, ML Kit). We keep this module to resize + compress, which is the part
 * that reliably matters.
 *
 * Graceful fallback: if `expo-image-manipulator` is not installed, we return the
 * original URI unchanged so the pipeline still works (just larger upload).
 */

/** Long-edge target. ML Kit accuracy is good and stable at this size. */
const MAX_DIMENSION = 1600;

/** JPEG quality for the recognized + uploaded image (0–1). */
const JPEG_QUALITY = 0.7;

export interface PreprocessResult {
  /** Local URI of the processed (resized + compressed) JPEG. */
  uri: string;
  width: number;
  height: number;
  /** False when the manipulator module was unavailable (returns original URI). */
  processed: boolean;
}

/**
 * Minimal structural type for the parts of `expo-image-manipulator` we use, so
 * we can require it dynamically without a hard dependency at type-check time.
 */
interface ImageManipulatorModule {
  manipulateAsync: (
    uri: string,
    actions: Array<{ resize?: { width?: number; height?: number } }>,
    options: { compress?: number; format?: unknown; base64?: boolean },
  ) => Promise<{ uri: string; width: number; height: number }>;
  SaveFormat: { JPEG: unknown };
}

function loadManipulator(): ImageManipulatorModule | null {
  try {
    // Dynamic require so the bundle/app never crashes if the package is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ImageManipulatorModule;
  } catch {
    return null;
  }
}

/**
 * Resize the long edge down to `MAX_DIMENSION` (preserving aspect ratio) and
 * re-encode as a compressed JPEG. Falls back to the original URI on any failure.
 *
 * @param uri    Source image URI from the camera/library.
 * @param width  Original width  (from the picker asset) — used to decide the resize axis.
 * @param height Original height (from the picker asset).
 */
export async function preprocessIdImage(
  uri: string,
  width?: number,
  height?: number,
): Promise<PreprocessResult> {
  const manipulator = loadManipulator();
  if (!manipulator) {
    return { uri, width: width ?? 0, height: height ?? 0, processed: false };
  }

  try {
    // Resize on the longer edge only; the manipulator preserves aspect ratio
    // when a single dimension is provided.
    const isLandscape = (width ?? 0) >= (height ?? 0);
    const resize = isLandscape ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION };
    const needsResize = Math.max(width ?? 0, height ?? 0) > MAX_DIMENSION;

    const result = await manipulator.manipulateAsync(
      uri,
      needsResize ? [{ resize }] : [],
      { compress: JPEG_QUALITY, format: manipulator.SaveFormat.JPEG },
    );

    return { uri: result.uri, width: result.width, height: result.height, processed: true };
  } catch {
    // Manipulation failed (corrupt image, OOM…) — proceed with the original.
    return { uri, width: width ?? 0, height: height ?? 0, processed: false };
  }
}
