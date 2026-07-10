/**
 * OCR — Image Quality Gate (blur / darkness / glare / readability)
 * ================================================================
 * Given a captured ID photo (plus the ML Kit text result and parser output),
 * returns a {@link QualityVerdict} the UI uses to drive a RETAKE loop before the
 * user ever reaches the verify/auto-fill screen.
 *
 * Why this design (decision record — read before changing thresholds):
 * --------------------------------------------------------------------
 * True variance-of-Laplacian / brightness analysis needs RAW PIXELS. None of the
 * installed packages expose pixels: `expo-image-manipulator` only resizes/crops
 * and can emit a base64 **JPEG** (encoded bytes, NOT a pixel array), and there is
 * no Skia / vision-camera / OpenCV in this app. So we use a TWO-TIER strategy:
 *
 *   TIER 1 — OCR-readability gate (ALWAYS ON, zero new dependencies).
 *     The most reliable on-device signal for "is this ID usable" is the OCR result
 *     itself: how many characters ML Kit recovered, whether a document-specific
 *     anchor (PCN / license no. / MRZ) was found, and how many fields parsed. A
 *     genuinely blurry / dark / mis-framed ID yields little-to-no readable text,
 *     which we catch here. This alone is enough to ship a working retake loop.
 *
 *   TIER 2 — true pixel metrics (OPTIONAL, auto-enabled by a 1 pure-JS dep).
 *     If `jpeg-js` is installed, we downscale the capture to a tiny analysis frame
 *     via `expo-image-manipulator` (base64 JPEG), decode it to RGBA in pure JS,
 *     and compute mean luma (too_dark), clipped-highlight ratio (glare), and the
 *     variance-of-the-Laplacian (blur). `jpeg-js` is pure JavaScript (no native
 *     module, Hermes-safe, MIT), mirrors the existing dynamic-`require` + try/catch
 *     pattern, and is loaded ONLY when present — so the app runs today without it
 *     and gains real CV the moment it is added. See README note at bottom.
 *
 * To enable Tier 2:  npx expo install jpeg-js     (pure JS; no native rebuild)
 *
 * PII: this module reads only character COUNTS and pixel statistics. It never
 * logs, returns, or persists the raw OCR text. `reasons[]` are generic, safe to
 * show the user, and contain no card data.
 */

import type {
  ParsedIdResult,
  QualityVerdict,
  ImageQualityStatus,
  NormalizedRect,
  FramingMetrics,
} from './types';

// ── Tunable thresholds (empirical; exported for transparency / tests) ─────────
export const QUALITY_THRESHOLDS = {
  /** Analysis frame long-edge (px) for Tier-2 pixel decode. Small = fast. */
  ANALYSIS_DIM: 320,
  /** JPEG quality for the analysis frame (lower = faster decode, fine for stats). */
  ANALYSIS_JPEG_QUALITY: 0.6,
  /** Below this many alnum chars (when OCR ran) the ID is effectively unreadable. */
  MIN_CHARS_UNREADABLE: 8,
  /** Below this many alnum chars (no strong anchor) we treat as a soft-focus blur. */
  MIN_CHARS_READABLE: 24,
  /**
   * Parsed fields (name/dob/id/address/sex) at or above which — even without a
   * strong anchor — we consider the document "complete enough" to be fully framed.
   * Below this, with plenty of readable text but no anchor, the ID is likely
   * partly outside the box (see `not_in_frame`).
   */
  MIN_FIELDS_COMPLETE: 2,
  /** Border-ring thickness (fraction of each edge) for the framing pixel heuristic. */
  FRAME_BORDER_FRAC: 0.12,
  /** |Laplacian| below this counts a pixel as "flat" (background / empty surface). */
  FRAME_FLAT_EPS: 8,
  /** Mean |Laplacian| in the border ring above this ⇒ card content reaches the crop edge (cut off). */
  FRAME_CUTOFF_BORDER_EDGE: 14,
  /** Flat-pixel fraction above this ⇒ the box is mostly empty background (card too small). */
  FRAME_TOOSMALL_FLAT_RATIO: 0.8,
  /** Mean luma (0–255) below this ⇒ too dark. */
  DARK_MEAN_LUMA: 60,
  /** Mean luma (0–255) above this ⇒ washed out / over-exposed. */
  BRIGHT_MEAN_LUMA: 225,
  /** Fraction of near-white (clipped) pixels above this ⇒ specular glare. */
  GLARE_CLIPPED_RATIO: 0.06,
  /** Variance-of-Laplacian below this ⇒ blurry (luma scaled 0–255). */
  BLUR_VARIANCE_MIN: 90,
} as const;

