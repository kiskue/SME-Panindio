/**
 * RawMaterialCard — 2025 Redesign
 *
 * Layout:
 *   [44×44 solid category icon]  Name          [Status chip]
 *                                Packaging / description
 *   ──────────────────────────────────────────────────────
 *   [████████░░░░░░░] 10px stock bar with min marker
 *   50 pcs · Min: 20 · ₱2.50/pc
 *   ──────────────────────────────────────────────────────
 *   [  Adjust Stock  ]    [  Edit  ]
 *
 * No left accent bar. Shadow-only depth. borderRadius 20.
 * Full dark/light mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Edit3, TrendingDown, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import type { RawMaterial, RawMaterialCategory } from '@/types';

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConf {
  label:   string;
  emoji:   string;
  color:   string;
}

const CATEGORY_CONFIG: Record<RawMaterialCategory | 'other', CategoryConf> = {
  packaging: { label: 'Packaging', emoji: '📦', color: '#6366F1' },
  cleaning:  { label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9' },
  utensils:  { label: 'Utensils',  emoji: '🍴', color: '#F59E0B' },
  office:    { label: 'Office',    emoji: '📎', color: '#8B5CF6' },
  other:     { label: 'Other',     emoji: '📋', color: '#64748B' },
};

// ─── Stock level helpers ──────────────────────────────────────────────────────

type StockLevel = 'healthy' | 'low' | 'out';

function getStockLevel(qty: number, min: number): StockLevel {
  if (qty <= 0)                     return 'out';
  if (min > 0 && qty <= min * 1.5)  return 'low';
  return 'healthy';
}

interface StockTheme {
  color:  string;
  bgLight: string;
  bgDark:  string;
  label:  string;
  Icon:   React.ComponentType<{ size: number; color: string }>;
}

function getStockTheme(level: StockLevel, isDark: boolean): StockTheme {
  if (level === 'out') return {
    color:   isDark ? '#FF6B6B' : '#EF4444',
    bgLight: '#FEE2E2',
    bgDark:  'rgba(239,68,68,0.15)',
    label:   'Out of Stock',
    Icon:    XCircle,
  };
  if (level === 'low') return {
    color:   isDark ? '#FFB020' : '#D97706',
    bgLight: '#FEF3C7',
    bgDark:  'rgba(255,176,32,0.15)',
    label:   'Low Stock',
    Icon:    AlertTriangle,
  };
  return {
    color:   isDark ? '#3DD68C' : '#16A34A',
    bgLight: '#DCFCE7',
    bgDark:  'rgba(61,214,140,0.15)',
    label:   'Healthy',
    Icon:    CheckCircle2,
  };
}

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RawMaterialCardProps {
  rawMaterial:    RawMaterial;
  onEdit?:        (material: RawMaterial) => void;
  onAdjustStock?: (material: RawMaterial) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RawMaterialCard: React.FC<RawMaterialCardProps> = React.memo(
  ({ rawMaterial, onEdit, onAdjustStock }) => {
    const theme      = useAppTheme();
    const mode       = useThemeStore(selectThemeMode);
    const isDark     = mode === 'dark';

    const catKey     = (rawMaterial.category ?? 'other') as RawMaterialCategory | 'other';
    const catConf    = CATEGORY_CONFIG[catKey];
    const level      = getStockLevel(rawMaterial.quantityInStock, rawMaterial.minimumStockLevel);
    const stockTheme = getStockTheme(level, isDark);
    const accent     = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

    // Progress bar 0–100%
    const progressPct = rawMaterial.minimumStockLevel > 0
      ? Math.min(rawMaterial.quantityInStock / (rawMaterial.minimumStockLevel * 3), 1)
      : rawMaterial.quantityInStock > 0 ? 1 : 0;

    // Min marker at 33%
    const minMarkerPct = rawMaterial.minimumStockLevel > 0 ? (1 / 3) : 0;

    const statusChipBg  = isDark ? stockTheme.bgDark : stockTheme.bgLight;
    const cardBg        = isDark ? '#1A2235' : '#FFFFFF';
    const dividerColor  = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
    const metaMuted     = isDark ? 'rgba(255,255,255,0.42)' : staticTheme.colors.gray[400];
    const stockBarTrack = isDark ? 'rgba(255,255,255,0.08)' : '#EEF2FF';

    const adjustBtnBg     = isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50];
    const adjustBtnBorder = isDark ? 'rgba(79,158,255,0.28)' : staticTheme.colors.primary[200];
    const editBtnBg       = isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50];
    const editBtnBorder   = isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200];

    const dynStyles = useMemo(() => StyleSheet.create({
      card: {
        backgroundColor: cardBg,
        shadowColor: isDark ? '#000' : '#64748B',
        shadowOpacity: isDark ? 0.40 : 0.10,
      },
      iconWrap: {
        backgroundColor: catConf.color,
      },
      statusChip: {
        backgroundColor: statusChipBg,
      },
      stockBarTrack: {
        backgroundColor: stockBarTrack,
      },
      divider: {
        backgroundColor: dividerColor,
      },
      adjustBtn: {
        backgroundColor: adjustBtnBg,
        borderColor:     adjustBtnBorder,
      },
      editBtn: {
        backgroundColor: editBtnBg,
        borderColor:     editBtnBorder,
      },
    }), [isDark, cardBg, catConf.color, statusChipBg, stockBarTrack, dividerColor, adjustBtnBg, adjustBtnBorder, editBtnBg, editBtnBorder]);

    return (
      <View style={[staticStyles.card, dynStyles.card]}>
        {/* ── Header row ── */}
        <View style={staticStyles.headerRow}>
          {/* 44×44 solid category icon */}
          <View style={[staticStyles.iconWrap, dynStyles.iconWrap]}>
            <Text style={staticStyles.iconEmoji}>{catConf.emoji}</Text>
          </View>

          {/* Name + subtitle */}
          <View style={staticStyles.titleGroup}>
            <Text
              variant="body"
              weight="semibold"
              style={{ color: theme.colors.text }}
              numberOfLines={1}
            >
              {rawMaterial.name}
            </Text>
            <Text
              variant="body-xs"
              style={{ color: theme.colors.textSecondary }}
              numberOfLines={1}
            >
              {rawMaterial.description ? rawMaterial.description : catConf.label}
            </Text>
          </View>

          {/* Status chip */}
          <View style={[staticStyles.statusChip, dynStyles.statusChip]}>
            <stockTheme.Icon size={10} color={stockTheme.color} />
            <Text variant="body-xs" weight="bold" style={{ color: stockTheme.color }}>
              {level === 'healthy' ? 'Healthy' : level === 'low' ? 'Low' : 'Out'}
            </Text>
          </View>
        </View>

        {/* ── Stock progress section ── */}
        <View style={staticStyles.stockSection}>
          {/* 10px bar */}
          <View style={[staticStyles.stockTrack, dynStyles.stockBarTrack]}>
            <View
              style={[
                staticStyles.stockFill,
                {
                  width:           `${Math.max(progressPct * 100, progressPct > 0 ? 4 : 0)}%` as `${number}%`,
                  backgroundColor: stockTheme.color,
                },
              ]}
            />
            {minMarkerPct > 0 ? (
              <View
                style={[
                  staticStyles.minMarker,
                  {
                    left:            `${minMarkerPct * 100}%` as `${number}%`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[300],
                  },
                ]}
              />
            ) : null}
          </View>

          {/* Inline meta row: qty · min · cost */}
          <View style={staticStyles.metaInlineRow}>
            <Text variant="body-xs" weight="bold" style={{ color: stockTheme.color }}>
              {rawMaterial.quantityInStock} {rawMaterial.unit}
            </Text>
            <Text variant="body-xs" style={{ color: metaMuted }}>{' · '}</Text>
            <Text variant="body-xs" style={{ color: metaMuted }}>
              Min {rawMaterial.minimumStockLevel}
            </Text>
            <Text variant="body-xs" style={{ color: metaMuted }}>{' · '}</Text>
            <Text variant="body-xs" weight="semibold" style={{ color: accent }}>
              {formatCurrency(rawMaterial.costPerUnit)}/{rawMaterial.unit}
            </Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={[staticStyles.divider, dynStyles.divider]} />

        {/* ── Action buttons ── */}
        <View style={staticStyles.actions}>
          {onAdjustStock ? (
            <Pressable
              style={({ pressed }) => [staticStyles.actionBtn, dynStyles.adjustBtn, pressed && staticStyles.pressed]}
              onPress={() => onAdjustStock(rawMaterial)}
            >
              <TrendingDown size={14} color={accent} />
              <Text variant="body-xs" weight="semibold" style={{ color: accent }}>
                Adjust Stock
              </Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              style={({ pressed }) => [staticStyles.actionBtn, dynStyles.editBtn, pressed && staticStyles.pressed]}
              onPress={() => onEdit(rawMaterial)}
            >
              <Edit3 size={14} color={theme.colors.textSecondary} />
              <Text variant="body-xs" weight="semibold" style={{ color: theme.colors.textSecondary }}>
                Edit
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  },
);
RawMaterialCard.displayName = 'RawMaterialCard';

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  card: {
    borderRadius:   20,
    overflow:       'hidden',
    shadowOffset:   { width: 0, height: 4 },
    shadowRadius:   16,
    elevation:      4,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:     staticTheme.spacing.md,
    paddingBottom:  staticTheme.spacing.sm + 2,
    gap:            staticTheme.spacing.sm + 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm + 2,
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  iconEmoji: {
    fontSize: 22,
  },
  titleGroup: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
  statusChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      staticTheme.borderRadius.full,
    flexShrink:        0,
  },
  stockSection: {
    gap: 7,
  },
  stockTrack: {
    height:       10,
    borderRadius: 5,
    overflow:     'hidden',
    position:     'relative',
  },
  stockFill: {
    position:     'absolute',
    left:         0,
    top:          0,
    height:       10,
    borderRadius: 5,
  },
  minMarker: {
    position: 'absolute',
    top:      0,
    width:    2,
    height:   10,
  },
  metaInlineRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
  },
  divider: {
    height: 1,
  },
  actions: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
  },
  actionBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: staticTheme.spacing.sm + 4,
    borderRadius:    staticTheme.borderRadius.full,
    borderWidth:     1,
    minHeight:       48,
  },
  pressed: {
    opacity:   0.70,
    transform: [{ scale: 0.97 }],
  },
});
