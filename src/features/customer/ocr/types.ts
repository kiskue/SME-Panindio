/**
 * OCR — Types (Suki Customer Identity Verification)
 * =================================================
 * Shared, framework-agnostic types for the Philippine government-ID OCR pipeline.
 *
 * The pipeline is: Capture -> Pre-process -> ML Kit text recognition -> Parse
 * (this module's `IdParser`) -> auto-fill editable fields -> user verification
 * -> submit.
 *
 * PII NOTE: none of these structures should ever be logged to analytics or the
 * console in production. The raw text is retained only to be forwarded to the
 * backend at submission time (so the server can re-parse / audit), never persisted
 * locally beyond the lifetime of the screen.
 */

/** Supported Philippine government document types (plus a generic fallback). */
export type PhDocumentType =
  | 'PHILSYS_ID' // PhilSys / PhilID national ID (PCN)
  | 'DRIVERS_LICENSE' // LTO Driver's License
  | 'SSS_UMID' // SSS / UMID card (CRN)
  | 'PASSPORT' // DFA passport (MRZ)
  | 'PHILHEALTH' // PhilHealth ID (PIN)
  | 'GENERIC_ID'; // Unrecognized / other government ID

/** Biological sex as printed on most PH government IDs. */
export type IdSex = 'MALE' | 'FEMALE';

/**
 * Per-field confidence band. We deliberately keep this coarse (not a 0–1 float)
 * because ML Kit's block-level confidence is unreliable for parsing accuracy.
 * `high`   — matched a strong, document-specific anchor (e.g. PCN format).
 * `medium` — matched a labelled field ("Last Name:", "Birthdate:").
 * `low`    — heuristic / positional guess; always prompt the user to verify.
 */
export type FieldConfidence = 'high' | 'medium' | 'low';

/** A single parsed value plus how confident the parser is about it. */
export interface ParsedField<T = string> {
  value: T;
  confidence: FieldConfidence;
}

/**
 * Structured result of parsing recognized ID text. Every field is optional
 * because any given capture may be partial / unreadable; the UI auto-fills only
 * the fields that were found and leaves the rest for manual entry.
 */
export interface ParsedIdResult {
  /** Detected document type used to pick the parsing strategy. */
  documentType: PhDocumentType;
  /** How the document type was detected (used for the "low confidence" hint). */
  documentTypeConfidence: FieldConfidence;
  fullName?: ParsedField;
  /** Normalized to ISO `YYYY-MM-DD` when parseable; otherwise the raw match. */
  birthDate?: ParsedField;
  /** Primary ID number for the detected document type (PCN, license no., CRN…). */
  idNumber?: ParsedField;
  address?: ParsedField;
  sex?: ParsedField<IdSex>;
}

/**
 * Outcome of the on-device image-quality gate that runs BEFORE auto-fill.
 * `ok`         — capture is usable; proceed to verify/auto-fill.
 * `blurry`     — soft focus / motion blur (pixel Laplacian low OR OCR recovered
 *                little readable text). Prompt retake.
 * `too_dark`   — under-exposed (mean luma below threshold). Prompt retake.
 * `glare`      — specular reflection / wash-out (clipped highlights). Prompt retake.
 * `not_in_frame` — the ID is not wholly inside / centred in the capture box. When
 *                ML Kit returns text-block geometry this is decided GEOMETRICALLY
 *                (a block crosses the box edge, the text is off-centre, or the text
 *                fills too little of the box — see {@link FramingMetrics}). When no
 *                geometry is available it falls back to the OCR-completeness proxy:
 *                a meaningful amount of readable text but no document anchor and too
 *                few fields ⇒ a chunk of the card is almost certainly outside the
 *                box. Distinct from `unreadable` (near-zero text) and `blurry` (soft
 *                focus): here the text that IS visible reads fine, but part of the
 *                document is outside / off-centre in the frame.
 * `unreadable` — OCR ran but recovered almost no text and no document anchor
 *                (wrong card, hand covering, too far). Prompt retake.
 */