// ── Framing thresholds (GEOMETRIC gate — ML Kit text-block boxes vs the cutout) ─
// All values are unit-less fractions. See `evaluateFraming` for the algorithm and
// the research/citations in the PR notes. These are the knobs to tune in the field.
export const FRAMING_THRESHOLDS = {
  /**
   * Edge tolerance: a text block may cross a cutout edge by up to this fraction of
   * the cutout dimension before it counts as "outside the box". ~4% forgives ML Kit
   * frame jitter and the few-px slop in the screen→photo cover mapping, while still
   * catching a genuinely cut-off ID (its text lands well past the edge).
   */
  FRAMING_INSET_TOL: 0.04,
  /**
   * Minimum fill: the enclosing box of in-cutout text must cover at least this
   * fraction of the cutout. Measured against the TEXT enclosing box (not the card
   * edges, which we cannot see), so it is lower than the literature's ~0.8 card-area
   * figure: a box-filling ID's text — including its full-width header/footer lines —
   * spans ~0.5-0.7 of the cutout. Below ~0.5 ⇒ the ID is too small / too far.
   */
  FRAMING_MIN_FILL: 0.5,
  /**
   * Maximum centre offset: normalized distance from the text enclosing box's centre
   * to the cutout centre (1.0 = a full half-extent). Above this ⇒ off-centre. Uses
   * the enclosing-box CENTRE (not the area centroid) so it is robust to PH-ID photo
   * regions having no text; ~0.18 of a half-extent ≈ 9% of the box dimension.
   */
  FRAMING_MAX_CENTER_OFFSET: 0.18,
} as const;

// ── Public input contract ─────────────────────────────────────────────────────

/**
 * Bounding box of a recognized text block, in PIXELS of the OCR image. Structural
 * subset of ML Kit's `TextBlock.frame` so we never hard-depend on the native type.
 * `frame` is optional because ML Kit may omit geometry on some devices.
 */
export interface OcrTextBlock {
  frame?: { left: number; top: number; width: number; height: number };
}

/** Everything the quality gate needs. All non-PII except `rawText` (never logged). */
export interface QualityGateInput {
  /** URI of the (already pre-processed) image actually sent to OCR. */
  imageUri: string;
  /** Raw recognized text. Used ONLY to count characters — never logged/returned. */
  rawText: string;
  /** True when ML Kit actually ran (false ⇒ can't judge readability). */
  ocrAvailable: boolean;
  /** Structured parser output — anchor strength + field count are strong signals. */
  parsed: ParsedIdResult;
  /**
   * ML Kit text blocks with pixel `frame`s (from the FULL captured frame, so text
   * outside the box is visible to the geometric framing check). Optional — when
   * absent the gate falls back to the OCR-completeness + pixel framing heuristic.
   */
  blocks?: OcrTextBlock[];
  /** Width (px) of the OCR image the `blocks` frames are measured in. */
  imageWidth?: number;
  /** Height (px) of the OCR image the `blocks` frames are measured in. */
  imageHeight?: number;
  /**
   * The on-screen capture cutout, normalized to the SOURCE-PHOTO fractions. Required
   * (with `blocks` + dims) for the geometric framing check; absent on the gallery /
   * system-camera path, which then uses the readability/pixel fallback.
   */
  cutout?: NormalizedRect;
}

/** Raw pixel statistics from the Tier-2 decode (null when unavailable). */
export interface PixelMetrics {
  /** Mean luma across the analysis frame, 0–255. */
  meanLuma: number;
  /** Fraction (0–1) of near-white clipped pixels — proxy for specular glare. */
  clippedRatio: number;
  /** Variance of the 4-neighbour Laplacian over luma — proxy for sharpness. */
  laplacianVar: number;
  /**
   * Mean |Laplacian| within the outer border ring of the (cutout-cropped) frame.
   * High ⇒ card content/texture reaches the crop edge → the ID is cut off. Only
   * present on the Tier-2 path; used to word the `not_in_frame` reason, never to
   * reject on its own. Optional so unit tests can omit it.
   */
  borderEdge?: number;
  /**
   * Fraction (0–1) of near-flat ("background") pixels across the frame. Very high
   * ⇒ the box is mostly empty surface → the card is too small / too far. Optional.
   */
  flatRatio?: number;
}

