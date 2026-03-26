/**
 * PeriodSelector — molecule
 *
 * A segmented-control / pill-tab row for selecting a dashboard time period
 * (Day | Week | Month | Year), plus an optional navigator row that lets
 * the user step backward and forward through specific periods.
 *
 * Two rendering modes:
 *
 *   Simple mode (no nav props):
 *     [ Day ]  [ Week ]  [ Month ]  [ Year ]
 *     Matches the original behaviour exactly — no change to existing callers.
 *
 *   Navigator mode (all nav props supplied):
 *     [ Day ]  [ Week ]  [ Month ]  [ Year ]
 *     [ <  ]   Mon, Mar 23  ▾  (or "Today")   [ > ]
 *
 * The period label in navigator mode is tappable. A chevron-down icon is
 * rendered inline so the user knows it opens a direct picker. Pass
 * `onLabelPress` to handle the tap — the parent is responsible for opening
 * the appropriate picker sheet.
 *
 * Design decisions:
 * - All four pills share the row equally (flex: 1) so the control is always
 *   full-width and touch targets stay large enough on every phone size.
 * - Active pill uses primary[500] fill + white text (brand blue on white/dark).
 * - Inactive pill uses a subtle tinted surface so the control reads as a
 *   single grouped unit without a hard container border.
 * - Press feedback: brief opacity drop (Pressable `pressed` state).
 * - Nav arrows use Lucide ChevronLeft / ChevronRight. The forward arrow is
 *   visually disabled (reduced opacity, non-interactive) when `canGoNext` is
 *   false, matching standard ERP "no future data" behaviour.
 * - Both light and dark tokens are self-contained — the caller passes `isDark`.
 *
 * TypeScript constraints:
 * - exactOptionalPropertyTypes: no explicit `undefined` on optional props.
 * - noUncheckedIndexedAccess: all palette accesses use numeric keys.
 */

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import type { DashboardPeriod } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PeriodSelectorProps {
  /** Currently active period type — controls which pill is highlighted. */
  period: DashboardPeriod;
  /** Called when the user taps a different pill. */
  onSelect: (period: DashboardPeriod) => void;
  /** Pass `true` when the parent is in dark mode. */
  isDark: boolean;
  // ── Navigator chrome (all three must be supplied to enable navigator mode) ──
  /** Human-readable label for the currently anchored period, e.g. "Today", "Mar 9 – Mar 15". */
  periodLabel?: string;
  /** Called when the user taps the left (previous) arrow. */
  onPrev?: () => void;
  /** Called when the user taps the right (next) arrow. */
  onNext?: () => void;
  /**
   * Whether forward navigation is allowed.
   * Pass `false` to disable the "next" arrow (prevents navigation into the
   * future when the anchor is already the current period).
   */
  canGoNext?: boolean;
  /**
   * Called when the user taps the period label text (the tappable area
   * between the prev/next arrows). Use this to open a direct picker sheet.
   * When omitted the label is non-interactive (no chevron indicator shown).
   */
  onLabelPress?: () => void;
}

// ─── Config ────────────────────────────────────────────────────────────────────

interface PeriodConfig {
  key:   DashboardPeriod;
  label: string;
  /** Short accessibility label — announced by screen readers. */
  a11y:  string;
}

const PERIODS: PeriodConfig[] = [
  { key: 'day',   label: 'Day',   a11y: 'Day view'   },
  { key: 'week',  label: 'Week',  a11y: 'Week view'  },
  { key: 'month', label: 'Month', a11y: 'Month view' },
  { key: 'year',  label: 'Year',  a11y: 'Year view'  },
];

// ─── Dark/light tokens ────────────────────────────────────────────────────────

// Active state is identical in both modes — brand primary fill.
const ACTIVE_BG    = staticTheme.colors.primary[500];
const ACTIVE_BORD  = staticTheme.colors.primary[500];
const ACTIVE_TEXT  = '#FFFFFF';

// Dark inactive
const DARK_INACTIVE_BG   = '#1E2435';
const DARK_INACTIVE_BORD = 'rgba(255,255,255,0.10)';
const DARK_INACTIVE_TEXT = '#94A3B8';

// Light inactive — a faint primary-tinted surface so the group reads as a unit
const LIGHT_INACTIVE_BG   = staticTheme.colors.primary[50];
const LIGHT_INACTIVE_BORD = staticTheme.colors.primary[100];
const LIGHT_INACTIVE_TEXT = staticTheme.colors.gray[500];

// Navigator row tokens
const DARK_NAV_BG      = '#1E2435';
const DARK_NAV_BORDER  = 'rgba(255,255,255,0.10)';
const DARK_NAV_TEXT    = '#F1F5F9';
const DARK_ARROW_CLR   = '#94A3B8';
const LIGHT_NAV_BG     = staticTheme.colors.primary[50];
const LIGHT_NAV_BORDER = staticTheme.colors.primary[100];
const LIGHT_NAV_TEXT   = staticTheme.colors.gray[800];
const LIGHT_ARROW_CLR  = staticTheme.colors.gray[500];

