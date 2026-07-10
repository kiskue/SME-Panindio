/**
 * OCR — Philippine ID Parser (pure, side-effect free, unit-testable)
 * ==================================================================
 * Takes raw recognized text from ML Kit and extracts structured KYC fields.
 *
 * Design goals:
 *  - PURE: no React, no IO, no logging. `parseIdText(raw)` in -> result out.
 *    This is what makes it testable in isolation (see parser.test.ts).
 *  - Strategy per document type: we first DETECT the document type from strong
 *    anchors, then run a type-specific extractor. A generic extractor handles
 *    unrecognized IDs so the user still gets best-effort auto-fill.
 *  - Tolerant: OCR text is noisy (line breaks, OCR'd "0"/"O", stray punctuation).
 *    We normalize aggressively before matching and prefer labelled fields over
 *    positional guesses. OCR digit<->letter confusables are corrected ONLY in
 *    the right context (letters in names, digits in numbers/dates) so a real
 *    name is never corrupted and a real number stays digit-accurate.
 *
 * Supported layouts:
 *  - PhilSys / PhilID  : PCN `nnnn-nnnn-nnnn-nnnn`, labelled Last/Given/Middle,
 *                        "Date of Birth", "Sex", "Address". Bilingual slash labels.
 *  - Driver's License  : License No. `Xnn-nn-nnnnnn`, "Last Name, First Name…",
 *                        "Nationality", "Sex", "Date of Birth", "Address".
 *  - SSS / UMID        : CRN `nnnn-nnnnnnn-n`, "SURNAME / GIVEN NAME".
 *  - Passport          : MRZ (two `P<` lines) -> name + passport no. + DOB + sex.
 *  - PhilHealth        : PIN `nn-nnnnnnnnnn-n`.
 *
 * PII NOTE: never log the input or output of this module.
 */

import type {
  FieldConfidence,
  IdSex,
  ParsedField,
  ParsedIdResult,
  PhDocumentType,
} from './types';

// ── Regex anchors (document-number formats) ─────────────────────────────────
// PhilSys Card Number (PCN): 16 digits in 4-4-4-4 groups.
const PCN_REGEX = /\b(\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4})\b/;
// Driver's License number: 1 letter + 2 digits, then 2 digits, then 6 digits.
const DL_REGEX = /\b([A-Z]\d{2}[-\s]?\d{2}[-\s]?\d{6})\b/;
// SSS / UMID Common Reference Number (CRN): 4-7-1 digits.
const CRN_REGEX = /\b(\d{4}[-\s]\d{7}[-\s]\d)\b/;
// PhilHealth Identification Number (PIN): 2-9-1 digits.
const PHILHEALTH_REGEX = /\b(\d{2}[-\s]\d{9}[-\s]\d)\b/;

// ── OCR confusable correction ───────────────────────────────────────────────
// Names never legitimately contain digits, so a digit inside an alpha-dominant
// token is OCR noise -> map it back to its look-alike letter.
const DIGIT_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B' };

/**
 * Correct OCR digit->letter confusions inside a single NAME token, but only when
 * the token is alphabetic-dominant (more letters than digits). A mostly-numeric
 * token is left alone (it will be stripped by cleanName), and a pure-letter token
 * is untouched — so real names keep their letters and numbers keep their digits.
 */
function correctNameConfusables(token: string): string {
  const letters = (token.match(/[A-Za-zÑñ]/g) ?? []).length;
  const digits = (token.match(/[0-9]/g) ?? []).length;
  if (letters === 0 || digits === 0) return token;
  if (digits > letters) return token;
  return token.replace(/[0158]/g, (d) => DIGIT_TO_LETTER[d] ?? d);
}

/**
 * Normalize OCR letter->digit confusions in NUMERIC context. Applied per
 * whitespace token, and only to tokens that already contain a digit and are
 * otherwise made up of digits / common separators / digit-confusable letters —
 * so month names (JAN/OCT) and real words are never touched.
 */
function normalizeNumericContext(text: string): string {
  // `text` is upper-cased by the caller, so the confusable class is uppercase.
  return text.replace(/\S+/g, (tok) => {
    if (!/[0-9]/.test(tok)) return tok;
    if (!/^[0-9OILSB.,/:-]+$/.test(tok)) return tok;
    return tok
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');
  });
}

/** Map confusable letters to digits inside an already-matched numeric group. */
function normalizeDigits(group: string): string {
  return group
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

// ── Date parsing ────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

// "01 JAN 1990", "JANUARY 01, 1990", "01-JAN-1990"
const DATE_TEXT_REGEX =
  /(\d{1,2})[\s./-]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s,./-]*(\d{4})/gi;
// "JANUARY 01, 1990" (month-first)
const DATE_MONTH_FIRST_REGEX =
  /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s,./-]*(\d{1,2})[\s,./-]*(\d{4})/gi;
