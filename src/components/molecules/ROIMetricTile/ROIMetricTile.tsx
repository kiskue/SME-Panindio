/**
 * ROIMetricTile — molecule
 *
 * A compact metric display tile used in the Business ROI Overview screen.
 * Renders a label, a large primary value, an optional sub-value, and an
 * optional trend arrow (up / down / neutral).
 *
 * Highlight variant applies a coloured background and border so the tile
 * visually stands out — used for "Total Investment" and "Net Profit" totals.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array/object access
 *   - noUnusedLocals/Parameters: unused vars prefixed with _
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ROIMetricTileProps {
  label:      string;
  value:      string;
  subValue?:  string;
  trend?:     'up' | 'down' | 'neutral';
  highlight?: boolean;
  /** Accent colour for icon, value text (when not highlighted), and trend */
  color?:     string;
  style?:     ViewStyle;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const DARK_CARD_BG      = '#151A27';
const DARK_HIGHLIGHT_BG = '#1A2235';
const DARK_BORDER       = 'rgba(255,255,255,0.08)';

// ─── Component ────────────────────────────────────────────────────────────────

export const ROIMetricTile: React.FC<ROIMetricTileProps> = ({
  label,
  value,
  subValue,
  trend,
  highlight = false,
  color,
  style,
}) => {
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const appTheme = useAppTheme();

  const accentColor  = color ?? (isDark ? '#4F9EFF' : appTheme.colors.primary[500]);
  const cardBg       = highlight
    ? (isDark ? DARK_HIGHLIGHT_BG : `${accentColor}0D`)
    : (isDark ? DARK_CARD_BG : appTheme.colors.surface);
  const borderColor  = highlight
    ? accentColor
    : (isDark ? DARK_BORDER : appTheme.colors.border);
  const borderWidth  = highlight ? 1.5 : 1;
  const labelColor   = isDark ? 'rgba(148,163,184,0.80)' : appTheme.colors.textSecondary;
  const valueColor   = highlight ? accentColor : (isDark ? '#F1F5F9' : appTheme.colors.text);
  const subColor     = isDark ? 'rgba(148,163,184,0.60)' : appTheme.colors.gray[400];

  const TrendIcon =
    trend === 'up'   ? TrendingUp   :
    trend === 'down' ? TrendingDown :
    Minus;

  const trendColor =
    trend === 'up'      ? (isDark ? '#3DD68C' : appTheme.colors.success[500]) :
    trend === 'down'    ? (isDark ? '#FF6B6B' : appTheme.colors.error[500])   :
    (isDark ? '#94A3B8' : appTheme.colors.gray[400]);

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: cardBg,
          borderColor:     borderColor,
          borderWidth,
        },
        style,
      ]}
    >
      {/* Top accent dot */}
      {highlight && (
        <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
      )}

      {/* Label */}
      <Text
        variant="body-xs"
        weight="medium"
        style={{ color: labelColor, marginBottom: 4 }}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* Value + trend row */}
      <View style={styles.valueRow}>
        <Text
          variant="h5"
          weight="bold"
          style={{ color: valueColor, flex: 1 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>

        {trend !== undefined && (
          <View style={[styles.trendPill, { backgroundColor: `${trendColor}1A` }]}>
            <TrendIcon size={12} color={trendColor} />
          </View>
        )}
      </View>

      {/* Sub-value */}
      {subValue !== undefined && (
        <Text
          variant="body-xs"
          weight="normal"
          style={{ color: subColor, marginTop: 2 }}
          numberOfLines={1}
        >
          {subValue}
        </Text>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tile: {
    borderRadius:   12,
    padding:        12,
    overflow:       'hidden',
  },
  accentDot: {
    position:     'absolute',
    top:          10,
    right:        10,
    width:         6,
    height:        6,
    borderRadius:  3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  2,
  },
  trendPill: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    marginLeft:      6,
  },
});
