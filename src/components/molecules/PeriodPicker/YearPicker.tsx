/**
 * YearPicker — scrollable year list for the dashboard period selector.
 *
 * Shows all years from `START_YEAR` (2020) up to and including the current
 * year. Future years are excluded (no data yet). Tapping a year calls
 * `onSelect` with the YYYY-01-01 anchor for that year.
 *
 * TypeScript constraints:
 *   - exactOptionalPropertyTypes: no `prop: undefined`
 *   - noUncheckedIndexedAccess: array access uses `?? fallback`
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YearPickerProps {
  /** Currently selected anchor — ISO YYYY-MM-DD (Jan 1 of the active year). */
  selectedAnchor: string;
  /** Called with the YYYY-01-01 anchor for the selected year. */
  onSelect: (anchor: string) => void;
  isDark: boolean;
}

interface YearRow {
  year:   number;
  anchor: string; // "YYYY-01-01"
  label:  string; // "YYYY"
}

// ─── Config ───────────────────────────────────────────────────────────────────

const START_YEAR = 2020;

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ACTIVE_BG    = staticTheme.colors.primary[500];
const ACTIVE_TEXT  = '#FFFFFF';

const DARK_TEXT         = '#F1F5F9';
const DARK_TEXT_SEC     = '#94A3B8';
const DARK_ROW_PRESSED  = 'rgba(255,255,255,0.06)';
const DARK_DIVIDER      = 'rgba(255,255,255,0.06)';
const DARK_THIS_YEAR    = staticTheme.colors.primary[300];

const LIGHT_TEXT         = staticTheme.colors.text;
const LIGHT_TEXT_SEC     = staticTheme.colors.gray[500];
const LIGHT_ROW_PRESSED  = staticTheme.colors.primary[50];
const LIGHT_DIVIDER      = staticTheme.colors.gray[100];
const LIGHT_THIS_YEAR    = staticTheme.colors.primary[500];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYearAnchor(year: number): string {
  return `${year}-01-01`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const YearPicker = React.memo<YearPickerProps>(
  ({ selectedAnchor, onSelect, isDark }) => {
    const thisYear = useMemo(() => new Date().getFullYear(), []);
    const selectedYear = useMemo(
      () => parseInt(selectedAnchor.slice(0, 4), 10),
      [selectedAnchor],
    );

    // Build the year list in descending order (most recent first).
    const years = useMemo<YearRow[]>(() => {
      const result: YearRow[] = [];
      for (let y = thisYear; y >= START_YEAR; y--) {
        result.push({
          year:   y,
          anchor: toYearAnchor(y),
          label:  String(y),
        });
      }
      return result;
    }, [thisYear]);

    // Derived tokens
    const textMain    = isDark ? DARK_TEXT        : LIGHT_TEXT;
    const textSec     = isDark ? DARK_TEXT_SEC    : LIGHT_TEXT_SEC;
    const rowPressed  = isDark ? DARK_ROW_PRESSED : LIGHT_ROW_PRESSED;
    const dividerClr  = isDark ? DARK_DIVIDER     : LIGHT_DIVIDER;
    const thisYearClr = isDark ? DARK_THIS_YEAR   : LIGHT_THIS_YEAR;

    return (
      /*
        Plain ScrollView + map replaces FlatList to prevent the
        "VirtualizedLists should never be nested inside plain ScrollViews"
        warning. The year list is at most ~7 rows (START_YEAR → thisYear),
        so windowing provides no benefit here.
      */
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={listStyles.list}
        keyboardShouldPersistTaps="handled"
      >
        {years.map((item, index) => {
          const isSelected = item.year === selectedYear;
          const isThisYear = item.year === thisYear;

          const bg        = isSelected ? ACTIVE_BG : 'transparent';
          const textColor = isSelected
            ? ACTIVE_TEXT
            : isThisYear
              ? thisYearClr
              : textMain;
          const secColor  = isSelected
            ? 'rgba(255,255,255,0.70)'
            : textSec;

          return (
            <Pressable
              key={item.anchor}
              onPress={() => onSelect(item.anchor)}
              style={({ pressed }) => [
                rowStyles.row,
                {
                  backgroundColor: isSelected
                    ? ACTIVE_BG
                    : pressed
                      ? rowPressed
                      : bg,
                  borderBottomColor: dividerClr,
                  borderBottomWidth: index < years.length - 1 ? 1 : 0,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Select year ${item.year}`}
            >
              <Text
                variant="h5"
                weight={isSelected || isThisYear ? 'semibold' : 'normal'}
                style={{ flex: 1, color: textColor }}
              >
                {item.label}
              </Text>

              {isThisYear && (
                <Text
                  variant="body-xs"
                  weight="medium"
                  style={{ color: secColor }}
                >
                  This year
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  },
);

YearPicker.displayName = 'YearPicker';

// ─── Styles ───────────────────────────────────────────────────────────────────

const rowStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   16,
    paddingHorizontal: 12,
    borderRadius:      8,
    minHeight:         56,
  },
});

const listStyles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
});