/** OCR-derived readability signals (Tier 1). */
export interface OcrReadability {
  /** Alphanumeric characters ML Kit recovered. */
  chars: number;
  /** Count of parsed fields (name / dob / id / address / sex). */
  fields: number;
  /** A document-specific anchor (PCN, license no., MRZ…) was matched. */
  strongAnchor: boolean;
  /** Whether ML Kit ran at all. */
  ocrAvailable: boolean;
}

// ── Tier 2: optional pure-JS pixel decode ─────────────────────────────────────

interface ImageManipulatorModule {
  manipulateAsync: (
    uri: string,
    actions: Array<{ resize?: { width?: number; height?: number } }>,
    options: { compress?: number; format?: unknown; base64?: boolean },
  ) => Promise<{ uri: string; width: number; height: number; base64?: string }>;
  SaveFormat: { JPEG: unknown };
}

interface JpegDecodeResult {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, 4 bytes/px
}

interface JpegModule {
  decode: (data: Uint8Array, opts?: { useTArray?: boolean }) => JpegDecodeResult;
}

function loadManipulator(): ImageManipulatorModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-manipulator') as ImageManipulatorModule;
  } catch {
    return null;
  }
}

function loadJpeg(): JpegModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('jpeg-js') as { default?: JpegModule } & JpegModule;
    return mod.default ?? mod;
  } catch {
    // Optional dependency absent — Tier 2 silently disabled; Tier 1 still runs.
    return null;
  }
}

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode standard base64 (no data-URI prefix) to bytes — no `atob`/Buffer needed. */
function base64ToBytes(b64: string): Uint8Array {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64_CHARS.length; i += 1) {
    lookup[B64_CHARS.charCodeAt(i)] = i;
  }
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLen = Math.floor((len * 3) / 4) - pad;
  const bytes = new Uint8Array(byteLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e0 = lookup[clean.charCodeAt(i)] ?? 0;
    const e1 = lookup[clean.charCodeAt(i + 1)] ?? 0;
    const e2 = lookup[clean.charCodeAt(i + 2)] ?? 0;
    const e3 = lookup[clean.charCodeAt(i + 3)] ?? 0;
    const chunk = (e0 << 18) | (e1 << 12) | (e2 << 6) | e3;
    if (p < byteLen) bytes[p++] = (chunk >> 16) & 0xff;
    if (p < byteLen) bytes[p++] = (chunk >> 8) & 0xff;
    if (p < byteLen) bytes[p++] = chunk & 0xff;
  }
  return bytes;
}

/** Variance of the 4-neighbour Laplacian over a luma grid (sharpness proxy). */
function laplacianVariance(luma: Float64Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const c = luma[i] ?? 0;
      const lap =
        4 * c -
        (luma[i - 1] ?? 0) -
        (luma[i + 1] ?? 0) -
        (luma[i - w] ?? 0) -
        (luma[i + w] ?? 0);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Framing heuristic over a luma grid (the cutout-cropped, downscaled frame).
 * Returns:
 *   - `borderEdge`: mean |Laplacian| in the outer border ring. A well-framed card
 *     leaves a quiet margin of background just inside the box, so the ring is flat;
 *     when the card spills past the box, its content lands on the ring → high.
 *   - `flatRatio`:  fraction of near-flat pixels overall. When the card is far too
 *     small, most of the box is empty surface → very high.
 * Both are best-effort proxies (no true rectangle detection) — they only WORD the
 * `not_in_frame` reason; they never reject a capture on their own.
 */
function framingMetrics(
  luma: Float64Array,
  w: number,
  h: number,
): { borderEdge: number; flatRatio: number } {
  if (w < 5 || h < 5) return { borderEdge: 0, flatRatio: 0 };
  const bw = Math.max(1, Math.floor(w * QUALITY_THRESHOLDS.FRAME_BORDER_FRAC));
  const bh = Math.max(1, Math.floor(h * QUALITY_THRESHOLDS.FRAME_BORDER_FRAC));
  const eps = QUALITY_THRESHOLDS.FRAME_FLAT_EPS;
  let borderSum = 0;
  let borderN = 0;
  let flatN = 0;
  let totalN = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const c = luma[i] ?? 0;
      const lap = Math.abs(
        4 * c -
          (luma[i - 1] ?? 0) -
          (luma[i + 1] ?? 0) -
          (luma[i - w] ?? 0) -
          (luma[i + w] ?? 0),
      );
      totalN += 1;
      if (lap < eps) flatN += 1;
      if (x < bw || x >= w - bw || y < bh || y >= h - bh) {
        borderSum += lap;
        borderN += 1;
      }
    }
  }
  return {
    borderEdge: borderN === 0 ? 0 : borderSum / borderN,
    flatRatio: totalN === 0 ? 0 : flatN / totalN,
  };
}