// "1990-01-01" / "1990/01/01" / "1990 01 01" (whitespace separators tolerated)
const DATE_ISO_REGEX = /\b(\d{4})[-/\s](\d{2})[-/\s](\d{2})\b/g;
// "01/01/1990" / "01-01-1990" (assumed MM/DD/YYYY, common on PH IDs)
const DATE_NUMERIC_REGEX = /\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b/g;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Two-digit zero-pad. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Normalize a single ID-number match: uppercase, collapse internal whitespace
 * runs to a single hyphen so spaced/hyphenated OCR variants converge.
 */
function normalizeIdNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Find a grouped numeric ID (PCN/CRN/PIN) tolerant of OCR digit-confusables and
 * missing/variable separators, then REFORMAT to the canonical hyphen-grouped
 * form (e.g. PCN 4-4-4-4, CRN 4-7-1, PIN 2-9-1). Returns null when no run of the
 * right shape is present.
 */
function findGroupedNumericId(text: string, groups: number[]): string | null {
  const totalDigits = groups.reduce((a, b) => a + b, 0);
  const digit = '[0-9OoIlSsBb]';
  const sep = '[-\\s]*';
  const pattern = new RegExp(
    `(?<![0-9OoIlSsBb])${groups.map((g) => `(${digit}{${g}})`).join(sep)}(?![0-9OoIlSsBb])`,
    'g',
  );
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = pattern.exec(text)) !== null) {
    const normalized = m.slice(1).map(normalizeDigits);
    if (
      normalized.every((g) => /^[0-9]+$/.test(g)) &&
      normalized.join('').length === totalDigits
    ) {
      return normalized.join('-');
    }
  }
  return null;
}

/**
 * Attempt to parse a birth date out of arbitrary text into ISO `YYYY-MM-DD`.
 * Returns the first IN-BOUNDS ISO string, or null. OCR letter->digit confusions
 * are normalized in numeric context first, and EVERY match of each pattern is
 * tried so a leading out-of-range date (e.g. a future expiry) can't short-circuit
 * a valid birth date further along. Year is sanity-bounded to a plausible window.
 */
export function parseBirthDate(text: string): string | null {
  const isoBounds = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    if (y < 1900 || y > new Date().getFullYear()) return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  };

  const t = normalizeNumericContext(text.toUpperCase());

  for (const dm of t.matchAll(DATE_TEXT_REGEX)) {
    // day-first: (day)(MONTH)(year)
    const iso = isoBounds(Number(dm[3]), MONTHS[(dm[2] ?? '').slice(0, 3)] ?? 0, Number(dm[1]));
    if (iso) return iso;
  }

  for (const mf of t.matchAll(DATE_MONTH_FIRST_REGEX)) {
    // month-first: (MONTH)(day)(year)
    const iso = isoBounds(Number(mf[3]), MONTHS[(mf[1] ?? '').slice(0, 3)] ?? 0, Number(mf[2]));
    if (iso) return iso;
  }

  for (const im of t.matchAll(DATE_ISO_REGEX)) {
    const iso = isoBounds(Number(im[1]), Number(im[2]), Number(im[3]));
    if (iso) return iso;
  }

  for (const nm of t.matchAll(DATE_NUMERIC_REGEX)) {
    // PH IDs print MM/DD/YYYY; if the first group is > 12 it's clearly DD/MM.
    const a = Number(nm[1]);
    const b = Number(nm[2]);
    const year = Number(nm[3]);
    const [mon, day] = a > 12 ? [b, a] : [a, b];
    const iso = isoBounds(year, mon, day);
    if (iso) return iso;
  }

  return null;
}

/** Split raw OCR text into trimmed, non-empty lines. */
function toLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ── Label classifiers ────────────────────────────────────────────────────────
// A label line may carry a bilingual remainder ("Apelyido/Last Name") and an
// optional trailing delimiter. These builders make the label regexes tolerant of
// both while still anchoring so a value never leaks into a captured label.

/** `^Label[/Bilingual]<delim> value$` — value printed AFTER the label inline. */
function afterLabelRe(labels: string[]): RegExp {
  return new RegExp(
    `^(?:${labels.join('|')})(?:\\s*/\\s*[A-Za-zÑñ ]+)?\\s*[:.=\\-]\\s*(.+)$`,
    'i',
  );
}

/** `^Label[/Bilingual]$` — a label-only line (value sits on an adjacent line). */
function belowLabelRe(labels: string[]): RegExp {
  return new RegExp(
    `^(?:${labels.join('|')})(?:\\s*/\\s*[A-Za-zÑñ ]+)?\\s*[:.]?\\s*$`,
    'i',
  );
}

// Name-part label tokens (used both for capture and orientation detection).
const LAST_LABELS = ['Last\\s*Name', 'Apelyido', 'Surname'];
const GIVEN_LABELS = ['Given\\s*Names?', 'First\\s*Name', 'Mga\\s*Pangalan', 'Pangalan'];
const MIDDLE_LABELS = ['Middle\\s*Name', 'Gitnang\\s*Apelyido'];

