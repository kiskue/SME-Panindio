/**
 * OCR feature barrel (Suki customer identity verification).
 *
 * Import from `@/features/customer/ocr` rather than reaching into individual
 * files. Exposes the runner hook, the pure parser (for tests / re-parse), the
 * pre-processor, and all shared types.
 */
export { useIdOcr } from './useIdOcr';
export type { UseIdOcrResult } from './useIdOcr';

export { IdCameraOverlay } from './IdCameraOverlay';
export type { IdCameraOverlayProps } from './IdCameraOverlay';

export { parseIdText, parseBirthDate, detectDocumentType } from './parser';
export { preprocessIdImage } from './imagePreprocess';
export type { PreprocessResult } from './imagePreprocess';

export {
  assessImageQuality,
  evaluateQuality,
  evaluateFraming,
  deriveReadability,
  analyzePixels,
  QUALITY_THRESHOLDS,
  FRAMING_THRESHOLDS,
} from './imageQuality';
export type {
  QualityGateInput,
  PixelMetrics,
  OcrReadability,
  OcrTextBlock,
} from './imageQuality';

export type {
  PhDocumentType,
  IdSex,
  FieldConfidence,
  ParsedField,
  ParsedIdResult,
  IdOcrResult,
  IdOcrStatus,
  ImageQualityStatus,
  QualityVerdict,
  NormalizedRect,
  FramingMetrics,
} from './types';
