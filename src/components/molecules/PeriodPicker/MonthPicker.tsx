/**
 * MonthPicker — 12-month grid with year navigation for the dashboard.
 *
 * Renders a 3×4 grid of month cells (Jan–Dec) for the visible year. A year
 * navigator at the top lets the user switch years. Future months are dimmed
 * and non-interactive. Tapping a month calls `onSelect` with the YYYY-MM-01
 * anchor for that month.
 *
 * TypeScript constraints:
 *   - exactOptionalPropertyTypes: no `prop: undefined`
 *   - noUncheckedIndexedAccess: all array access uses `?? fallback`
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthPickerProps {
  /** Currently selected anchor — ISO YYYY-MM-DD (1st of the active month). */
  selectedAnchor: string;
  /** Called with the YYYY-MM-01 anchor for the selected month. */
  onSelect: (anchor: string) => void;
  isDark: boolean;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ACTIVE_BG    = staticTheme.colors.primary[500];
const ACTIVE_TEXT  = '#FFFFFF';

const DARK_TEXT         = '#F1F5F9';
const DARK_TEXT_SEC     = '#94A3B8';
const DARK_DISABLED     = '#475569';
const DARK_HEADER_BG    = '#1E2435';
const DARK_HEADER_BORD  = 'rgba(255,255,255,0.10)';
const DARK_CELL_PRESSED = 'rgba(255,255,255,0.08)';
const DARK_THIS_MONTH   = staticTheme.colors.primary[300];

const LIGHT_TEXT         = staticTheme.colors.text;
const LIGHT_TEXT_SEC     = staticTheme.colors.gray[500];
const LIGHT_DISABLED     = staticTheme.colors.gray[300];
const LIGHT_HEADER_BG    = staticTheme.colors.primary[50];
const LIGHT_HEADER_BORD  = staticTheme.colors.primary[100];
const LIGHT_CELL_PRESSED = staticTheme.colors.primary[50];
const LIGHT_THIS_MONTH   = staticTheme.colors.primary[500];

const MONTH_ABBRS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-01" for a given year and 0-indexed month. */
function toMonthAnchor(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MonthPicker = React.memo<MonthPickerProps>(
  ({ selectedAnchor, onSelect, isDark }) => {
    // Seed the viewed year from the selected anchor.
    const seedYear = useMemo(() => {
      const d = new Date(`${selectedAnchor}T00:00:00`);
      return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    }, [selectedAnchor]);

    const [viewYear, setViewYear] = useState(seedYear);

    const todayDate  = useMemo(() => new Date(), []);
    const thisYear   = todayDate.getFullYear();
    const thisMonth  = todayDate.getMonth(); // 0-indexed

    // Parse selectedAnchor into { year, month } for comparison.
    const selectedYear  = useMemo(() => parseInt(selectedAnchor.slice(0, 4), 10), [selectedAnchor]);
    const selectedMonth = useMemo(() => parseInt(selectedAnchor.slice(5, 7), 10) - 1, [selectedAnchor]);

    // Derived tokens
    const textMain    = isDark ? DARK_TEXT         : LIGHT_TEXT;
    const textSec     = isDark ? DARK_TEXT_SEC     : LIGHT_TEXT_SEC;
    const textDisable = isDark ? DARK_DISABLED     : LIGHT_DISABLED;
    const headerBg    = isDark ? DARK_HEADER_BG    : LIGHT_HEADER_BG;
    const headerBord  = isDark ? DARK_HEADER_BORD  : LIGHT_HEADER_BORD;
    const cellPressed = isDark ? DARK_CELL_PRESSED : LIGHT_CELL_PRESSED;
    const thisMonthClr = isDark ? DARK_THIS_MONTH  : LIGHT_THIS_MONTH;

    const nextDisabled = viewYear >= thisYear;

    const prevYear = useCallback(() => setViewYear(y => y - 1), []);
    const nextYear = useCallback(() => {
      if (!nextDisabled) setViewYear(y => y + 1);
    }, [nextDisabled]);

    // 3-column rows: [[Jan,Feb,Mar],[Apr,May,Jun],[Jul,Aug,Sep],[Oct,Nov,Dec]]
    const rows = useMemo(() => {
      const result: number[][] = [];
      for (let i = 0; i < 12; i += 3) {
        result.push([i, i + 1, i + 2]);
      }
      return result;
    }, []);

    const handleSelect = useCallback(
      (monthIndex: number) => {
        onSelect(toMonthAnchor(viewYear, monthIndex));
      },
      [viewYear, onSelect],
    );

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

        {/* Month grid — 4 rows × 3 columns */}
        <View style={pickerStyles.grid}>
          {rows.map(row => (
            <View key={row[0]} style={pickerStyles.row}>
              {row.map(monthIndex => {
                // A month is "future" if it's in a future year, or the same
                // year and a future month index.
                const isFuture = viewYear > thisYear
                  || (viewYear === thisYear && monthIndex > thisMonth);

                const isSelected = viewYear === selectedYear && monthIndex === selectedMonth;
                const isThisMonth = viewYear === thisYear && monthIndex === thisMonth;

                const bg = isSelected ? ACTIVE_BG : 'transparent';
                const textColor = isSelected
                  ? ACTIVE_TEXT
                  : isFuture
                    ? textDisable
                    : isThisMonth
                      ? thisMonthClr
                      : textMain;

                const label = MONTH_ABBRS[monthIndex] ?? '---';

                return (
                  <Pressable
                    key={monthIndex}
                    onPress={isFuture ? undefined : () => handleSelect(monthIndex)}
                    style={({ pressed }) => [
                      pickerStyles.cell,
                      {
                        backgroundColor: isSelected
                          ? ACTIVE_BG
                          : pressed && !isFuture
                            ? cellPressed
                            : bg,
                        borderWidth:  isThisMonth && !isSelected ? 1 : 0,
                        borderColor:  thisMonthClr,
                        borderRadius: 10,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${label} ${viewYear}`}
                    {...(isFuture ? { accessibilityState: { disabled: true } } : {})}
                  >
                    <Text
                      variant="body-sm"
                      weight={isSelected ? 'semibold' : isThisMonth ? 'semibold' : 'normal'}
                      style={{ color: textColor, textAlign: 'center' }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  },
);

MonthPicker.displayName = 'MonthPicker';

// ─── Styles ───────────────────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  container: {
    gap: 8,
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
  grid: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap:           8,
  },
  cell: {
    flex:           1,
    paddingVertical: 14,
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      48,
  },
});