// Any standalone field label (name parts + the other stacked fields). Used to
// detect contiguous label RUNS and reordered value/label orientations.
const STANDALONE_LABEL_TOKENS = [
  'LAST\\s*NAME', 'FIRST\\s*NAME', 'GIVEN\\s*NAMES?', 'MIDDLE\\s*NAME', 'SUFFIX',
  'SURNAME', 'GITNANG\\s*APELYIDO', 'APELYIDO', 'MGA\\s*PANGALAN', 'PANGALAN',
  'DATE\\s*OF\\s*BIRTH', 'BIRTH\\s*DATE', 'BIRTHDATE', 'PETSA\\s*NG\\s*KAPANGANAKAN', 'DOB',
  'SEX', 'KASARIAN', 'GENDER', 'NATIONALITY',
  'ADDRESS', 'TIRAHAN', 'PLACE\\s*OF\\s*BIRTH', 'LUGAR\\s*NG\\s*KAPANGANAKAN',
];
const STANDALONE_LABEL_RE = belowLabelRe(STANDALONE_LABEL_TOKENS);
const NAME_LABEL_RE = belowLabelRe([...LAST_LABELS, ...GIVEN_LABELS, ...MIDDLE_LABELS]);

/** True when the whole line is essentially a single known field label. */
function isStandaloneFieldLabel(line: string): boolean {
  return STANDALONE_LABEL_RE.test(line.trim());
}

/** True when the whole line is essentially a name-part label. */
function isNameLabel(line: string): boolean {
  return NAME_LABEL_RE.test(line.trim());
}

/** Find the value printed on the same line after a label like "Last Name: X". */
function valueAfterLabel(lines: string[], labels: string[]): string | null {
  const labelRe = afterLabelRe(labels);
  for (const line of lines) {
    const m = labelRe.exec(line);
    if (m?.[1] && m[1].trim().length > 0) return m[1].trim();
  }
  return null;
}

/**
 * Find the line directly BELOW a label-only line. Rejects a candidate that is
 * itself another field label so a label can never be returned as a value (the
 * stacked-column failure mode).
 */
function valueBelowLabel(lines: string[], labels: string[]): string | null {
  const labelRe = belowLabelRe(labels);
  for (let i = 0; i < lines.length - 1; i += 1) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (
      cur && next && labelRe.test(cur) &&
      next.trim().length > 0 && !isStandaloneFieldLabel(next)
    ) {
      return next.trim();
    }
  }
  return null;
}

/** Clean a name token: correct OCR confusables, strip stray symbols, trim ends. */
function cleanName(value: string): string {
  const corrected = value
    .split(/\s+/)
    .map(correctNameConfusables)
    .join(' ');
  return corrected
    .replace(/[^A-Za-zÑñ.,\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.,\-\s]+|[.,\-\s]+$/g, '')
    .trim();
}

/** Cut a single-Name value at the first inline label token bleeding into it. */
function truncateAtInlineLabel(value: string): string {
  return value
    .replace(
      /\s+(?:SEX|GENDER|KASARIAN|DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|BIRTHDATE|PETSA\s*NG\s*KAPANGANAKAN|ADDRESS|TIRAHAN)\b[\s\S]*$/i,
      '',
    )
    .trim();
}

/** Parse a sex token (lone M/F or full word) into the canonical value. */
function parseSexToken(text: string): IdSex | null {
  const m = /\b(MALE|FEMALE|M|F)\b/i.exec(text.trim());
  if (!m?.[1]) return null;
  const v = m[1].toUpperCase();
  if (v === 'MALE' || v === 'M') return 'MALE';
  if (v === 'FEMALE' || v === 'F') return 'FEMALE';
  return null;
}

/**
 * Extract sex from a column VALUE row. Parenthetical units ("(m)", "(kg)") are
 * dropped first so the lone "m" in "Height(m)" is never mistaken for "MALE".
 */
function sexFromRow(row: string): IdSex | null {
  const cleaned = row.replace(/\([^)]*\)/g, ' ');
  const full = /\b(MALE|FEMALE)\b/i.exec(cleaned);
  if (full?.[1]) return full[1].toUpperCase() === 'MALE' ? 'MALE' : 'FEMALE';
  const lone = /\b([MF])\b/i.exec(cleaned);
  if (lone?.[1]) return lone[1].toUpperCase() === 'M' ? 'MALE' : 'FEMALE';
  return null;
}

function field<T>(value: T, confidence: FieldConfidence): ParsedField<T> {
  return { value, confidence };
}

// ── Document-type detection ─────────────────────────────────────────────────

/**
 * Detect the document type from strong anchors in the raw text. Returns the type
 * plus how confident we are (drives the "please confirm document type" hint).
 */
