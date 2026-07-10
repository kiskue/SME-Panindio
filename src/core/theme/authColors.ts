/**
 * Auth brand colors — the FIXED design for the un-themed auth flow
 * (login, register, customer-register, customer-qr-result).
 *
 * Auth screens intentionally never switch light/dark: the theme store resolves
 * the `auth` context to `light` (see theme.store.ts `selectResolvedMode`), so
 * even a dark-mode user who logs out lands on a consistent branded sign-in. These
 * constants are the single source of the navy/amber/green chrome those screens
 * share — replacing the per-file NAVY/AMBER/GREEN consts and the old
 * `isDark ? '#4F9EFF' : '#1E4D8C'` branches.
 */
export const authColors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  NAVY:         '#1E4D8C',
  NAVY_PRESSED: '#163A6B',
  AMBER:        '#F5A623',
  GREEN:        '#27AE60',
  /** AA-safe FILLED green (white label ≥ 4:1) — for the customer primary CTA. */
  GREEN_CTA:    '#209150',

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  CANVAS:      '#F0F4F8',
  CARD:        '#FFFFFF',
  CARD_BORDER: '#ECF1F8',
  HEADER_SUB:  'rgba(255,255,255,0.70)',

  // ── Inputs ───────────────────────────────────────────────────────────────────
  INPUT_BG:           '#FAFBFD',
  INPUT_BORDER:       '#DDE3EE',
  INPUT_BORDER_FOCUS: '#1E4D8C',
  INPUT_BORDER_ERROR: '#EF4444',
  INPUT_BORDER_OK:    '#27AE60',
  INPUT_TEXT:         '#1A3A6B',
  LABEL:              '#1E4D8C',
  PLACEHOLDER:        '#9CA3AF',

  // ── Text / dividers ──────────────────────────────────────────────────────────
  TEXT_SECONDARY: '#6B7280',
  DIVIDER:        '#E5E7EB',

  // ── Error ────────────────────────────────────────────────────────────────────
  ERROR_BG:   '#FEF2F2',
  ERROR_TEXT: '#B91C1C',
} as const;