/**
 * Tier-2 pixel analysis. Returns null when the optional decode path is
 * unavailable or fails — callers MUST treat null as "pixel checks skipped",
 * never as "good quality".
 */
export async function analyzePixels(imageUri: string): Promise<PixelMetrics | null> {
  const manipulator = loadManipulator();
  const jpeg = loadJpeg();
  if (!manipulator || !jpeg) return null;

  try {
    const small = await manipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: QUALITY_THRESHOLDS.ANALYSIS_DIM } }],
      {
        compress: QUALITY_THRESHOLDS.ANALYSIS_JPEG_QUALITY,
        format: manipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (!small.base64) return null;

    const decoded = jpeg.decode(base64ToBytes(small.base64), { useTArray: true });
    const { width: w, height: h, data } = decoded;
    if (w < 3 || h < 3 || data.length < w * h * 4) return null;

    const luma = new Float64Array(w * h);
    let lumaSum = 0;
    let clipped = 0;
    for (let p = 0, j = 0; j < w * h; j += 1, p += 4) {
      const r = data[p] ?? 0;
      const g = data[p + 1] ?? 0;
      const b = data[p + 2] ?? 0;
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      luma[j] = y;
      lumaSum += y;
      if (y >= 250) clipped += 1;
    }
    const count = w * h;
    const framing = framingMetrics(luma, w, h);
    return {
      meanLuma: lumaSum / count,
      clippedRatio: clipped / count,
      laplacianVar: laplacianVariance(luma, w, h),
      borderEdge: framing.borderEdge,
      flatRatio: framing.flatRatio,
    };
  } catch {
    // Decode/resize failed — degrade to Tier-1-only.
    return null;
  }
}

// ── Tier 1: OCR readability ────────────────────────────────────────────────────

/** Derive readability signals from the OCR/parser output. PII-safe (counts only). */
export function deriveReadability(input: QualityGateInput): OcrReadability {
  const chars = (input.rawText.match(/[A-Za-z0-9]/g) ?? []).length;
  const { parsed } = input;
  const fields = [
    parsed.fullName,
    parsed.birthDate,
    parsed.idNumber,
    parsed.address,
    parsed.sex,
  ].filter((f) => f !== undefined).length;
  const strongAnchor =
    parsed.documentTypeConfidence === 'high' || parsed.idNumber !== undefined;
  return { chars, fields, strongAnchor, ocrAvailable: input.ocrAvailable };
}

// ── Geometric framing (PURE — ML Kit text-block geometry vs the cutout) ─────────

/** Non-PII, user-facing one-liners for the geometric `not_in_frame` reasons. */
const FRAMING_REASON = {
  outside: 'Part of your ID is outside the box',
  offCenter: 'Move your ID to the center of the box',
  tooSmall: 'Move closer — your ID is too small in the box',
} as const;

/** Do two normalized rectangles overlap at all? */
function rectsIntersect(a: NormalizedRect, b: NormalizedRect): boolean {
  return (
    a.fx < b.fx + b.fw &&
    a.fx + a.fw > b.fx &&
    a.fy < b.fy + b.fh &&
    a.fy + a.fh > b.fy
  );
}