// Label tap indicator — underline colour matches the label text colour.
const DARK_UNDERLINE  = 'rgba(241,245,249,0.30)';
const LIGHT_UNDERLINE = 'rgba(31,41,55,0.25)'; // gray[800] at low opacity

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders four period pills (Day / Week / Month / Year) in a full-width row.
 * When `periodLabel`, `onPrev`, `onNext`, and `canGoNext` are all supplied,
 * a navigator row (< label >) is rendered immediately below the pills.
 * When `onLabelPress` is also supplied the label becomes tappable with a
 * chevron-down icon as a tap affordance.
 */
export const PeriodSelector = React.memo<PeriodSelectorProps>(
  ({ period, onSelect, isDark, periodLabel, onPrev, onNext, canGoNext, onLabelPress }) => {
    // Navigator mode is active only when all nav props are provided.
    const navMode = periodLabel !== undefined && onPrev !== undefined
      && onNext !== undefined && canGoNext !== undefined;

    const inactiveBg   = isDark ? DARK_INACTIVE_BG   : LIGHT_INACTIVE_BG;
    const inactiveBord = isDark ? DARK_INACTIVE_BORD : LIGHT_INACTIVE_BORD;
    const inactiveText = isDark ? DARK_INACTIVE_TEXT : LIGHT_INACTIVE_TEXT;

    const navBg        = isDark ? DARK_NAV_BG      : LIGHT_NAV_BG;
    const navBorder    = isDark ? DARK_NAV_BORDER  : LIGHT_NAV_BORDER;
    const navText      = isDark ? DARK_NAV_TEXT    : LIGHT_NAV_TEXT;
    const arrowClr     = isDark ? DARK_ARROW_CLR   : LIGHT_ARROW_CLR;
    const underlineClr = isDark ? DARK_UNDERLINE   : LIGHT_UNDERLINE;

    const handlePress = useCallback(
      (key: DashboardPeriod) => () => onSelect(key),
      [onSelect],
    );

    // canGoNext defaults to false when not in navigator mode — arrow simply
    // won't be rendered, so the value is irrelevant, but TypeScript needs a
    // concrete boolean for the disabled check.
    const nextEnabled = canGoNext ?? false;

    // Whether the label is interactive.
    const labelTappable = onLabelPress !== undefined;

    return (
      <View style={styles.container}>
        {/* ── Period pills row ── */}
        <View style={styles.row} accessibilityRole="tablist">
          {PERIODS.map(p => {
            const isActive = p.key === period;
            const bg    = isActive ? ACTIVE_BG    : inactiveBg;
            const bord  = isActive ? ACTIVE_BORD  : inactiveBord;
            const tclr  = isActive ? ACTIVE_TEXT  : inactiveText;

            return (
              <Pressable
                key={p.key}
                onPress={handlePress(p.key)}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: bg,
                    borderColor:     bord,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityLabel={p.a11y}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  variant="body-sm"
                  weight={isActive ? 'semibold' : 'medium'}
                  style={{ color: tclr }}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Navigator row — rendered only in navigator mode ── */}
        {navMode && (
          <View
            style={[
              styles.navRow,
              {
                backgroundColor: navBg,
                borderColor:     navBorder,
              },
            ]}
          >
            {/* Previous arrow */}
            <Pressable
              onPress={onPrev}
              style={({ pressed }) => [styles.navArrow, { opacity: pressed ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Previous period"
            >
              <ChevronLeft size={18} color={arrowClr} strokeWidth={2.5} />
            </Pressable>

            {/* Period label — tappable when `onLabelPress` is provided */}
            {labelTappable ? (
              <Pressable
                onPress={onLabelPress}
                style={({ pressed }) => [
                  styles.navLabelBtn,
                  { opacity: pressed ? 0.70 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${period} picker — currently ${periodLabel}`}
                hitSlop={6}
              >
                <Text
                  variant="body-sm"
                  weight="semibold"
                  style={[
                    styles.navLabelText,
                    {
                      color:           navText,
                      borderBottomColor: underlineClr,
                      borderBottomWidth: 1,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {periodLabel}
                </Text>
                <ChevronDown size={13} color={arrowClr} strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Text
                variant="body-sm"
                weight="semibold"
                style={[styles.navLabel, { color: navText }]}
                numberOfLines={1}
              >
                {periodLabel}
              </Text>
            )}

            {/* Next arrow — disabled when canGoNext is false */}
            <Pressable
              onPress={nextEnabled ? onNext : undefined}
              style={({ pressed }) => [
                styles.navArrow,
                { opacity: !nextEnabled ? 0.28 : pressed ? 0.5 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: !nextEnabled }}
            >
              <ChevronRight size={18} color={arrowClr} strokeWidth={2.5} />
            </Pressable>
          </View>
        )}
      </View>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap:           6,
  },
  pill: {
    flex:              1,
    paddingVertical:   9,
    paddingHorizontal: 4,
    borderRadius:      20,
    borderWidth:       1,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         38,
  },
  navRow: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   12,
    borderWidth:    1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minHeight:      38,
  },
  navArrow: {
    width:           38,
    height:          38,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    8,
  },
  // Used when the label is NOT tappable — retains the original layout.
  navLabel: {
    flex:       1,
    textAlign:  'center',
  },
  // Used when the label IS tappable — wraps text + chevron icon side by side.
  navLabelBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    paddingVertical: 4,
  },
  navLabelText: {
    textAlign: 'center',
  },
});
