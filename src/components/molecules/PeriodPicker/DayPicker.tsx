/**
 * DayPicker — calendar grid picker for the dashboard period selector.
 *
 * Renders a month calendar (Sun–Sat header, day cells) with prev/next month
 * navigation. Tapping a day calls `onSelect` with the YYYY-MM-DD string for
 * that day. Days after today are dimmed and non-interactive.
 *
 * The calendar is built purely with FlatList + Pressable — no external libs.
 *
 * TypeScript constraints:
 *   - exactOptionalPropertyTypes: never `prop: undefined`
 *   - noUncheckedIndexedAccess: all array index access uses `?? fallback`
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayPickerProps {
  /** Currently selected anchor — ISO YYYY-MM-DD. */
  selectedAnchor: string;
  /** Called with the picked YYYY-MM-DD string. */
  onSelect: (anchor: string) => void;
  isDark: boolean;
}

interface CalendarCell {
  /** YYYY-MM-DD, or '' for padding cells before the 1st of the month. */
  dateStr: string;
  /** Day-of-month number, or 0 for padding. */
  day: number;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ACTIVE_BG    = staticTheme.colors.primary[500];
const ACTIVE_TEXT  = '#FFFFFF';
const TODAY_BORDER = staticTheme.colors.primary[300];

const DARK_TEXT         = '#F1F5F9';
const DARK_TEXT_SEC     = '#94A3B8';
const DARK_DISABLED     = '#475569';
const DARK_HEADER_BG    = '#1E2435';
const DARK_HEADER_BORD  = 'rgba(255,255,255,0.10)';
const DARK_CELL_PRESSED = 'rgba(255,255,255,0.08)';

const LIGHT_TEXT         = staticTheme.colors.text;
const LIGHT_TEXT_SEC     = staticTheme.colors.gray[500];
const LIGHT_DISABLED     = staticTheme.colors.gray[300];
const LIGHT_HEADER_BG    = staticTheme.colors.primary[50];
const LIGHT_HEADER_BORD  = staticTheme.colors.primary[100];
const LIGHT_CELL_PRESSED = staticTheme.colors.primary[50];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NUM_COLS   = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" from UTC date components. */
function toYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Today as a "YYYY-MM-DD" string (local date, not UTC). */
function todayStr(): string {
  const t = new Date();
  return toYMD(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Returns the month label, e.g. "March 2026". */
function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year:  'numeric',
  });
}

/**
 * Builds the flat array of CalendarCell objects for a given month.
 * Pads the start with empty cells so day 1 falls on the correct weekday.
 */