/**
 * PURE geometric framing evaluator. Given recognized text-block rectangles and the
 * capture cutout — BOTH in normalized [0,1] image fractions — decide whether the ID
 * is wholly inside and centred in the box. Unit-testable: feed synthetic fractions.
 *
 * Algorithm (all in fraction space, so the OCR-image resize is irrelevant):
 *  1. Consider only blocks that intersect the cutout ("belonging" text). Blocks
 *     entirely outside the box are ignored as background, so a stray logo / another
 *     document on the table cannot false-reject a well-framed ID — the ID is the
 *     dominant cluster straddling / inside the box.
 *  2. `outOfBoxSide` — the first cutout edge a belonging block crosses by more than
 *     `FRAMING_INSET_TOL` of that dimension ⇒ the card is cut off / not fully inside.
 *  3. Enclosing box of belonging text → `fillRatio` (area ÷ cutout area) and
 *     `centerOffset` (its centre vs the cutout centre, per half-extent).
 *  4. `inBox` = no edge crossing AND centred AND large enough.
 *
 * When `frames` is empty (ML Kit returned no geometry) the verdict is non-conclusive
 * (`blockCount: 0`, `inBox: false`); the `computeFraming` adapter maps that to
 * `null` so the caller falls back to the readability/pixel heuristic.
 */
export function evaluateFraming(
  frames: NormalizedRect[],
  cutout: NormalizedRect,
): FramingMetrics {
  const t = FRAMING_THRESHOLDS;
  if (frames.length === 0 || !(cutout.fw > 0) || !(cutout.fh > 0)) {
    return { fillRatio: 0, centerOffset: Infinity, outOfBoxSide: null, inBox: false, blockCount: 0 };
  }

  const belonging = frames.filter((f) => rectsIntersect(f, cutout));
  if (belonging.length === 0) {
    // Text was found, but none of it overlaps the box ⇒ the ID is outside the box.
    return { fillRatio: 0, centerOffset: Infinity, outOfBoxSide: null, inBox: false, blockCount: 0 };
  }

  const cl = cutout.fx;
  const ct = cutout.fy;
  const cr = cutout.fx + cutout.fw;
  const cb = cutout.fy + cutout.fh;
  const tolX = t.FRAMING_INSET_TOL * cutout.fw;
  const tolY = t.FRAMING_INSET_TOL * cutout.fh;

  let outOfBoxSide: FramingMetrics['outOfBoxSide'] = null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of belonging) {
    const fl = f.fx;
    const ft = f.fy;
    const fr = f.fx + f.fw;
    const fb = f.fy + f.fh;
    if (outOfBoxSide === null) {
      if (fl < cl - tolX) outOfBoxSide = 'left';
      else if (fr > cr + tolX) outOfBoxSide = 'right';
      else if (ft < ct - tolY) outOfBoxSide = 'top';
      else if (fb > cb + tolY) outOfBoxSide = 'bottom';
    }
    if (fl < minX) minX = fl;
    if (ft < minY) minY = ft;
    if (fr > maxX) maxX = fr;
    if (fb > maxY) maxY = fb;
  }

  const unionArea = (maxX - minX) * (maxY - minY);
  const fillRatio = unionArea / (cutout.fw * cutout.fh);
  const uCx = (minX + maxX) / 2;
  const uCy = (minY + maxY) / 2;
  const dx = (uCx - (cl + cutout.fw / 2)) / (cutout.fw / 2);
  const dy = (uCy - (ct + cutout.fh / 2)) / (cutout.fh / 2);
  const centerOffset = Math.hypot(dx, dy);

  const inBox =
    outOfBoxSide === null &&
    centerOffset <= t.FRAMING_MAX_CENTER_OFFSET &&
    fillRatio >= t.FRAMING_MIN_FILL;

  return { fillRatio, centerOffset, outOfBoxSide, inBox, blockCount: belonging.length };
}

/**
 * Pick the specific `not_in_frame` reason from geometric metrics. Order = most
 * precise diagnosis first: a block past an edge (cut off) → off-centre → too small.
 */
function framingReason(m: FramingMetrics): string {
  if (m.outOfBoxSide !== null) return FRAMING_REASON.outside;
  if (m.centerOffset > FRAMING_THRESHOLDS.FRAMING_MAX_CENTER_OFFSET) return FRAMING_REASON.offCenter;
  if (m.fillRatio < FRAMING_THRESHOLDS.FRAMING_MIN_FILL) return FRAMING_REASON.tooSmall;
  return FRAMING_REASON.offCenter;
}

/**
 * Adapter: build the geometric framing verdict from raw ML Kit blocks + image dims
 * + the normalized cutout. Returns null when geometry is unavailable (no cutout, no
 * dims, or no block carried a usable `frame`), signalling the caller to fall back to
 * the readability/pixel heuristic. Normalizes each pixel `frame` by the OCR-image
 * dims so it shares the cutout's fraction space.
 */
