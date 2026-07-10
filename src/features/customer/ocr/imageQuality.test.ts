/**
 * Unit tests for the PURE quality-gate resolvers `evaluateQuality` and
 * `evaluateFraming`.
 *
 * Focus: the `not_in_frame` framing status — both the legacy OCR/pixel proxy AND the
 * geometric gate (`evaluateFraming`) added for the "whole ID must be inside and
 * centred in the box" requirement. These tests construct OCR readability, pixel
 * metrics, and normalized text-block geometry directly (no IO, no native deps) so
 * they run in plain node under jest-expo.
 *
 * Reason strings are asserted as literals on purpose: they are user-facing copy
 * and a silent wording change should fail a test, not slip through.
 */

import { evaluateQuality, evaluateFraming } from './imageQuality';
import type { OcrReadability, PixelMetrics } from './imageQuality';
import type { NormalizedRect } from './types';

/** A readable, well-framed ID: plenty of text, parser locked on (strong anchor). */
const COMPLETE: OcrReadability = {
  chars: 120,
  fields: 4,
  strongAnchor: true,
  ocrAvailable: true,
};

/** Lots of readable text, but the parser found no anchor and too few fields. */
const INCOMPLETE: OcrReadability = {
  chars: 60,
  fields: 0,
  strongAnchor: false,
  ocrAvailable: true,
};

/** Neutral, sharp, well-exposed pixels (no dark/glare/blur faults). */
const CLEAN_PIXELS: PixelMetrics = {
  meanLuma: 130,
  clippedRatio: 0.01,
  laplacianVar: 240,
};

describe('evaluateQuality — not_in_frame', () => {
  it('flags readable-but-incomplete OCR as not_in_frame (no pixels)', () => {
    const v = evaluateQuality(INCOMPLETE, null);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Make sure your whole ID is inside the box — show all four edges.');
  });

  it('passes a complete, anchored ID as ok', () => {
    expect(evaluateQuality(COMPLETE, null).status).toBe('ok');
  });

  it('treats >=2 parsed fields (no anchor) as complete → ok', () => {
    const twoFields: OcrReadability = { chars: 60, fields: 2, strongAnchor: false, ocrAvailable: true };
    expect(evaluateQuality(twoFields, null).status).toBe('ok');
  });

  it('keeps near-zero text as unreadable, not not_in_frame', () => {
    const sparse: OcrReadability = { chars: 4, fields: 0, strongAnchor: false, ocrAvailable: true };
    expect(evaluateQuality(sparse, null).status).toBe('unreadable');
  });

  it('keeps soft-focus little-text as blurry, not not_in_frame', () => {
    const soft: OcrReadability = { chars: 16, fields: 0, strongAnchor: false, ocrAvailable: true };
    expect(evaluateQuality(soft, null).status).toBe('blurry');
  });

  it('words the reason as "too small" when the box is mostly flat background', () => {
    const pixels: PixelMetrics = { ...CLEAN_PIXELS, flatRatio: 0.9, borderEdge: 4 };
    const v = evaluateQuality(INCOMPLETE, pixels);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Move closer — your ID is too small in the frame');
  });

  it('words the reason as "cut off" when card content reaches the crop border', () => {
    const pixels: PixelMetrics = { ...CLEAN_PIXELS, flatRatio: 0.2, borderEdge: 40 };
    const v = evaluateQuality(INCOMPLETE, pixels);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Your ID is cut off at the edge');
  });

  it('lets a capture-quality fault (too_dark) outrank framing', () => {
    const dark: PixelMetrics = { meanLuma: 30, clippedRatio: 0, laplacianVar: 240, flatRatio: 0.9 };
    expect(evaluateQuality(INCOMPLETE, dark).status).toBe('too_dark');
  });
});

// ── Geometric framing (evaluateFraming + evaluateQuality with block geometry) ────
//
// All rects are NORMALIZED image fractions (0–1). The cutout is a centred ID-1 box
// spanning x[0.20,0.80], y[0.30,0.70] → centre (0.50,0.50), half-extents (0.30,0.20).

/** Centred ID-1 capture cutout. */
const CUTOUT: NormalizedRect = { fx: 0.2, fy: 0.3, fw: 0.6, fh: 0.4 };

/** A large, centred, fully-in-box text block (good fill, centred, no edge crossing). */
const INSIDE_BLOCK: NormalizedRect = { fx: 0.25, fy: 0.34, fw: 0.5, fh: 0.32 };

/** Same readable content as INSIDE but pushed hard to the right, still inside the box. */
const OFF_CENTER_BLOCK: NormalizedRect = { fx: 0.55, fy: 0.36, fw: 0.22, fh: 0.3 };

/** A block whose right edge spills well past the cutout's right edge (cut off). */
const EDGE_CROSS_BLOCK: NormalizedRect = { fx: 0.7, fy: 0.34, fw: 0.25, fh: 0.32 };

/** A tiny, centred block — far too little of the box is covered (ID too small/far). */
const TINY_BLOCK: NormalizedRect = { fx: 0.45, fy: 0.45, fw: 0.1, fh: 0.1 };

/** A block entirely outside the cutout (background clutter — must be ignored). */
const BACKGROUND_BLOCK: NormalizedRect = { fx: 0.0, fy: 0.0, fw: 0.1, fh: 0.05 };

