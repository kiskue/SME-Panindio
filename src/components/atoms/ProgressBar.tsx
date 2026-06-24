/**
 * ProgressBar — minimal track + fill bar.
 *
 * Consolidates the inline `<View track><View fill width="x%" /></View>` markup
 * repeated across the credit ranking cards and business-ROI mini bars.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { ViewStyle, DimensionValue } from 'react-native';

export interface ProgressBarProps {
  /** Fill fraction 0..1 (clamped). */
  fraction:   number;
  /** Fill color. */
  color:      string;
  /** Track (background) color. */
  trackColor: string;
  /** Bar height in px. Default 8. */
  height?:    number;
  /** Corner radius. Defaults to `height / 2`. */
  radius?:    number;
  style?:     ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  fraction,
  color,
  trackColor,
  height = 8,
  radius,
  style,
}) => {
  const r = radius ?? height / 2;
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` as DimensionValue;
  return (
    <View style={[styles.track, { height, borderRadius: r, backgroundColor: trackColor }, style]}>
      <View style={{ height, borderRadius: r, width, backgroundColor: color }} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
