/**
 * StatusBadge — soft, rounded status pill.
 *
 * Consolidates the inline `<View style={pill}><Text>{status}</Text></View>`
 * pattern that was re-implemented across the suki and customer order screens.
 * It is purely presentational: pass the resolved colors (see
 * `verificationStatusColor` / `orderStatusColor` in `@/core/theme/statusColors`).
 *
 * Sizes match the existing pills exactly:
 *   sm — 8px horizontal padding, 10px text (compact list rows)
 *   md — 10px horizontal padding, 11px text (detail headers)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

export interface StatusBadgeProps {
  label:            string;
  backgroundColor:  string;
  textColor:        string;
  borderColor?:     string;
  icon?:            React.ReactNode;
  size?:            'sm' | 'md';
  style?:           ViewStyle;
}

const SIZE = {
  sm: { paddingHorizontal: 8,  fontSize: 10 },
  md: { paddingHorizontal: 10, fontSize: 11 },
} as const;

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  backgroundColor,
  textColor,
  borderColor,
  icon,
  size = 'md',
  style,
}) => {
  const s = SIZE[size];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor, paddingHorizontal: s.paddingHorizontal },
        borderColor !== undefined ? { borderWidth: 1, borderColor } : null,
        style,
      ]}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontSize: s.fontSize, fontWeight: '700', color: textColor }}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    alignSelf:       'flex-start',
    borderRadius:    20,
    paddingVertical: 3,
  },
});