export function detectDocumentType(raw: string): {
  type: PhDocumentType;
  confidence: FieldConfidence;
} {
  const t = raw.toUpperCase();

  // Passport MRZ: a "P<PHL" (or OCR-noised F</PK/digit country) lead, the visible
  // PASSPORT keyword (tolerating O->0), or the bilingual republic+passport header.
  const mrzAnchor = /\b[PF][<K][A-Z0-9]{3}/.test(t);
  if (mrzAnchor || /PASSP[O0]RT/.test(t) || /REPUBLIC OF THE PHILIPPINES.*PASSPORT/s.test(t)) {
    return { type: 'PASSPORT', confidence: mrzAnchor ? 'high' : 'medium' };
  }
  if (/PHILSYS|PAMBANSANG PAGKAKAKILANLAN|PHILIPPINE IDENTIFICATION/.test(t) || PCN_REGEX.test(t)) {
    return { type: 'PHILSYS_ID', confidence: PCN_REGEX.test(t) ? 'high' : 'medium' };
  }
  if (/DRIVER.?S? LICENSE|LAND TRANSPORTATION|LTO|\bDL\b/.test(t) || DL_REGEX.test(t)) {
    return { type: 'DRIVERS_LICENSE', confidence: DL_REGEX.test(t) ? 'high' : 'medium' };
  }
  if (/\bUMID\b|SOCIAL SECURITY|\bSSS\b|GSIS|COMMON REFERENCE/.test(t) || CRN_REGEX.test(t)) {
    return { type: 'SSS_UMID', confidence: CRN_REGEX.test(t) ? 'high' : 'medium' };
  }
  if (/PHILHEALTH|PHILIPPINE HEALTH INSURANCE/.test(t) || PHILHEALTH_REGEX.test(t)) {
    return { type: 'PHILHEALTH', confidence: PHILHEALTH_REGEX.test(t) ? 'high' : 'medium' };
  }
  return { type: 'GENERIC_ID', confidence: 'low' };
}

// ── Name extractors ──────────────────────────────────────────────────────────

/**
 * Extract a name from the COMBINED-header layout, where one printed line lists
 * all name parts and the value is a single comma-separated string. The value may
 * sit INLINE after the labels (OCR merge), on the NEXT line (normal), or on the
 * PREVIOUS line (reordered blocks):
 *
 *   Last Name, First Name, Middle Name     <- combined label (header)
 *   DELA CRUZ, JUAN, SANTOS                <- value: LAST, FIRST, MIDDLE
 */
function extractCombinedHeaderName(lines: string[]): ParsedField | undefined {
  const isCombinedHeader = (line: string): boolean => {
    const u = line.toUpperCase();
    return /LAST\s*NAME/.test(u) && /FIRST\s*NAME/.test(u);
  };
  // Strip the "Last Name, First Name, Middle Name" prefix to expose an inline value.
  const labelPrefix =
    /^(?:LAST\s*NAME|APELYIDO|SURNAME)\s*,?\s*(?:FIRST\s*NAME|GIVEN\s*NAMES?)\s*,?\s*(?:MIDDLE\s*NAME)?\s*,?\s*/i;

  const parseValue = (value: string): ParsedField | undefined => {
    const parts = value.split(',').map((p) => cleanName(p)).filter(Boolean);
    if (parts.length < 2) return undefined;
    const last = parts[0];
    const givenMiddle = parts.slice(1).join(' ').trim();
    if (!last || !givenMiddle) return undefined;
    return field(`${last}, ${givenMiddle}`, 'medium');
  };

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i];
    if (!header || !isCombinedHeader(header)) continue;

    const inline = header.replace(labelPrefix, '').trim();
    const candidates = [
      inline && inline !== header ? inline : '',
      lines[i + 1] ?? '',
      lines[i - 1] ?? '',
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const parsed = parseValue(candidate);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

/** Is this line a plausible NAME value (not a label / ID / date / empty)? */
function isNameValueCandidate(line: string | undefined): line is string {
  if (!line) return false;
  const t = line.trim();
  if (t.length === 0) return false;
  if (isStandaloneFieldLabel(t)) return false;
  if (isIdNumberLine(t)) return false;
  if (parseBirthDate(t) !== null) return false;
  return /[A-Za-zÑñ]/.test(t);
}

/** Looks like a real name value (>= 2 contiguous letters somewhere). */
function isNameLike(line: string | undefined): line is string {
  return !!line && /[A-Za-zÑñ]{2,}/.test(line) && parseBirthDate(line) === null;
}

/** Decide whether name values are printed ABOVE their labels (reordered blocks). */
function nameOrientation(lines: string[]): 'above' | 'below' {
  const idxs: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isNameLabel(lines[i] ?? '')) idxs.push(i);
  }
  if (idxs.length === 0) return 'below';
  const first = idxs[0] ?? 0;
  const last = idxs[idxs.length - 1] ?? 0;
  const valueAbove = isNameValueCandidate(lines[first - 1]);
  const valueBelow = isNameValueCandidate(lines[last + 1]);
  return valueAbove && !valueBelow ? 'above' : 'below';
}

/** Collect a contiguous block of value lines (stops at a label / ID / bound). */
function collectValueBlock(lines: string[], start: number, dir: 1 | -1): string[] {
  const out: string[] = [];
  for (let j = start; j >= 0 && j < lines.length; j += dir) {
    const l = lines[j];
    if (!l || isStandaloneFieldLabel(l) || isIdNumberLine(l)) break;
    out.push(l.trim());
  }
  return dir < 0 ? out.reverse() : out;
}