export type ImageQualityStatus =
  | 'ok'
  | 'blurry'
  | 'too_dark'
  | 'glare'
  | 'not_in_frame'
  | 'unreadable';

/**
 * Verdict from the quality gate. `reasons` are generic, user-safe strings (NO
 * PII / card data) the UI can show directly on a retake prompt.
 */
export interface QualityVerdict {
  /** Single, actionability-ranked status the retake loop branches on. */
  status: ImageQualityStatus;
  /** Overall quality confidence, 0–1 (1 = excellent). For an optional UI meter. */
  score: number;
  /** Human-readable, non-PII guidance (empty when `status === 'ok'`). */
  reasons: string[];
}

/**
 * A rectangle expressed in NORMALIZED image fractions (0–1) of the image it was
 * measured against. Working in fraction space lets the framing geometry ignore the
 * OCR-image resize: the preprocessed text frames (normalized by their own pixel
 * dims) and the capture cutout (normalized by the source-photo dims) share the same
 * [0,1]×[0,1] coordinate system because pre-processing preserves the aspect ratio.
 * `fx/fy` = top-left corner; `fw/fh` = size — all as fractions of the image.
 */
export interface NormalizedRect {
  /** Left edge, fraction of image width (0–1). */
  fx: number;
  /** Top edge, fraction of image height (0–1). */
  fy: number;
  /** Width, fraction of image width (0–1). */
  fw: number;
  /** Height, fraction of image height (0–1). */
  fh: number;
}

/**
 * Geometric framing metrics derived from ML Kit text-block bounding boxes vs the
 * capture cutout — the REAL "is the whole ID inside and centred" signal. Every
 * value is a unit-less fraction/ratio or a count (NO PII; coordinates + counts
 * only, never card text).
 *
 *   fillRatio    — enclosing box of in-cutout text ÷ cutout area. Low ⇒ the ID is
 *                  too small / too far in the box ("move closer").
 *   centerOffset — normalized distance from that enclosing box's centre to the
 *                  cutout centre (1.0 = a full cutout half-extent away). High ⇒ the
 *                  ID is off-centre.
 *   outOfBoxSide — the first cutout edge a text block crosses beyond the inset
 *                  tolerance, or null when all text is comfortably inside. Non-null
 *                  ⇒ the ID is cut off / not wholly inside the box.
 *   inBox        — convenience verdict: geometry was conclusive AND the ID is
 *                  acceptably framed (no edge crossing, centred, large enough).
 *   blockCount   — number of in-cutout text blocks considered (non-PII count).
 */
export interface FramingMetrics {
  fillRatio: number;
  centerOffset: number;
  outOfBoxSide: 'left' | 'right' | 'top' | 'bottom' | null;
  inBox: boolean;
  blockCount: number;
}

/** Result of the on-device OCR run (recognition + parse + quality gate). */
export interface IdOcrResult {
  /** Local URI of the image actually sent to OCR (post pre-processing). */
  imageUri: string;
  /**
   * Raw recognized text. Kept ONLY for submission to the backend. Never log this.
   * Empty string when the native OCR module is unavailable.
   */
  rawText: string;
  /** Structured fields parsed from `rawText`. */
  parsed: ParsedIdResult;
  /** True when the on-device ML Kit module ran; false = manual-entry fallback. */
  ocrAvailable: boolean;
  /** Image-quality verdict; drives the retake loop before the verify screen. */
  quality: QualityVerdict;
}

// NOTE: `ImageQualityStatus` and `QualityVerdict` (above) are consumed by
// `imageQuality.ts` and `useIdOcr.ts`. If your editor flags them as "not
// exported", restart the TS server / revert this tab — they are exported here.

/** Status of the OCR runner hook for driving UI state. */
export type IdOcrStatus =
  | 'idle'
  | 'capturing'
  | 'processing' // pre-processing + recognition + parsing + quality gate
  | 'low_quality' // finished, but the quality gate failed — UI should offer retake
  | 'done'
  | 'error';
