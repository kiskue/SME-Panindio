/**
 * Shared date / time formatting utilities.
 *
 * Consolidates the local `formatDate` / `formatTime` / `formatTodayDate` /
 * `formatDayLabel` helpers that were duplicated across screens and cards.
 * All formatting uses the `en-PH` locale to match the rest of the app.
 */

const LOCALE = 'en-PH';

/**
 * Short date with year, e.g. `'Jun 24, 2026'`.
 * (month: short, day: numeric, year: numeric)
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Month + day only, e.g. `'Jun 24'`.
 */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Full weekday + long date, e.g. `'Wednesday, June 24, 2026'`.
 * Defaults to the current date.
 */
export function formatLongDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

/**
 * 12-hour clock with AM/PM, e.g. `'3:07 PM'`.
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Short date + time via locale formatting, e.g. `'Jun 24, 3:07 PM'`.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, {
    month:  'short',
    day:    'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Short date and 12-hour time joined with a middot, e.g. `'Jun 24 · 3:07 PM'`.
 */
export function formatShortDateTime(iso: string): string {
  return `${formatShortDate(iso)} · ${formatTime(iso)}`;
}

/**
 * Short weekday label, e.g. `'Wed'`, from a `YYYY-MM-DD` date string.
 * Parsed at local midnight to avoid UTC off-by-one shifts.
 */
export function formatWeekday(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(LOCALE, {
    weekday: 'short',
  });
}

/** Today's date as a `YYYY-MM-DD` string (UTC, matching `toISOString().slice(0, 10)`). */
export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current timestamp as a full ISO 8601 string. */
export function getNowISO(): string {
  return new Date().toISOString();
}