function computeFraming(input: QualityGateInput): FramingMetrics | null {
  const { blocks, imageWidth, imageHeight, cutout } = input;
  if (
    !cutout ||
    !blocks ||
    imageWidth === undefined ||
    imageHeight === undefined ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return null;
  }
  const frames: NormalizedRect[] = [];
  for (const b of blocks) {
    const f = b.frame;
    if (!f || !(f.width > 0) || !(f.height > 0)) continue;
    frames.push({
      fx: f.left / imageWidth,
      fy: f.top / imageHeight,
      fw: f.width / imageWidth,
      fh: f.height / imageHeight,
    });
  }
  if (frames.length === 0) return null; // ML Kit gave no usable geometry ⇒ fall back
  return evaluateFraming(frames, cutout);
}

// ── Verdict resolution (PURE — unit-testable, no IO) ──────────────────────────

const REASON: Record<Exclude<ImageQualityStatus, 'ok'>, string> = {
  too_dark:
    'The photo is too dark. Move to a well-lit area and avoid shadows, then retake.',
  glare:
    'There’s glare or a bright reflection on the ID. Tilt the card slightly or step away from direct light, then retake.',
  blurry:
    'The photo looks blurry. Hold the phone steady and let the camera focus before capturing.',
  not_in_frame:
    'Make sure your whole ID is inside the box — show all four edges.',
  unreadable:
    'We couldn’t read the ID clearly. Make sure the whole card fills the frame, lies flat, and is in focus.',
};

/**
 * Muted, non-PII one-liners for `not_in_frame`, refined by the optional pixel
 * framing heuristic. `generic` is used when pixel metrics are unavailable (the
 * framing call is then driven purely by OCR completeness).
 */
const NOT_IN_FRAME_REASON = {
  tooSmall: 'Move closer — your ID is too small in the frame',
  cutOff: 'Your ID is cut off at the edge',
  generic: REASON.not_in_frame,
} as const;

/**
 * Pick the `not_in_frame` reason. Pixel metrics (when present) distinguish a card
 * that is too small (lots of flat background filling the box) from one that is cut
 * off (card content reaching the crop border). With no pixels, fall back to the
 * generic "fit the whole ID in the box" line.
 */