/**
 * Resolve a single name role (last / given / middle) from its label, handling:
 *  - a contiguous RUN of stacked labels (values stacked above OR below, mapped
 *    positionally), and
 *  - the single-label case with orientation (value below normally, value above
 *    in reordered layouts).
 */
function resolveLabelledNameValue(lines: string[], labels: string[]): string | null {
  const labelRe = belowLabelRe(labels);
  const orientation = nameOrientation(lines);

  for (let i = 0; i < lines.length; i += 1) {
    if (!labelRe.test(lines[i] ?? '')) continue;

    // Contiguous run of >=2 standalone labels -> values are a block above/below.
    let runStart = i;
    while (runStart - 1 >= 0 && isStandaloneFieldLabel(lines[runStart - 1] ?? '')) runStart -= 1;
    let runEnd = i;
    while (runEnd + 1 < lines.length && isStandaloneFieldLabel(lines[runEnd + 1] ?? '')) runEnd += 1;
    const runLen = runEnd - runStart + 1;

    if (runLen >= 2) {
      const offset = i - runStart;
      const fwd = collectValueBlock(lines, runEnd + 1, 1);
      if (fwd.length >= runLen && isNameLike(fwd[offset])) return fwd[offset] ?? null;
      const bwd = collectValueBlock(lines, runStart - 1, -1);
      if (bwd.length >= runLen && isNameLike(bwd[offset])) return bwd[offset] ?? null;
    }

    // Single label: prefer the orientation-appropriate neighbour, else the other.
    const below = lines[i + 1];
    const above = lines[i - 1];
    if (orientation === 'above') {
      if (isNameValueCandidate(above)) return above.trim();
      if (isNameValueCandidate(below)) return below.trim();
    } else {
      if (isNameValueCandidate(below)) return below.trim();
      if (isNameValueCandidate(above)) return above.trim();
    }
  }
  return null;
}

/** Resolve a role inline first (highest confidence), then by stacking/orientation. */
function resolveNameRole(lines: string[], labels: string[]): string | null {
  return valueAfterLabel(lines, labels) ?? resolveLabelledNameValue(lines, labels);
}

/** Extract a "Last, Given Middle" full name from labelled fields when present. */
function extractLabelledName(lines: string[]): ParsedField | undefined {
  const last = resolveNameRole(lines, LAST_LABELS);
  const given = resolveNameRole(lines, GIVEN_LABELS);
  const middle = resolveNameRole(lines, MIDDLE_LABELS);

  if (last || given) {
    const parts = [cleanName(last ?? ''), cleanName(given ?? ''), cleanName(middle ?? '')].filter(Boolean);
    const givenMiddle = [given, middle]
      .filter((v): v is string => Boolean(v))
      .map(cleanName)
      .filter(Boolean)
      .join(' ');
    const composed =
      last && (given || middle) ? `${cleanName(last)}, ${givenMiddle}`.trim() : parts.join(' ');
    if (composed) return field(composed, 'medium');
  }

  // Single labelled "Name:" / "Pangalan" line (inline OR value below).
  const single =
    valueAfterLabel(lines, ['Name', 'Pangalan']) ?? valueBelowLabel(lines, ['Name', 'Pangalan']);
  if (single) {
    const cleaned = cleanName(truncateAtInlineLabel(single));
    if (cleaned) return field(cleaned, 'medium');
  }
  return undefined;
}

// ── Line classifiers (used to keep fields from cross-contaminating) ──────────