describe('evaluateFraming — pure geometry', () => {
  it('marks a large, centred, in-box block as inBox with good fill', () => {
    const m = evaluateFraming([INSIDE_BLOCK], CUTOUT);
    expect(m.inBox).toBe(true);
    expect(m.outOfBoxSide).toBeNull();
    expect(m.blockCount).toBe(1);
    expect(m.fillRatio).toBeCloseTo(0.6667, 2); // 0.5*0.32 / (0.6*0.4)
    expect(m.centerOffset).toBeCloseTo(0, 5);
  });

  it('detects a block crossing the cutout edge (outOfBoxSide)', () => {
    const m = evaluateFraming([INSIDE_BLOCK, EDGE_CROSS_BLOCK], CUTOUT);
    expect(m.outOfBoxSide).toBe('right');
    expect(m.inBox).toBe(false);
  });

  it('flags an off-centre block (centerOffset over the max)', () => {
    const m = evaluateFraming([OFF_CENTER_BLOCK], CUTOUT);
    expect(m.outOfBoxSide).toBeNull();
    expect(m.centerOffset).toBeGreaterThan(0.18);
    expect(m.inBox).toBe(false);
  });

  it('flags a tiny block (fillRatio under the min)', () => {
    const m = evaluateFraming([TINY_BLOCK], CUTOUT);
    expect(m.outOfBoxSide).toBeNull();
    expect(m.fillRatio).toBeLessThan(0.5);
    expect(m.centerOffset).toBeLessThanOrEqual(0.18);
    expect(m.inBox).toBe(false);
  });

  it('ignores background blocks that do not overlap the cutout', () => {
    const m = evaluateFraming([INSIDE_BLOCK, BACKGROUND_BLOCK], CUTOUT);
    expect(m.blockCount).toBe(1); // only the in-box block counts
    expect(m.inBox).toBe(true);
  });

  it('returns a non-conclusive verdict when text is entirely outside the box', () => {
    const m = evaluateFraming([BACKGROUND_BLOCK], CUTOUT);
    expect(m.blockCount).toBe(0);
    expect(m.inBox).toBe(false);
  });

  it('returns a non-conclusive verdict when no frames are supplied', () => {
    const m = evaluateFraming([], CUTOUT);
    expect(m.blockCount).toBe(0);
    expect(m.inBox).toBe(false);
  });
});

describe('evaluateQuality — geometric not_in_frame', () => {
  it('passes a centred, fully-in-box ID as ok', () => {
    const framing = evaluateFraming([INSIDE_BLOCK], CUTOUT);
    expect(evaluateQuality(COMPLETE, null, framing).status).toBe('ok');
  });

  it('rejects an off-centre ID with the "center your ID" reason', () => {
    const framing = evaluateFraming([OFF_CENTER_BLOCK], CUTOUT);
    const v = evaluateQuality(COMPLETE, null, framing);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Move your ID to the center of the box');
  });

  it('rejects an ID cut off at an edge with the "outside the box" reason', () => {
    const framing = evaluateFraming([INSIDE_BLOCK, EDGE_CROSS_BLOCK], CUTOUT);
    const v = evaluateQuality(COMPLETE, null, framing);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Part of your ID is outside the box');
  });

  it('rejects a too-small ID with the "move closer" reason', () => {
    const framing = evaluateFraming([TINY_BLOCK], CUTOUT);
    const v = evaluateQuality(COMPLETE, null, framing);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Move closer — your ID is too small in the box');
  });

  it('rejects an ID whose text is entirely outside the box', () => {
    const framing = evaluateFraming([BACKGROUND_BLOCK], CUTOUT);
    expect(evaluateQuality(COMPLETE, null, framing).status).toBe('not_in_frame');
  });

  it('does NOT false-reject a well-framed ID just because of background text', () => {
    const framing = evaluateFraming([INSIDE_BLOCK, BACKGROUND_BLOCK], CUTOUT);
    expect(evaluateQuality(COMPLETE, null, framing).status).toBe('ok');
  });

  it('geometry is authoritative: a confirmed in-box frame suppresses the OCR proxy', () => {
    // INCOMPLETE alone → not_in_frame; with geometry confirming the ID is in-box the
    // framing fault is suppressed (no false "fit ID in box" loop for an in-frame ID).
    const framing = evaluateFraming([INSIDE_BLOCK], CUTOUT);
    expect(evaluateQuality(INCOMPLETE, null, framing).status).toBe('ok');
  });

  it('lets a capture-quality fault (too_dark) outrank a geometric framing fault', () => {
    const framing = evaluateFraming([EDGE_CROSS_BLOCK], CUTOUT);
    const dark: PixelMetrics = { meanLuma: 30, clippedRatio: 0, laplacianVar: 240 };
    expect(evaluateQuality(COMPLETE, dark, framing).status).toBe('too_dark');
  });

  it('falls back to the OCR proxy when geometry is unavailable (framing null)', () => {
    const v = evaluateQuality(INCOMPLETE, null, null);
    expect(v.status).toBe('not_in_frame');
    expect(v.reasons[0]).toBe('Make sure your whole ID is inside the box — show all four edges.');
  });
});
