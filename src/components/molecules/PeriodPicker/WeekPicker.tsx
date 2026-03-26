/**
 * WeekPicker — scrollable week-row list for the dashboard period selector.
 *
 * Shows every ISO week in the visible year (with a year navigator at the top).
 * Each row displays the week date range, e.g. "Mar 19 – Mar 25". Tapping a
 * row calls `onSelect` with the Monday anchor (YYYY-MM-DD) for that week.
 * Weeks whose Monday is after today are dimmed and non-interactive.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`
 *   - noUncheckedIndexedAccess: array access uses `?? fallback`
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekPickerProps {
  /** Currently selected anchor — ISO YYYY-MM-DD (Monday of the active week). */
  selectedAnchor: string;
  /** Called with the Monday YYYY-MM-DD of the selected week. */
  onSelect: (anchor: string) => void;
  isDark: boolean;
}

interface WeekRow {
  /** Monday of this ISO week — canonical anchor. */
  monday: string;
  /** Sunday of this ISO week — for display only. */
  sunday: string;
  /** Concise human-readable range, e.g. "Mar 19 – Mar 25". */
  label: string;
  /** ISO week number (1–53). */
  weekNumber: number;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ACTIVE_BG    = staticTheme.colors.primary[500];
const ACTIVE_TEXT  = '#FFFFFF';

const DARK_TEXT          = '#F1F5F9';
const DARK_TEXT_SEC      = '#94A3B8';
const DARK_DISABLED      = '#475569';
const DARK_HEADER_BG     = '#1E2435';
const DARK_HEADER_BORD   = 'rgba(255,255,255,0.10)';
const DARK_ROW_PRESSED   = 'rgba(255,255,255,0.06)';
const DARK_DIVIDER       = 'rgba(255,255,255,0.06)';
const DARK_WEEK_NUM_CLR  = '#475569';

const LIGHT_TEXT         = staticTheme.colors.text;
const LIGHT_TEXT_SEC     = staticTheme.colors.gray[500];
const LIGHT_DISABLED     = staticTheme.colors.gray[300];
const LIGHT_HEADER_BG    = staticTheme.colors.primary[50];
const LIGHT_HEADER_BORD  = staticTheme.colors.primary[100];
const LIGHT_ROW_PRESSED  = staticTheme.colors.primary[50];
const LIGHT_DIVIDER      = staticTheme.colors.gray[100];
const LIGHT_WEEK_NUM_CLR = staticTheme.colors.gray[400];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" from a Date using its local date parts. */
function toYMD(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns today as "YYYY-MM-DD". */
function todayStr(): string {
  return toYMD(new Date());
}

/** Short month abbreviation for a Date. */
function shortMonth(d: Date): string {
  return d.toLocaleDateString('en-PH', { month: 'short' });
}

/**
 * Returns the ISO week number (1–53) for a given Date.
 * Uses the standard ISO 8601 algorithm: weeks start on Monday.
 */
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day  = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Builds all ISO weeks for a calendar year. Each week starts on Monday.
 * The first Monday on or before Jan 1 is the first week; we iterate through
 * all Mondays until the end of the year (Dec 31).
 */
function buildWeeks(year: number): WeekRow[] {
  const jan1   = new Date(year, 0, 1);
  const jan1Dow = jan1.getDay(); // 0=Sun

  // Find the Monday on or before Jan 1 (could be in prev year)
  const offsetToMonday = jan1Dow === 0 ? -6 : 1 - jan1Dow;
  let monday = new Date(year, 0, 1 + offsetToMonday);

  const weeks: WeekRow[] = [];
  const yearEnd = new Date(year, 11, 31);

  while (monday <= yearEnd) {
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const mStr = toYMD(monday);
    const sStr = toYMD(sunday);

    // Build label — if Mon and Sun are in same month: "Mar 19 – 25",
    // else: "Mar 26 – Apr 1"
    const monLabel = `${shortMonth(monday)} ${monday.getDate()}`;
    const sunLabel = monday.getMonth() === sunday.getMonth()
      ? `${sunday.getDate()}`
      : `${shortMonth(sunday)} ${sunday.getDate()}`;
    const label = `${monLabel} – ${sunLabel}`;

    weeks.push({
      monday:     mStr,
      sunday:     sStr,
      label,
      weekNumber: isoWeekNumber(monday),
    });

    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }

  return weeks;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const WeekPicker = React.memo<WeekPickerProps>(
  ({ selectedAnchor, onSelect, isDark }) => {
    const seedYear = useMemo(() => {
      const d = new Date(`${selectedAnchor}T00:00:00`);
      return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    }, [selectedAnchor]);

    const [viewYear, setViewYear] = useState(seedYear);

    const weeks   = useMemo(() => buildWeeks(viewYear), [viewYear]);
    const today   = useMemo(() => todayStr(), []);
    const thisYear = new Date().getFullYear();

    // Derived tokens
    const textMain    = isDark ? DARK_TEXT         : LIGHT_TEXT;
    const textSec     = isDark ? DARK_TEXT_SEC     : LIGHT_TEXT_SEC;
    const textDisable = isDark ? DARK_DISABLED     : LIGHT_DISABLED;
    const headerBg    = isDark ? DARK_HEADER_BG    : LIGHT_HEADER_BG;
    const headerBord  = isDark ? DARK_HEADER_BORD  : LIGHT_HEADER_BORD;
    const rowPressed  = isDark ? DARK_ROW_PRESSED  : LIGHT_ROW_PRESSED;
    const dividerClr  = isDark ? DARK_DIVIDER      : LIGHT_DIVIDER;
    const weekNumClr  = isDark ? DARK_WEEK_NUM_CLR : LIGHT_WEEK_NUM_CLR;

    const nextDisabled = viewYear >= thisYear;

    // Plain function references — no useCallback needed since weeks.length is
    // captured by value and these are only called from Pressable onPress.
    const prevYear = () => setViewYear(y => y - 1);
    const nextYear = () => { if (!nextDisabled) setViewYear(y => y + 1); };

    return (
      <View style={pickerStyles.container}>
        {/* Year navigator */}
        <View
          style={[
            pickerStyles.yearNav,
            { backgroundColor: headerBg, borderColor: headerBord },
          ]}
        >
          <Pressable
            onPress={prevYear}
            style={({ pressed }) => [pickerStyles.navBtn, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Previous year"
          >
            <ChevronLeft size={18} color={textSec} strokeWidth={2.5} />
          </Pressable>

          <Text
            variant="body-sm"
            weight="semibold"
            style={{ flex: 1, textAlign: 'center', color: textMain }}
          >
            {viewYear}
          </Text>

          <Pressable
            onPress={nextDisabled ? undefined : nextYear}
            style={({ pressed }) => [
              pickerStyles.navBtn,
              { opacity: nextDisabled ? 0.28 : pressed ? 0.5 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next year"
            {...(nextDisabled ? { accessibilityState: { disabled: true } } : {})}
          >
            <ChevronRight size={18} color={textSec} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/*
          Week list — plain ScrollView + map replaces FlatList to prevent the
          "VirtualizedLists should never be nested inside plain ScrollViews"
          warning. 52 rows is well within safe range for non-windowed rendering.
        */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={pickerStyles.list}
          keyboardShouldPersistTaps="handled"
        >
          {weeks.map((item, index) => {
            const isSelected = item.monday === selectedAnchor;
            const isFuture   = item.monday > today;

            const bg        = isSelected ? ACTIVE_BG : 'transparent';
            const mainColor = isSelected
              ? ACTIVE_TEXT
              : isFuture
                ? textDisable
                : textMain;
            const secColor  = isSelected
              ? 'rgba(255,255,255,0.75)'
              : isFuture
                ? textDisable
                : textSec;
            const wnColor   = isSelected ? 'rgba(255,255,255,0.60)' : weekNumClr;

            return (
              <Pressable
                key={item.monday}
                onPress={isFuture ? undefined : () => onSelect(item.monday)}
                style={({ pressed }) => [
                  rowStyles.row,
                  {
                    backgroundColor: isSelected
                      ? ACTIVE_BG
                      : pressed && !isFuture
                        ? rowPressed
                        : bg,
                    borderBottomColor: dividerClr,
                    borderBottomWidth: index < weeks.length - 1 ? 1 : 0,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select week ${item.weekNumber}: ${item.label}`}
                {...(isFuture ? { accessibilityState: { disabled: true } } : {})}
              >
                {/* Week number badge */}
                <View style={rowStyles.weekNumBadge}>
                  <Text variant="body-xs" weight="semibold" style={{ color: wnColor, textAlign: 'center' }}>
                    W{item.weekNumber}
                  </Text>
                </View>

                {/* Date range label */}
                <View style={rowStyles.labelBlock}>
                  <Text variant="body-sm" weight={isSelected ? 'semibold' : 'medium'} style={{ color: mainColor }}>
                    {item.label}
                  </Text>
                </View>

                {/* "This week" badge for the current week */}
                {item.monday <= today && item.sunday >= today && (
                  <View style={rowStyles.currentBadge}>
                    <Text variant="body-xs" weight="semibold" style={{ color: secColor }}>
                      This week
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

WeekPicker.displayName = 'WeekPicker';

// ─── Styles ───────────────────────────────────────────────────────────────────

const rowStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 12,
    borderRadius:      8,
    gap:               10,
  },
  weekNumBadge: {
    width:          32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  labelBlock: {
    flex: 1,
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap:  8,
  },
  yearNav: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      12,
    borderWidth:       1,
    paddingVertical:   4,
    paddingHorizontal: 4,
    marginBottom:      4,
  },
  navBtn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   8,
  },
  list: {
    flexGrow: 0,
  },
});