// License-number HEADER label, tolerant of OCR variants and the Tagalog
// "Lisensya" form so a residual license label is never appended to an address.
const LICENSE_LABEL_REGEX =
  /\b(?:(?:DRIVER'?S?\s*)?(?:LICEN[CS]E|LIC\.?|DL)\s*(?:NO\.?|N0\.?|NUMBER|#)|LISENSYA)\b/i;

// Field-label words that mark a NEW section (address collection stops here).
const FIELD_LABEL_REGEX =
  /\b(?:LAST\s*NAME|FIRST\s*NAME|GIVEN\s*NAMES?|MIDDLE\s*NAME|NATIONALITY|SEX|GENDER|KASARIAN|DATE\s*OF\s*BIRTH|BIRTH\s*DATE|PETSA\s*NG\s*KAPANGANAKAN|\bDOB\b|WEIGHT|HEIGHT|TIMBANG|EXPIRATION|EXPIRY|VALID\s*UNTIL|AGENCY\s*CODE|BLOOD\s*TYPE|EYES?\s*COLOR|RESTRICTIONS?|CONDITIONS?|APELYIDO|GITNANG)\b/i;

// A trailing run that must never survive in an address value.
const ADDRESS_TAIL_NOISE_REGEX = new RegExp(
  `\\s*[,;]?\\s*(?:${LICENSE_LABEL_REGEX.source}` +
    `|EXPIRATION(?:\\s*DATE)?|EXPIRY(?:\\s*DATE)?|VALID\\s*UNTIL` +
    `|AGENCY\\s*CODE|${DL_REGEX.source})[\\s\\S]*$`,
  'i',
);

/** True when the line is a field-label / column-header row (not a value). */
function isLabelLine(line: string): boolean {
  return FIELD_LABEL_REGEX.test(line) || LICENSE_LABEL_REGEX.test(line);
}

/** True when the line contains/IS a parseable date — used to reject date rows. */
function isDateLine(line: string): boolean {
  return parseBirthDate(line) !== null;
}

/** True when the line contains a recognised ID/license/reference number. */
function isIdNumberLine(line: string): boolean {
  const u = line.toUpperCase();
  return (
    DL_REGEX.test(u) || PCN_REGEX.test(u) || CRN_REGEX.test(u) || PHILHEALTH_REGEX.test(u)
  );
}

const STREET_SUFFIX_REGEX =
  /\b(?:ST|AVE|RD|BLVD|HWY|DR|LN|STREET|AVENUE|ROAD|BOULEVARD|HIGHWAY|DRIVE|LANE)\b\.?/i;

/**
 * Strip a trailing license-no / expiration / agency / DL-number run from an
 * address candidate. Collapses leftover whitespace/punctuation.
 */
function stripAddressTailNoise(value: string): string {
  return value
    .replace(ADDRESS_TAIL_NOISE_REGEX, '')
    .replace(/[\s,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decide whether a line is plausible ADDRESS text.
 *  - `strict` (first line under the label / inline value): require >=2 alphabetic
 *    words OR a legit short street line (leading number + street suffix + a name).
 *  - non-strict (a wrapped continuation): require >=1 alphabetic word.
 * Dates, label headers and ID-number rows are always rejected.
 */
function isAddressLine(line: string, strict: boolean): boolean {
  const t = line.trim();
  if (t.length < 4) return false;
  if (isDateLine(t) || isLabelLine(t) || isIdNumberLine(t)) return false;
  const words = t.match(/[A-Za-zÑñ]{3,}/g) ?? [];
  if (words.length >= (strict ? 2 : 1)) return true;
  if (strict && words.length >= 1 && /^\s*\d{1,5}\b/.test(t) && STREET_SUFFIX_REGEX.test(t)) {
    return true;
  }
  return false;
}

/**
 * Extract a (possibly multi-line) address. Locates the "Address"/"Tirahan" label
 * (inline value, label-only line, or bilingual "Tirahan/Address"), then collects
 * the following CONSECUTIVE address-like lines until a stop line.
 */
function extractAddress(lines: string[]): ParsedField | undefined {
  const addressLabelRegex = /^(?:ADDRESS|TIRAHAN)\s*[:.=-]?\s*(.*)$/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const m = addressLabelRegex.exec(line);
    if (!m) continue;

    const collected: string[] = [];

    // Inline value on the label line itself. Drop a bilingual "/Address" tail
    // ("Tirahan/Address") so it isn't mistaken for the value; ignore a non-address
    // inline fragment (collection falls through to the lines below).
    let inlineValue = stripAddressTailNoise((m[1] ?? '').trim());
    inlineValue = inlineValue.replace(/^\/\s*[A-Za-zÑñ ]+$/, '').trim();
    if (inlineValue && isAddressLine(inlineValue, true)) {
      collected.push(inlineValue);
    }

    for (let j = i + 1; j < lines.length; j += 1) {
      const raw = lines[j];
      if (!raw) break;
      const first = collected.length === 0;
      const candidate = stripAddressTailNoise(raw.replace(/\s+/g, ' ').trim());
      if (!isAddressLine(candidate, first)) break;
      collected.push(candidate);
      if (candidate !== raw.replace(/\s+/g, ' ').trim()) break;
    }

    if (collected.length > 0) {
      const joined = stripAddressTailNoise(collected.join(', '));
      if (joined.length > 3) return field(joined, 'medium');
    }

    return undefined;
  }

  return undefined;
}

/**
 * Extract the ISO birth date.
 *  1. Labelled line ("Date of Birth" inline / below) -> high.
 *  2. Multi-column header CONTAINING "Date of Birth", with the date on the SAME
 *     line (OCR merge) or the value row below -> high.
 *  3. Fallback: the first in-bounds date on a non issue/expiry line -> low.
 */
function extractBirthDate(lines: string[]): ParsedField | undefined {
  const dobLabels = ['Date\\s*of\\s*Birth', 'Birth\\s*date', 'Birthdate', 'Petsa\\s*ng\\s*Kapanganakan', 'DOB'];

  const labelled = valueAfterLabel(lines, dobLabels) ?? valueBelowLabel(lines, dobLabels);
  const labelledIso = parseBirthDate(labelled ?? '');
  if (labelledIso) return field(labelledIso, 'high');

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i];
    if (!header || !/DATE\s*OF\s*BIRTH/i.test(header)) continue;
    const sameLine = parseBirthDate(header);
    if (sameLine) return field(sameLine, 'high');
    const valueRow = lines[i + 1];
    if (valueRow) {
      const iso = parseBirthDate(valueRow);
      if (iso) return field(iso, 'high');
    }
  }

  for (const l of lines) {
    if (/ISSUE|ISSUED|EXPIR|VALID\s*UNTIL/i.test(l)) continue;
    const iso = parseBirthDate(l);
    if (iso) return field(iso, 'low');
  }

  return undefined;
}

/**
 * Extract sex. Prefers a LABELLED value (inline "Sex: X" anywhere on a line, or a
 * label-only "Sex" with the value below), then the multi-column header value row.
 * There is deliberately NO bare whole-text M/F scan — that mis-fires on middle
 * initials and the "m" inside "Height(m)".
 */
function extractSex(lines: string[], rawText: string): ParsedField<IdSex> | undefined {
  const inline = /\b(?:SEX|KASARIAN|GENDER)\s*[:.=\-]\s*(MALE|FEMALE|[MF])\b/i.exec(rawText);
  if (inline?.[1]) {
    const s = parseSexToken(inline[1]);
    if (s) return field(s, 'high');
  }

  const below = valueBelowLabel(lines, ['Sex', 'Kasarian', 'Gender']);
  const sBelow = parseSexToken(below ?? '');
  if (sBelow) return field(sBelow, 'high');

  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i];
    if (!header || !/\bSEX\b/i.test(header)) continue;
    if (!/NATIONALITY|DATE\s*OF\s*BIRTH|WEIGHT|HEIGHT/i.test(header)) continue;
    // Value on the SAME line (merged), the row BELOW (normal), or the row ABOVE
    // (reordered blocks). Strip the header itself so its own column words don't
    // count — only a lone M/F in the value row should match.
    const sameLine = sexFromRow(header.replace(/\bSEX\b/i, ' '));
    if (sameLine) return field(sameLine, 'medium');
    const below = lines[i + 1];
    if (below && !isStandaloneFieldLabel(below)) {
      const s = sexFromRow(below);
      if (s) return field(s, 'medium');
    }
    const above = lines[i - 1];
    if (above && !isStandaloneFieldLabel(above)) {
      const s = sexFromRow(above);
      if (s) return field(s, 'medium');
    }
  }

  // Fallback: a lone "M"/"F" printed on its own line (reordered cards with no
  // Sex label), unless it is a middle initial sitting under a name label.
  for (let i = 0; i < lines.length; i += 1) {
    const l = (lines[i] ?? '').trim().toUpperCase();
    if (l !== 'M' && l !== 'F') continue;
    if (isNameLabel(lines[i - 1] ?? '')) continue;
    return field(l === 'M' ? 'MALE' : 'FEMALE', 'low');
  }

  return undefined;
}

