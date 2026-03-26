/**
 * BreakevenProgress — molecule
 *
 * Animated horizontal progress bar that visualises how close the business is
 * to reaching its breakeven point in units sold.
 *
 * - Green fill that animates in on mount
 * - Percentage label floating above the fill
 * - Unit count summary beneath the bar
 * - Overflow-safe: clamps fill to 100%
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed with _
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BreakevenProgressProps {
  unitsSold:      number;
  breakevenUnits: number;
  label?:         string;
  style?:         ViewStyle;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const DARK_TRACK_BG  = 'rgba(255,255,255,0.08)';
const DARK_CARD_BG   = '#151A27';

// ─── Component ────────────────────────────────────────────────────────────────

export const BreakevenProgress: React.FC<BreakevenProgressProps> = ({
  unitsSold,
  breakevenUnits,
  label,
  style,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const appTheme = useAppTheme();

  const rawRatio  = breakevenUnits > 0 ? unitsSold / breakevenUnits : 0;
  const ratio     = Math.min(rawRatio, 1);
  const pct       = Math.round(ratio * 100);
  const remaining = Math.max(0, breakevenUnits - unitsSold);

  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue:         ratio,
      duration:        800,
      useNativeDriver: false,
      delay:            200,
    }).start();
  }, [fillAnim, ratio]);

  const fillColor   = ratio >= 1
    ? (isDark ? '#3DD68C' : appTheme.colors.success[500])
    : ratio >= 0.5
    ? (isDark ? '#FFB020' : appTheme.colors.warning[500])
    : (isDark ? '#4F9EFF' : appTheme.colors.primary[500]);

  const trackBg     = isDark ? DARK_TRACK_BG : appTheme.colors.gray[200];
  const cardBg      = isDark ? DARK_CARD_BG  : appTheme.colors.surface;
  const textMain    = isDark ? '#F1F5F9'     : appTheme.colors.text;
  const textSec     = isDark ? '#94A3B8'     : appTheme.colors.textSecondary;

  const summaryText = ratio >= 1
    ? `You've reached breakeven! ${unitsSold.toLocaleString('en-PH')} units sold.`
    : `You've sold ${unitsSold.toLocaleString('en-PH')} units. Need ${remaining.toLocaleString('en-PH')} more to break even.`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: cardBg },
        style,
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text
          variant="body-sm"
          weight="semibold"
          style={{ color: textMain }}
        >
          {label ?? 'Breakeven Progress'}
        </Text>
        <View style={[styles.pctBadge, { backgroundColor: `${fillColor}1A` }]}>
          <Text variant="body-xs" weight="bold" style={{ color: fillColor }}>
            {pct}%
          </Text>
        </View>
      </View>

      {/* Track */}
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fillColor,
              width: fillAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }) as unknown as `${number}%`,
            },
          ]}
        />

        {/* Milestone marker at 100% */}
        <View style={[styles.milestone, { backgroundColor: fillColor }]} />
      </View>

      {/* Unit labels */}
      <View style={styles.unitRow}>
        <Text variant="body-xs" style={{ color: textSec }}>
          {unitsSold.toLocaleString('en-PH')} sold
        </Text>
        <Text variant="body-xs" style={{ color: textSec }}>
          Goal: {breakevenUnits.toLocaleString('en-PH')} units
        </Text>
      </View>

      {/* Summary sentence */}
      <Text
        variant="body-xs"
        weight="normal"
        style={{ color: textSec, marginTop: 8, lineHeight: 18 }}
      >
        {summaryText}
      </Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding:      14,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  pctBadge: {
    paddingVertical:   3,
    paddingHorizontal: 8,
    borderRadius:     20,
  },
  track: {
    height:       10,
    borderRadius:  5,
    overflow:     'hidden',
    position:     'relative',
  },
  fill: {
    height:       10,
    borderRadius:  5,
  },
  milestone: {
    position:     'absolute',
    right:         0,
    top:           0,
    bottom:        0,
    width:         2,
    borderRadius:  1,
  },
  unitRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:       6,
  },
});