function resolveNotInFrameReason(pixels: PixelMetrics | null): string {
  if (pixels) {
    const flat = pixels.flatRatio ?? 0;
    const border = pixels.borderEdge ?? 0;
    if (flat >= QUALITY_THRESHOLDS.FRAME_TOOSMALL_FLAT_RATIO) {
      return NOT_IN_FRAME_REASON.tooSmall;
    }
    if (border >= QUALITY_THRESHOLDS.FRAME_CUTOFF_BORDER_EDGE) {
      return NOT_IN_FRAME_REASON.cutOff;
    }
  }
  return NOT_IN_FRAME_REASON.generic;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Pure verdict resolver. Combines Tier-1 readability with optional Tier-2 pixel
 * metrics. Status priority is by ACTIONABILITY (the reason that most precisely
 * tells the user what to fix wins):
 *   too_dark > glare > blurry > not_in_frame > unreadable > ok
 *
 * Why `not_in_frame` sits below the capture-quality faults but above `unreadable`:
 * darkness / glare / blur all DEPRESS OCR completeness too (a blurry ID also yields
 * no anchor), so if any of those fire they are the root cause and their message is
 * more actionable — fix lighting/focus first. Only once the image is sharp and
 * well-lit does framing point squarely at framing, which is far more specific than
 * the generic near-zero-text `unreadable`.
 *
 * Framing authority: when `framing` is supplied (ML Kit returned text geometry) it
 * is AUTHORITATIVE — `not_in_frame` fires iff the geometry says the ID is not wholly
 * inside / centred, with a specific geometric reason; and a geometry-confirmed good
 * frame SUPPRESSES the OCR-completeness `not_in_frame` proxy (no false "fit ID in
 * box" loop for an in-frame ID). When `framing` is null the original readability +
 * pixel heuristic runs unchanged (gallery path / older devices / no geometry).
 *
 * `score` is an overall 0–1 quality confidence (1 = excellent) for an optional UI
 * indicator; the `status` is what the retake loop branches on.
 */
export function evaluateQuality(
  readability: OcrReadability,
  pixels: PixelMetrics | null,
  framing: FramingMetrics | null = null,
): QualityVerdict {
  const t = QUALITY_THRESHOLDS;
  const reasons: string[] = [];

  // ── Pixel-derived booleans (Tier 2) ──
  const tooDark = pixels !== null && pixels.meanLuma < t.DARK_MEAN_LUMA;
  const glare =
    pixels !== null &&
    (pixels.clippedRatio > t.GLARE_CLIPPED_RATIO ||
      pixels.meanLuma > t.BRIGHT_MEAN_LUMA);
  const blurryPixel =
    pixels !== null &&
    !tooDark && // a dark frame legitimately has low Laplacian variance — don't double-flag
    pixels.laplacianVar < t.BLUR_VARIANCE_MIN;

  // ── OCR-derived booleans (Tier 1) ──
  const unreadableOcr =
    readability.ocrAvailable && readability.chars < t.MIN_CHARS_UNREADABLE;
  const blurryOcr =
    readability.ocrAvailable &&
    !unreadableOcr &&
    !readability.strongAnchor &&
    readability.chars < t.MIN_CHARS_READABLE;

  // "Complete" = the parser locked onto the document (a strong anchor like a PCN /
  // licence no. / CRN / MRZ) OR pulled several fields. A genuinely full, in-frame
  // ID almost always satisfies one of these.
  const documentComplete =
    readability.strongAnchor || readability.fields >= t.MIN_FIELDS_COMPLETE;
  // not_in_frame: OCR ran and recovered a healthy amount of readable text (well
  // past both the 'unreadable' floor and the soft-focus 'blurry' band), yet the
  // parser still could not assemble a complete document → the identifying part of
  // the card is almost certainly outside the box (cut off / too small). The text
  // we DID get reads fine, so this is a framing fault, not a focus/lighting one.
  const notInFrameOcr =
    readability.ocrAvailable &&
    !unreadableOcr &&
    readability.chars >= t.MIN_CHARS_READABLE &&
    !documentComplete;

  // Framing decision: geometry is AUTHORITATIVE when present (the ID is mis-framed
  // iff `!inBox`); otherwise fall back to the OCR-completeness proxy above.
  const notInFrame = framing !== null ? !framing.inBox : notInFrameOcr;

  // ── Sub-scores (0–1) for the overall confidence number ──
  const brightnessScore =
    pixels === null
      ? 1
      : clamp01(
          Math.min(
            (pixels.meanLuma - 20) / (t.DARK_MEAN_LUMA - 20), // ramps up out of darkness
            (255 - pixels.meanLuma) / (255 - t.BRIGHT_MEAN_LUMA), // ramps down into white-out
            1,
          ),
        ) * (glare ? 0.4 : 1);
  const blurScore =
    pixels !== null
      ? clamp01(pixels.laplacianVar / (t.BLUR_VARIANCE_MIN * 2))
      : 1;
  const ocrScore = clamp01(
    readability.ocrAvailable
      ? readability.chars / (t.MIN_CHARS_READABLE * 2) +
          (readability.strongAnchor ? 0.3 : 0)
      : 1, // OCR unavailable: don't penalise (manual-entry fallback path)
  );
  const score = Number(Math.min(brightnessScore, blurScore, ocrScore).toFixed(2));

  // ── Resolve a single status by actionability priority ──
  let status: ImageQualityStatus = 'ok';
  if (tooDark) status = 'too_dark';
  else if (glare) status = 'glare';
  else if (blurryPixel || blurryOcr) status = 'blurry';
  else if (notInFrame) status = 'not_in_frame';
  else if (unreadableOcr) status = 'unreadable';

  if (status === 'not_in_frame') {
    // Geometric reason when available; otherwise the pixel/OCR-derived wording.
    reasons.push(framing !== null ? framingReason(framing) : resolveNotInFrameReason(pixels));
  } else if (status !== 'ok') {
    const reason = REASON[status];
    if (reason) reasons.push(reason);
  }
  return { status, score, reasons };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Run the full quality gate: derive OCR readability (Tier 1, always) + optional
 * pixel metrics (Tier 2, if `jpeg-js` present), then resolve a {@link QualityVerdict}.
 * Never throws — any internal failure degrades to the OCR-only verdict.
 */
export async function assessImageQuality(
  input: QualityGateInput,
): Promise<QualityVerdict> {
  const readability = deriveReadability(input);
  const pixels = await analyzePixels(input.imageUri);
  const framing = computeFraming(input);
  return evaluateQuality(readability, pixels, framing);
}
