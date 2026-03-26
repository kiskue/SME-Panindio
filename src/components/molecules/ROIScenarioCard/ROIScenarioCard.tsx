/**
 * ROIScenarioCard — molecule
 *
 * Displays a single ROI scenario (Current / Optimistic / Conservative) as a
 * compact vertical card. Highlighted variant applies a coloured border and
 * slight scale elevation for the "Current" or recommended scenario.
 *
 * TypeScript constraints: exactOptionalPropertyTypes, noUncheckedIndexedAccess.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import type { ROIRiskLevel } from '@/types/roi.types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ROIScenarioCardProps {
  label:            string;
  roi:              number;
  breakevenMonths:  number;
  unitsNeeded:      number;
  grossMargin:      number;
  riskLevel:        ROIRiskLevel;
  isHighlighted?:   boolean;
  style?:           ViewStyle;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const DARK_CARD_BG = '#1A2235';
const DARK_BORDER  = 'rgba(255,255,255,0.08)';

function riskColor(level: ROIRiskLevel, isDark: boolean): string {
  switch (level) {
    case 'low':    return isDark ? '#3DD68C' : '#27AE60';
    case 'medium': return isDark ? '#FFB020' : '#F5A623';
    case 'high':   return isDark ? '#FF6B6B' : '#FF3B30';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ROIScenarioCard: React.FC<ROIScenarioCardProps> = ({
  label,
  roi,
  breakevenMonths,
  unitsNeeded,
  grossMargin,
  riskLevel,
  isHighlighted = false,
  style,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const appTheme = useAppTheme();

  const accent     = riskColor(riskLevel, isDark);
  const cardBg     = isDark ? DARK_CARD_BG : appTheme.colors.surface;
  const border     = isHighlighted ? accent : (isDark ? DARK_BORDER : appTheme.colors.border);
  const labelColor = isDark ? 'rgba(148,163,184,0.80)' : appTheme.colors.textSecondary;
  const valueColor = isDark ? '#F1F5F9' : appTheme.colors.text;

  // ROI icon
  const TrendIcon = roi > 0 ? TrendingUp : roi < 0 ? TrendingDown : Minus;
  const trendColor = roi > 20
    ? (isDark ? '#3DD68C' : '#27AE60')
    : roi > 0
    ? (isDark ? '#FFB020' : '#F5A623')
    : (isDark ? '#FF6B6B' : '#FF3B30');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor:     border,
          borderWidth:     isHighlighted ? 2 : 1,
          shadowColor:     isHighlighted ? accent : '#1E4D8C',
          shadowOpacity:   isHighlighted ? 0.20 : 0.06,
        },
        style,
      ]}
    >
      {/* Accent top bar */}
      <View style={[styles.topBar, { backgroundColor: accent }]} />

      {/* Label */}
      <Text
        variant="body-xs"
        weight="semibold"
        style={[styles.label, { color: isDark ? 'rgba(148,163,184,0.70)' : appTheme.colors.gray[500] }]}
      >
        {label.toUpperCase()}
      </Text>

      {/* ROI percentage */}
      <View style={styles.roiRow}>
        <TrendIcon size={16} color={trendColor} />
        <Text
          variant="h4"
          weight="bold"
          style={{ color: trendColor, marginLeft: 4 }}
        >
          {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
        </Text>
      </View>

      <Text
        variant="body-xs"
        weight="normal"
        style={{ color: labelColor, marginBottom: 2 }}
      >
        Annual ROI
      </Text>

      <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : appTheme.colors.borderSubtle }]} />

      {/* Metric rows */}
      <MetricRow
        label="Break-even"
        value={`${breakevenMonths}mo`}
        valueColor={valueColor}
        labelColor={labelColor}
      />
      <MetricRow
        label="Units/mo"
        value={unitsNeeded.toLocaleString()}
        valueColor={valueColor}
        labelColor={labelColor}
      />
      <MetricRow
        label="Gross margin"
        value={`${grossMargin.toFixed(1)}%`}
        valueColor={grossMargin >= 20 ? (isDark ? '#3DD68C' : '#27AE60') : (isDark ? '#FFB020' : '#F5A623')}
        labelColor={labelColor}
      />

      {/* Risk badge */}
      <View style={[styles.riskBadge, { backgroundColor: `${accent}1A` }]}>
        <Text
          variant="body-xs"
          weight="semibold"
          style={{ color: accent }}
        >
          {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
        </Text>
      </View>
    </View>
  );
};

// ─── MetricRow ────────────────────────────────────────────────────────────────

interface MetricRowProps {
  label:      string;
  value:      string;
  valueColor: string;
  labelColor: string;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, valueColor, labelColor }) => (
  <View style={styles.metricRow}>
    <Text variant="body-xs" style={{ color: labelColor, flex: 1 }}>
      {label}
    </Text>
    <Text variant="body-xs" weight="semibold" style={{ color: valueColor }}>
      {value}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex:          1,
    borderRadius:  16,
    overflow:      'hidden',
    paddingBottom: 12,
    shadowOffset:  { width: 0, height: 2 },
    shadowRadius:  8,
    elevation:     4,
  },
  topBar: {
    height: 4,
  },
  label: {
    paddingTop:        12,
    paddingHorizontal: 12,
    letterSpacing:      0.5,
    marginBottom:       6,
  },
  roiRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 12,
    marginBottom:    2,
  },
  divider: {
    height:           1,
    marginHorizontal: 12,
    marginVertical:    8,
  },
  metricRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 12,
    marginBottom:      4,
  },
  riskBadge: {
    marginHorizontal:  12,
    marginTop:          8,
    paddingVertical:    4,
    paddingHorizontal: 10,
    borderRadius:      20,
    alignSelf:        'flex-start',
  },
});