function extractCommon(lines: string[], rawText: string): {
  birthDate?: ParsedField;
  sex?: ParsedField<IdSex>;
  address?: ParsedField;
} {
  const out: { birthDate?: ParsedField; sex?: ParsedField<IdSex>; address?: ParsedField } = {};

  const birthDate = extractBirthDate(lines);
  if (birthDate) out.birthDate = birthDate;

  const sex = extractSex(lines, rawText);
  if (sex) out.sex = sex;

  const address = extractAddress(lines);
  if (address) out.address = address;

  return out;
}

// ── Passport (MRZ) extractor ────────────────────────────────────────────────
// MRZ line 1: P<PHLSURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<
// MRZ line 2: PASSPORTNO<CHK PHL YYMMDD(dob) C SEX YYMMDD(exp) ...

// Structural matcher for MRZ line 2 (offset-independent, survives merges/stray
// punctuation): <docNo:9><chk><nat:3><dob:6><chk><sex><exp:6>.
const MRZ_LINE2_REGEX = /([A-Z0-9<]{9})[0-9<]([A-Z]{3})(\d{6})[0-9<]([MFX<])(\d{6})/;

/**
 * Normalize a candidate MRZ line: strip everything that isn't an MRZ glyph (kills
 * stray punctuation that would shift fixed offsets), and convert a fully
 * K-substituted line (every chevron OCR'd as 'K', so NO real '<' and long K-fill
 * runs) back to '<'. A line with real '<' is left untouched, so a genuine name
 * containing the letter K is never corrupted.
 */
function normalizeMrzLine(line: string): string {
  let s = line.replace(/[^A-Z0-9<K]/g, '');
  if (!s.includes('<') && /KKKK/.test(s)) {
    s = s.replace(/K/g, '<');
  }
  return s;
}

