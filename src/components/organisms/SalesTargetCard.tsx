/**
 * SalesTargetCard — organism
 *
 * Dashboard card for the Sales Target feature.
 *
 * Displays:
 *   - Today's net income progress vs daily target (progress bar + ₱ amounts)
 *   - Units needed per day to hit the target (with net income per unit context)
 *   - Weekly and monthly target summary rows
 *   - A "Set Target" / "Edit Target" button that opens SalesTargetSetupSheet
 *
 * Empty state:
 *   When `dailyTarget === 0` (not yet configured), shows a gentle CTA to
 *   configure the target without cluttering the dashboard.
 *
 * Respects dark mode via isDark prop (same pattern as other dashboard cards).
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: conditional spread on optional props.
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array access.
 *   - noUnusedLocals/Parameters: unused vars prefixed with _.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  Target,
  ChevronRight,
  TrendingUp,
  Package,
  Settings2,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { BottomSheet } from '@/components/organisms/BottomSheet';
import type { BottomSheetHandle } from '@/components/organisms/BottomSheet';
import { SalesTargetSetupSheet } from '@/components/molecules/SalesTargetSetupSheet';
import { theme as staticTheme } from '@/core/theme';
import {
  useSalesTargetStore,
  selectDailyTarget,
  selectWeeklyTarget,
  selectMonthlyTarget,
  selectUnitsNeededPerDay,
  selectNetIncomePerUnit,
  selectSalesTargetConfigured,
  selectDailyProgressPct,
  selectDailyProgressActual,
  selectDailyUnitsSold,
  selectWeeklyProgressActual,
  selectWeeklyProgressPct,
  selectMonthlyProgressActual,
  selectMonthlyProgressPct,
} from '@/store/sales_target.store';
import { useState } from 'react';


// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

const ACCENT = '#F59E0B'; // amber — Target icon colour

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (!isFinite(value)) return '—';
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function clampPct(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ProgressBarProps {
  percentage: number;
  isDark:     boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, isDark }) => {
  const clamped  = clampPct(percentage);
  const trackBg  = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];
  const fillColor = clamped >= 100
    ? staticTheme.colors.success[500]
    : clamped >= 60
    ? ACCENT
    : staticTheme.colors.primary[500];

  return (
    <View style={[progressStyles.track, { backgroundColor: trackBg }]}>
      <View
        style={[
          progressStyles.fill,
          {
            width:           `${clamped}%` as `${number}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
};

const progressStyles = StyleSheet.create({
  track: {
    height:       8,
    borderRadius: 4,
    overflow:     'hidden',
    marginTop:    8,
    marginBottom:  4,
  },
  fill: {
    height:       8,
    borderRadius: 4,
  },
});

interface SummaryRowProps {
  label:  string;
  target: number;
  actual: number;
  pct:    number;
  isDark: boolean;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, target, actual, pct, isDark }) => {
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const clamped  = clampPct(pct);
  const pctColor = clamped >= 100
    ? staticTheme.colors.success[500]
    : clamped >= 60
    ? ACCENT
    : staticTheme.colors.primary[500];

  return (
    <View style={summaryStyles.row}>
      <Text variant="body-xs" style={{ color: textSec, width: 54 }}>{label}</Text>
      <View style={summaryStyles.bar}>
        <View style={[summaryStyles.track, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100] }]}>
          <View
            style={[
              summaryStyles.fill,
              {
                width:           `${clamped}%` as `${number}%`,
                backgroundColor: pctColor,
              },
            ]}
          />
        </View>
      </View>
      <Text variant="body-xs" weight="medium" style={{ color: pctColor, width: 36, textAlign: 'right' }}>
        {clamped}%
      </Text>
      <Text variant="body-xs" style={{ color: textSec, marginLeft: 6 }}>
        {formatCurrency(actual)} / {formatCurrency(target)}
      </Text>
    </View>
  );
};

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:   6,
  },
  bar: {
    flex:          1,
    marginHorizontal: 8,
  },
  track: {
    height:       5,
    borderRadius: 3,
    overflow:     'hidden',
  },
  fill: {
    height:       5,
    borderRadius: 3,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalesTargetCardProps {
  isDark: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SalesTargetCard = React.memo<SalesTargetCardProps>(({ isDark }) => {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const dailyTarget      = useSalesTargetStore(selectDailyTarget);
  const weeklyTarget     = useSalesTargetStore(selectWeeklyTarget);
  const monthlyTarget    = useSalesTargetStore(selectMonthlyTarget);
  const unitsPerDay      = useSalesTargetStore(selectUnitsNeededPerDay);
  const netIncomePerUnit = useSalesTargetStore(selectNetIncomePerUnit);
  const isConfigured     = useSalesTargetStore(selectSalesTargetConfigured);

  const dailyPercentage  = useSalesTargetStore(selectDailyProgressPct);
  const dailyActual      = useSalesTargetStore(selectDailyProgressActual);
  const dailyUnitsSold   = useSalesTargetStore(selectDailyUnitsSold);
  const weeklyActual     = useSalesTargetStore(selectWeeklyProgressActual);
  const weeklyPercentage = useSalesTargetStore(selectWeeklyProgressPct);
  const monthlyActual    = useSalesTargetStore(selectMonthlyProgressActual);
  const monthlyPercentage = useSalesTargetStore(selectMonthlyProgressPct);

  const openSheet  = useCallback(() => setSheetVisible(true),  []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  // ── Empty / unconfigured state ─────────────────────────────────────────────
  if (!isConfigured) {
    return (
      <>
        <Pressable
          onPress={openSheet}
          style={({ pressed }) => [
            cardStyles.card,
            {
              backgroundColor: cardBg,
              borderColor:     border,
              opacity: pressed ? 0.88 : 1,
              ...(isDark ? {} : staticTheme.shadows.sm),
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Configure your daily sales target"
        >
          <View style={[cardStyles.accentBar, { backgroundColor: ACCENT }]} />
          <View style={cardStyles.emptyInner}>
            <View style={[cardStyles.iconPill, { backgroundColor: `${ACCENT}1A` }]}>
              <Target size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                Sales Target
              </Text>
              <Text variant="body-xs" style={{ color: textSec, marginTop: 2 }}>
                Set a daily income goal and track your progress
              </Text>
            </View>
            <View style={[cardStyles.ctaChip, { backgroundColor: `${ACCENT}1A` }]}>
              <Text variant="body-xs" weight="semibold" style={{ color: ACCENT }}>
                Set Target
              </Text>
              <ChevronRight size={12} color={ACCENT} />
            </View>
          </View>
        </Pressable>

        <BottomSheet
          ref={sheetRef}
          visible={sheetVisible}
          onClose={closeSheet}
          title="Sales Target"
          defaultSnapPoint="90%"
          showCloseButton
          scrollable={true}
        >
         <SalesTargetSetupSheet onClose={closeSheet} />
        </BottomSheet>
      </>
    );
  }

  // ── Configured state ───────────────────────────────────────────────────────
  const todayPct   = clampPct(dailyPercentage);
  const todayActual = dailyActual;
  const todayGap   = Math.max(0, dailyTarget - todayActual);

  const isOnTrack  = todayActual >= dailyTarget;
  const statusColor = isOnTrack
    ? staticTheme.colors.success[500]
    : ACCENT;

  return (
    <>
      <View
        style={[
          cardStyles.card,
          {
            backgroundColor: cardBg,
            borderColor:     border,
            ...(isDark ? {} : staticTheme.shadows.sm),
          },
        ]}
      >
        {/* Left accent bar */}
        <View style={[cardStyles.accentBar, { backgroundColor: ACCENT }]} />

        <View style={cardStyles.inner}>
          {/* ── Header row ── */}
          <View style={cardStyles.headerRow}>
            <View style={[cardStyles.iconPill, { backgroundColor: `${ACCENT}1A` }]}>
              <Target size={16} color={ACCENT} />
            </View>
            <Text
              variant="h6"
              weight="semibold"
              style={{ flex: 1, marginLeft: 8, color: textMain }}
            >
              Sales Target
            </Text>
            {/* Status chip */}
            <View style={[cardStyles.statusChip, { backgroundColor: `${statusColor}1A` }]}>
              <TrendingUp size={10} color={statusColor} />
              <Text variant="body-xs" weight="semibold" style={{ color: statusColor, marginLeft: 3 }}>
                {isOnTrack ? 'On Track' : `${todayPct}% today`}
              </Text>
            </View>
            {/* Edit button */}
            <Pressable
              onPress={openSheet}
              style={({ pressed }) => [
                cardStyles.editBtn,
                {
                  backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100],
                  opacity: pressed ? 0.6 : 1,
                  marginLeft: 6,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Edit sales target"
              hitSlop={8}
            >
              <Settings2 size={14} color={textSec} />
            </Pressable>
          </View>

          {/* ── Daily progress ── */}
          <View style={{ marginTop: 8 }}>
            <View style={cardStyles.amountRow}>
              <View>
                <Text variant="body-xs" style={{ color: textSec }}>
                  Today's net income
                </Text>
                <Text variant="h5" weight="bold" style={{ color: textMain, marginTop: 1 }}>
                  {formatCurrency(todayActual)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="body-xs" style={{ color: textSec }}>
                  Target
                </Text>
                <Text variant="body-sm" weight="semibold" style={{ color: ACCENT }}>
                  {formatCurrency(dailyTarget)}
                </Text>
              </View>
            </View>

            <ProgressBar percentage={todayPct} isDark={isDark} />

            {/* Gap / surplus label */}
            <Text variant="body-xs" style={{ color: textSec, marginTop: 2 }}>
              {isOnTrack
                ? `Target reached! +${formatCurrency(todayActual - dailyTarget)} surplus`
                : `${formatCurrency(todayGap)} remaining to hit today's target`}
            </Text>
          </View>

          {/* ── Units needed ── */}
          {unitsPerDay > 0 && (
            <View
              style={[
                cardStyles.unitsRow,
                { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[50], borderColor: border },
              ]}
            >
              <Package size={14} color={ACCENT} />
              <Text variant="body-xs" style={{ color: textSec, marginLeft: 6, flex: 1 }}>
                Sell{' '}
                <Text variant="body-xs" weight="bold" style={{ color: textMain }}>
                  {unitsPerDay} unit{unitsPerDay !== 1 ? 's' : ''}/day
                </Text>
                {netIncomePerUnit > 0 && (
                  <Text variant="body-xs" style={{ color: textSec }}>
                    {' '}at {formatCurrency(netIncomePerUnit)}/unit margin
                  </Text>
                )}
              </Text>
              <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                {dailyUnitsSold}/{unitsPerDay} sold
              </Text>
            </View>
          )}

          {/* ── Weekly / Monthly summary ── */}
          <View style={[cardStyles.summarySection, { borderTopColor: isDark ? DARK_BORDER : staticTheme.colors.gray[100] }]}>
            <SummaryRow
              label="Weekly"
              target={weeklyTarget}
              actual={weeklyActual}
              pct={weeklyPercentage}
              isDark={isDark}
            />
            <SummaryRow
              label="Monthly"
              target={monthlyTarget}
              actual={monthlyActual}
              pct={monthlyPercentage}
              isDark={isDark}
            />
          </View>
        </View>
      </View>

      <BottomSheet
        ref={sheetRef}
        visible={sheetVisible}
        onClose={closeSheet}
        title="Sales Target"
        defaultSnapPoint="75%"
        showCloseButton
      
      >
        <SalesTargetSetupSheet onClose={closeSheet} />
      </BottomSheet>
    </>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    borderRadius:  12,
    borderWidth:   1,
    flexDirection: 'row',
    overflow:      'hidden',
    marginBottom:  16,
  },
  accentBar: {
    width: 3,
  },
  inner: {
    flex:    1,
    padding: 14,
  },
  emptyInner: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  iconPill: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statusChip: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:   3,
    paddingHorizontal: 7,
    borderRadius:     20,
  },
  editBtn: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  ctaChip: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:   5,
    paddingHorizontal: 10,
    borderRadius:     20,
    gap:               3,
  },
  amountRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  unitsRow: {
    flexDirection:    'row',
    alignItems:       'center',
    borderRadius:     8,
    borderWidth:      1,
    paddingHorizontal: 10,
    paddingVertical:    8,
    marginTop:          10,
  },
  summarySection: {
    marginTop:     12,
    paddingTop:    12,
    borderTopWidth: 1,
  },
});
