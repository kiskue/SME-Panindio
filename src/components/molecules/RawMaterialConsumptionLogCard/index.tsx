/**
 * RawMaterialConsumptionLogCard
 *
 * Displays a single raw material consumption event.
 *
 * Layout:
 *   [reason icon pill]  Material name        [reason badge]
 *                       qty + unit · date/time
 *   notes (if any)
 *
 * No left accent bar — matches RawMaterialCard design language
 * (borderRadius 20, shadow only, no colored bar).
 *
 * Reason badge colors:
 *   waste      → red    (#EF4444)
 *   adjustment → amber  (#F59E0B)
 *   production → blue   (primary[500])
 *   sale       → green  (success[500])
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Trash2,
  SlidersHorizontal,
  Factory,
  ShoppingCart,
  Package,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import type { RawMaterialReason, RawMaterialConsumptionLogDetail } from '@/types';

// ─── Reason config ────────────────────────────────────────────────────────────

interface ReasonConf {
  label:   string;
  color:   string;
  darkClr: string;
  Icon:    React.ComponentType<{ size: number; color: string }>;
}

const DARK_ACCENT = '#4F9EFF';
const DARK_RED    = '#FF6B6B';
const DARK_AMBER  = '#FFB020';
const DARK_GREEN  = '#3DD68C';

const REASON_CONFIG: Record<RawMaterialReason, ReasonConf> = {
  waste:      { label: 'Waste',      color: '#EF4444', darkClr: DARK_RED,   Icon: Trash2            },
  adjustment: { label: 'Adjustment', color: '#F59E0B', darkClr: DARK_AMBER, Icon: SlidersHorizontal },
  production: { label: 'Production', color: staticTheme.colors.primary[500], darkClr: DARK_ACCENT, Icon: Factory },
  sale:       { label: 'Sale',       color: staticTheme.colors.success[500], darkClr: DARK_GREEN,  Icon: ShoppingCart },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${date} · ${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RawMaterialConsumptionLogCardProps {
  item:   RawMaterialConsumptionLogDetail;
  isDark: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RawMaterialConsumptionLogCard: React.FC<RawMaterialConsumptionLogCardProps> =
  React.memo(({ item, isDark }) => {
    const conf      = REASON_CONFIG[item.reason] ?? REASON_CONFIG['adjustment'];
    const reasonClr = isDark ? conf.darkClr : conf.color;
    const ReasonIcon = conf.Icon;

    const totalCost = Math.abs(item.quantityUsed) * item.costPerUnit;

    const cardBg    = isDark ? '#1A2235' : '#FFFFFF';
    const textMain  = isDark ? '#FFFFFF' : staticTheme.colors.gray[800];
    const textMuted = isDark ? 'rgba(255,255,255,0.42)' : staticTheme.colors.gray[500];

    const dynStyles = useMemo(() => StyleSheet.create({
      card: {
        backgroundColor: cardBg,
        borderColor:     isDark ? `${reasonClr}22` : `${reasonClr}20`,
        shadowColor:     isDark ? '#000' : '#64748B',
        shadowOpacity:   isDark ? 0.35 : 0.08,
      },
      iconWrap: {
        backgroundColor: `${reasonClr}18`,
      },
      reasonBadge: {
        backgroundColor: `${reasonClr}15`,
        borderColor:     `${reasonClr}30`,
      },
    }), [isDark, cardBg, reasonClr]);

    return (
      <View style={[staticStyles.card, dynStyles.card]}>
        {/* Header row */}
        <View style={staticStyles.headerRow}>
          {/* Reason icon pill */}
          <View style={[staticStyles.iconWrap, dynStyles.iconWrap]}>
            <ReasonIcon size={16} color={reasonClr} />
          </View>

          {/* Name + meta */}
          <View style={staticStyles.nameWrap}>
            <Text
              variant="body"
              weight="semibold"
              style={{ color: textMain }}
              numberOfLines={1}
            >
              {item.rawMaterialName}
            </Text>
            <View style={staticStyles.metaRow}>
              <Package size={10} color={textMuted} />
              <Text variant="body-xs" style={{ color: textMuted }}>
                {Math.abs(item.quantityUsed)} {item.unit}
              </Text>
              {totalCost > 0 && (
                <>
                  <Text variant="body-xs" style={{ color: textMuted }}> · </Text>
                  <Text variant="body-xs" weight="medium" style={{ color: reasonClr }}>
                    {formatCurrency(totalCost)}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Reason badge */}
          <View style={[staticStyles.reasonBadge, dynStyles.reasonBadge]}>
            <Text variant="body-xs" weight="bold" style={{ color: reasonClr }}>
              {conf.label}
            </Text>
          </View>
        </View>

        {/* Date/time row */}
        <View style={staticStyles.footerRow}>
          <Text variant="body-xs" style={{ color: textMuted }}>
            {formatDateTime(item.consumedAt)}
          </Text>
          {item.referenceId !== undefined && (
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={1}>
              Ref: {item.referenceId.slice(-8)}
            </Text>
          )}
        </View>

        {/* Notes */}
        {item.notes !== undefined && item.notes.length > 0 && (
          <View style={[staticStyles.notesRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]}>
            <Text variant="body-xs" style={{ color: textMuted }} numberOfLines={2}>
              {item.notes}
            </Text>
          </View>
        )}
      </View>
    );
  });

RawMaterialConsumptionLogCard.displayName = 'RawMaterialConsumptionLogCard';

// ─── Static styles (layout only) ──────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  card: {
    borderRadius:      20,
    overflow:          'hidden',
    shadowOffset:      { width: 0, height: 3 },
    shadowRadius:      12,
    elevation:         3,
    borderWidth:       1,
    marginHorizontal:  staticTheme.spacing.md,
    marginVertical:    5,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm + 2,
    gap:               staticTheme.spacing.xs + 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  iconWrap: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  nameWrap: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    flexWrap:      'wrap',
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    flexShrink:        0,
  },
  footerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            staticTheme.spacing.sm,
  },
  notesRow: {
    borderTopWidth: 1,
    paddingTop:     staticTheme.spacing.xs + 2,
  },
});