function buildCells(year: number, month: number): CalendarCell[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  // Leading padding
  for (let i = 0; i < firstDow; i++) {
    cells.push({ dateStr: '', day: 0 });
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: toYMD(year, month, d), day: d });
  }

  // Trailing padding to complete the last row (must be a multiple of 7)
  const remainder = cells.length % NUM_COLS;
  if (remainder !== 0) {
    const fill = NUM_COLS - remainder;
    for (let i = 0; i < fill; i++) {
      cells.push({ dateStr: '', day: 0 });
    }
  }

  return cells;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DayPicker = React.memo<DayPickerProps>(
  ({ selectedAnchor, onSelect, isDark }) => {
    // Seed the visible month from the selected anchor (or today).
    const seedDate = useMemo(() => {
      const d = new Date(`${selectedAnchor}T00:00:00`);
      return isNaN(d.getTime()) ? new Date() : d;
    }, [selectedAnchor]);

    const [viewYear,  setViewYear]  = useState(seedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(seedDate.getMonth());

    const cells  = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth]);
    const today  = useMemo(() => todayStr(), []);
    const label  = useMemo(() => monthLabel(viewYear, viewMonth), [viewYear, viewMonth]);

    // Derived tokens
    const textMain    = isDark ? DARK_TEXT         : LIGHT_TEXT;
    const textSec     = isDark ? DARK_TEXT_SEC     : LIGHT_TEXT_SEC;
    const textDisable = isDark ? DARK_DISABLED     : LIGHT_DISABLED;
    const headerBg    = isDark ? DARK_HEADER_BG    : LIGHT_HEADER_BG;
    const headerBord  = isDark ? DARK_HEADER_BORD  : LIGHT_HEADER_BORD;
    const cellPressed = isDark ? DARK_CELL_PRESSED : LIGHT_CELL_PRESSED;

    const prevMonth = useCallback(() => {
      setViewYear(y  => viewMonth === 0 ? y - 1 : y);
      setViewMonth(m => m === 0 ? 11 : m - 1);
    }, [viewMonth]);

    const nextMonth = useCallback(() => {
      // Never navigate into a future month where all days would be disabled.
      const todayDate = new Date();
      const isCurrentMonth = viewYear === todayDate.getFullYear()
        && viewMonth === todayDate.getMonth();
      if (isCurrentMonth) return;

      setViewYear(y  => viewMonth === 11 ? y + 1 : y);
      setViewMonth(m => m === 11 ? 0 : m + 1);
    }, [viewMonth, viewYear]);

    // Whether the "next month" arrow should be disabled.
    const nextDisabled = useMemo(() => {
      const todayDate = new Date();
      return viewYear === todayDate.getFullYear()
        && viewMonth === todayDate.getMonth();
    }, [viewYear, viewMonth]);

    const renderCell = useCallback(({ item }: ListRenderItemInfo<CalendarCell>) => {
      // Empty padding cell
      if (item.dateStr === '') {
        return <View style={cellStyles.cell} />;
      }

      const isSelected = item.dateStr === selectedAnchor;
      const isToday    = item.dateStr === today;
      const isFuture   = item.dateStr > today;

      const bg = isSelected ? ACTIVE_BG : 'transparent';
      const textColor = isSelected
        ? ACTIVE_TEXT
        : isFuture
          ? textDisable
          : isToday
            ? staticTheme.colors.primary[500]
            : textMain;

      return (
        <Pressable
          onPress={isFuture ? undefined : () => onSelect(item.dateStr)}
          style={({ pressed }) => [
            cellStyles.cell,
            {
              backgroundColor: isSelected
                ? ACTIVE_BG
                : pressed && !isFuture
                  ? cellPressed
                  : bg,
              borderWidth:  isToday && !isSelected ? 1 : 0,
              borderColor:  TODAY_BORDER,
              borderRadius: 8,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.dateStr}`}
          {...(isFuture ? { accessibilityState: { disabled: true } } : {})}
        >
          <Text
            variant="body-sm"
            weight={isSelected ? 'semibold' : 'normal'}
            style={{ color: textColor, textAlign: 'center' }}
          >
            {item.day}
          </Text>
        </Pressable>
      );
    }, [selectedAnchor, today, textMain, textDisable, cellPressed, onSelect]);

    const keyExtractor = useCallback(
      (item: CalendarCell, index: number) =>
        item.dateStr !== '' ? item.dateStr : `pad-${index}`,
      [],
    );

    return (
      <View style={pickerStyles.container}>
        {/* Month navigation header */}
        <View
          style={[
            pickerStyles.monthNav,
            { backgroundColor: headerBg, borderColor: headerBord },
          ]}
        >
          <Pressable
            onPress={prevMonth}
            style={({ pressed }) => [pickerStyles.navBtn, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={18} color={isDark ? DARK_TEXT_SEC : LIGHT_TEXT_SEC} strokeWidth={2.5} />
          </Pressable>

          <Text
            variant="body-sm"
            weight="semibold"
            style={{ flex: 1, textAlign: 'center', color: textMain }}
          >
            {label}
          </Text>

          <Pressable
            onPress={nextDisabled ? undefined : nextMonth}
            style={({ pressed }) => [
              pickerStyles.navBtn,
              { opacity: nextDisabled ? 0.28 : pressed ? 0.5 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            {...(nextDisabled ? { accessibilityState: { disabled: true } } : {})}
          >
            <ChevronRight size={18} color={isDark ? DARK_TEXT_SEC : LIGHT_TEXT_SEC} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Day-of-week labels row */}
        <View style={pickerStyles.dayLabelsRow}>
          {DAY_LABELS.map(dl => (
            <View key={dl} style={cellStyles.cell}>
              <Text
                variant="body-xs"
                weight="semibold"
                style={{ color: textSec, textAlign: 'center' }}
              >
                {dl}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <FlatList<CalendarCell>
          data={cells}
          numColumns={NUM_COLS}
          keyExtractor={keyExtractor}
          renderItem={renderCell}
          scrollEnabled={false}
          style={pickerStyles.grid}
        />
      </View>
    );
  },
);

DayPicker.displayName = 'DayPicker';

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = 42;

const cellStyles = StyleSheet.create({
  cell: {
    flex:           1,
    aspectRatio:    1,
    minWidth:       CELL_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    gap: 8,
  },
  monthNav: {
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
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom:  2,
  },
  grid: {
    flexGrow: 0,
  },
});