function extractPassport(rawText: string): Partial<ParsedIdResult> {
  const out: Partial<ParsedIdResult> = {};
  const mrzLines = rawText
    .toUpperCase()
    .split(/\r?\n/)
    .map(normalizeMrzLine)
    .filter((l) => l.length >= 20 && l.includes('<'));

  // Line 1 (name): strip the "P<PHL"/"PKPHL"/"P<PH1" prefix tolerantly (OCR may
  // turn a country letter into a digit), split on "<<", join ALL given parts, and
  // run the SAME confusable-aware cleanName as the rest of the parser.
  const line1 = mrzLines.find((l) => /^[PF][<K]/.test(l));
  if (line1) {
    const body = line1.replace(/^[PF][<K]?[A-Z0-9]{3}/, '');
    // The name zone ends at the first chevron-FILLER run (3+). Anything after is
    // padding or, on a MERGED single-line MRZ, the line-2 number block — neither
    // belongs in the name. The "<<" surname/given separator (exactly 2) is kept.
    const nameZone = body.split(/<{3,}/)[0] ?? '';
    const nameParts = nameZone.split('<<');
    const surname = cleanName((nameParts[0] ?? '').replace(/</g, ' '));
    const given = cleanName(nameParts.slice(1).join('<').replace(/</g, ' '));
    if (surname || given) {
      out.fullName = field([surname, given].filter(Boolean).join(', '), 'high');
    }
  }

  // Line 2 (number / DOB / sex): found by structure across ALL candidate lines,
  // so a merged single-line MRZ or reordered blocks still resolve.
  let l2: RegExpMatchArray | null = null;
  for (const l of mrzLines) {
    const m = MRZ_LINE2_REGEX.exec(l);
    if (m) {
      l2 = m;
      break;
    }
  }
  if (l2) {
    const passportNo = (l2[1] ?? '').replace(/</g, '');
    if (passportNo.length >= 6) out.idNumber = field(passportNo, 'high');

    const dobRaw = l2[3] ?? '';
    if (/^\d{6}$/.test(dobRaw)) {
      const yy = Number(dobRaw.slice(0, 2));
      const fullYear = yy > new Date().getFullYear() % 100 ? 1900 + yy : 2000 + yy;
      const iso = parseBirthDate(`${fullYear}-${dobRaw.slice(2, 4)}-${dobRaw.slice(4, 6)}`);
      if (iso) out.birthDate = field(iso, 'high');
    }

    const sexChar = l2[4] ?? '';
    if (sexChar === 'M') out.sex = field('MALE', 'high');
    else if (sexChar === 'F') out.sex = field('FEMALE', 'high');
  }

  return out;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Parse raw recognized ID text into structured KYC fields.
 */
export function parseIdText(rawText: string): ParsedIdResult {
  const lines = toLines(rawText);
  const upper = rawText.toUpperCase();
  const { type, confidence: documentTypeConfidence } = detectDocumentType(rawText);

  // Passport is fully MRZ-driven and skips the generic line parsing.
  if (type === 'PASSPORT') {
    const passport = extractPassport(rawText);
    return {
      documentType: type,
      documentTypeConfidence,
      ...passport,
    };
  }

  const result: ParsedIdResult = { documentType: type, documentTypeConfidence };

  // ── ID number (document-specific anchor). Strict format first, then an OCR-
  //    tolerant grouped fallback (confusable digits + variable separators). ────
  let idNumber: string | null = null;
  let strictMatch: RegExpExecArray | null = null;
  switch (type) {
    case 'PHILSYS_ID':
      strictMatch = PCN_REGEX.exec(upper);
      idNumber = strictMatch?.[1] ? normalizeIdNumber(strictMatch[1]) : findGroupedNumericId(upper, [4, 4, 4, 4]);
      break;
    case 'DRIVERS_LICENSE':
      strictMatch = DL_REGEX.exec(upper);
      idNumber = strictMatch?.[1] ? normalizeIdNumber(strictMatch[1]) : null;
      break;
    case 'SSS_UMID':
      strictMatch = CRN_REGEX.exec(upper);
      idNumber = strictMatch?.[1] ? normalizeIdNumber(strictMatch[1]) : findGroupedNumericId(upper, [4, 7, 1]);
      break;
    case 'PHILHEALTH':
      strictMatch = PHILHEALTH_REGEX.exec(upper);
      idNumber = strictMatch?.[1] ? normalizeIdNumber(strictMatch[1]) : findGroupedNumericId(upper, [2, 9, 1]);
      break;
    case 'GENERIC_ID':
    default:
      strictMatch =
        PCN_REGEX.exec(upper) ??
        CRN_REGEX.exec(upper) ??
        DL_REGEX.exec(upper) ??
        PHILHEALTH_REGEX.exec(upper);
      idNumber = strictMatch?.[1] ? normalizeIdNumber(strictMatch[1]) : null;
      break;
  }
  if (idNumber) {
    result.idNumber = field(idNumber, type === 'GENERIC_ID' ? 'low' : 'high');
  }

  // ── Name ─────────────────────────────────────────────────────────────────
  const name = extractCombinedHeaderName(lines) ?? extractLabelledName(lines);
  if (name) result.fullName = name;

  // ── Shared fields ────────────────────────────────────────────────────────
  const common = extractCommon(lines, rawText);
  if (common.birthDate) result.birthDate = common.birthDate;
  if (common.sex) result.sex = common.sex;
  if (common.address) result.address = common.address;

  return result;
}
