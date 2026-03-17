/**
 * RawMaterialCard — Premium Redesign
 *
 * Layout:
 *   [Left accent bar][Category icon pill][Name + description][Status chip]
 *   [Thick 8px stock progress bar with min marker]
 *   [Stock qty · cost/unit · total value]
 *   [Adjust Stock btn] [Edit btn]
 *
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
  lightBg: string;
  darkBg:  string;
}

const CATEGORY_CONFIG: Record<RawMaterialCategory | 'other', CategoryConf> = {
  packaging: { label: 'Packaging', emoji: '📦', color: '#6366F1', lightBg: '#EEF2FF', darkBg: 'rgba(99,102,241,0.18)'  },
  cleaning:  { label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9', lightBg: '#E0F2FE', darkBg: 'rgba(14,165,233,0.18)'  },
  utensils:  { label: 'Utensils',  emoji: '🍴', color: '#F59E0B', lightBg: '#FEF3C7', darkBg: 'rgba(245,158,11,0.18)'  },
  office:    { label: 'Office',    emoji: '📎', color: '#8B5CF6', lightBg: '#EDE9FE', darkBg: 'rgba(139,92,246,0.18)'  },
  other:     { label: 'Other',     emoji: '📋', color: '#64748B', lightBg: '#F1F5F9', darkBg: 'rgba(100,116,139,0.18)' },
};

// ─── Stock level helpers ──────────────────────────────────────────────────────

type StockLevel = 'healthy' | 'low' | 'out';

function getStockLevel(qty: number, min: number): StockLevel {
  if (qty <= 0)          return 'out';
  if (min > 0 && qty <= min * 1.5) return 'low';
  return 'healthy';
}

interface StockTheme { color: string; label: string; Icon: React.ComponentType<{ size: number; color: string }> }

function getStockTheme(level: StockLevel, isDark: boolean): StockTheme {
  if (level === 'out')  return { color: isDark ? '#FF6B6B' : '#EF4444', label: 'Out of Stock',  Icon: XCircle };
  if (level === 'low')  return { color: isDark ? '#FFB020' : '#D97706', label: 'Low Stock',     Icon: AlertTriangle };
  return                       { color: isDark ? '#3DD68C' : '#16A34A', label: 'Healthy Stock', Icon: CheckCircle2 };
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
    const theme  = useAppTheme();
    const mode   = useThemeStore(selectThemeMode);
    const isDark = mode === 'dark';

    const catKey    = (rawMaterial.category ?? 'other') as RawMaterialCategory | 'other';
    const catConf   = CATEGORY_CONFIG[catKey];
    const level     = getStockLevel(rawMaterial.quantityInStock, rawMaterial.minimumStockLevel);
    const stockTheme = getStockTheme(level, isDark);
    const accent     = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

    // Progress bar fill: 0–100% mapped to (qty / (minimumStockLevel * 3))
    const progressPct = rawMaterial.minimumStockLevel > 0
      ? Math.min(rawMaterial.quantityInStock / (rawMaterial.minimumStockLevel * 3), 1)
      : rawMaterial.quantityInStock > 0 ? 1 : 0;

    // Minimum marker position (33% of bar — equals 1× minimum)
    const minMarkerPct = rawMaterial.minimumStockLevel > 0 ? (1 / 3) : 0;

    const totalValue = rawMaterial.quantityInStock * rawMaterial.costPerUnit;

    const dynStyles = useMemo(() => StyleSheet.create({
      card: {
        backgroundColor: theme.colors.surface,
        borderColor:     isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
      },
      accentBar: {
        backgroundColor: catConf.color,
      },
      iconPill: {
        backgroundColor: isDark ? catConf.darkBg : catConf.lightBg,
      },
      name: {
        color: theme.colors.text,
      },
      description: {
        color: theme.colors.textSecondary,
      },
      statusChipBg: {
        backgroundColor: isDark
          ? `${stockTheme.color}20`
          : level === 'healthy' ? '#DCFCE7' : level === 'low' ? '#FEF3C7' : '#FEE2E2',
      },
      stockBarBg: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
      },
      metaRow: {
        borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
      },
      metaLabel: {
        color: theme.colors.textSecondary,
      },
      metaValue: {
        color: theme.colors.text,
      },
      adjustBtn: {
        backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50],
        borderColor:     isDark ? 'rgba(79,158,255,0.28)' : staticTheme.colors.primary[200],
      },
      editBtn: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[50],
        borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
      },
    }), [theme, isDark, catConf, stockTheme.color, level]);

    return (
      <View style={[staticStyles.card, dynStyles.card]}>
        {/* Left accent bar */}
        <View style={[staticStyles.accentBar, dynStyles.accentBar]} />

        <View style={staticStyles.inner}>
          {/* ── Header row ── */}
          <View style={staticStyles.headerRow}>
            {/* Category icon pill */}
            <View style={[staticStyles.iconPill, dynStyles.iconPill]}>
              <Text style={staticStyles.iconEmoji}>{catConf.emoji}</Text>
            </View>

            {/* Name + description */}
            <View style={staticStyles.titleGroup}>
              <Text variant="body" weight="semibold" style={dynStyles.name} numberOfLines={1}>
                {rawMaterial.name}
              </Text>
              {rawMaterial.description ? (
                <Text variant="body-xs" style={dynStyles.description} numberOfLines={1}>
                  {rawMaterial.description}
                </Text>
              ) : (
                <Text variant="body-xs" style={dynStyles.description} numberOfLines={1}>
                  {catConf.label}
                </Text>
              )}
            </View>

            {/* Status chip */}
            <View style={[staticStyles.statusChip, dynStyles.statusChipBg]}>
              <stockTheme.Icon size={11} color={stockTheme.color} />
              <Text variant="body-xs" weight="semibold" style={{ color: stockTheme.color }}>
                {level === 'healthy' ? 'Healthy' : level === 'low' ? 'Low' : 'Out'}
              </Text>
            </View>
          </View>

          {/* ── Stock bar ── */}
          <View style={staticStyles.stockBarSection}>
            {/* Progress bar */}
            <View style={[staticStyles.stockBarBg, dynStyles.stockBarBg]}>
              <View
                style={[
                  staticStyles.stockBarFill,
                  {
                    width:           `${Math.max(progressPct * 100, progressPct > 0 ? 3 : 0)}%` as `${number}%`,
                    backgroundColor: stockTheme.color,
                  },
                ]}
              />
              {/* Min stock marker line */}
              {minMarkerPct > 0 ? (
                <View
                  style={[
                    staticStyles.minMarker,
                    {
                      left:            `${minMarkerPct * 100}%` as `${number}%`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[400],
                    },
                  ]}
                />
              ) : null}
            </View>

            {/* Stock quantity row */}
            <View style={staticStyles.stockLabelRow}>
              <Text variant="body-sm" weight="bold" style={{ color: stockTheme.color }}>
                {rawMaterial.quantityInStock} {rawMaterial.unit}
              </Text>
              <Text variant="body-xs" style={dynStyles.metaLabel}>
                Min: {rawMaterial.minimumStockLevel} {rawMaterial.unit}
              </Text>
            </View>
          </View>

          {/* ── Cost + value row ── */}
          <View style={[staticStyles.metaRow, dynStyles.metaRow]}>
            <View style={staticStyles.metaItem}>
              <Text variant="body-xs" style={dynStyles.metaLabel}>Cost / {rawMaterial.unit}</Text>
              <Text variant="body-sm" weight="semibold" style={{ color: accent }}>
                {formatCurrency(rawMaterial.costPerUnit)}
              </Text>
            </View>
            <View style={staticStyles.metaDivider} />
            <View style={staticStyles.metaItem}>
              <Text variant="body-xs" style={dynStyles.metaLabel}>Stock Value</Text>
              <Text variant="body-sm" weight="semibold" style={dynStyles.metaValue}>
                {formatCurrency(totalValue)}
              </Text>
            </View>
          </View>

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
      </View>
    );
  },
);
RawMaterialCard.displayName = 'RawMaterialCard';

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  card: {
    flexDirection:  'row',
    borderRadius:   16,
    borderWidth:    1,
    overflow:       'hidden',
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.07,
    shadowRadius:   8,
    elevation:      3,
  },
  accentBar: {
    width:     4,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  inner: {
    flex:              1,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.md - 2,
    gap:               10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  iconPill: {
    width:           40,
    height:          40,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  iconEmoji: {
    fontSize: 20,
  },
  titleGroup: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
  statusChip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:   staticTheme.borderRadius.full,
    flexShrink:     0,
  },
  stockBarSection: {
    gap: 6,
  },
  stockBarBg: {
    height:       8,
    borderRadius: 4,
    overflow:     'hidden',
    position:     'relative',
  },
  stockBarFill: {
    height:       8,
    borderRadius: 4,
    position:     'absolute',
    left:         0,
    top:          0,
  },
  minMarker: {
    position: 'absolute',
    top:      0,
    width:    2,
    height:   8,
  },
  stockLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  metaRow: {
    flexDirection:  'row',
    alignItems:     'center',
    borderTopWidth: 1,
    paddingTop:     10,
    gap:            staticTheme.spacing.sm,
  },
  metaItem: {
    flex: 1,
    gap:  2,
  },
  metaDivider: {
    width:     1,
    height:    28,
    backgroundColor: 'transparent',
  },
  actions: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
  },
  actionBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.xs + 2,
    paddingVertical: staticTheme.spacing.sm + 3,
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
    minHeight:      44,
  },
  pressed: {
    opacity:   0.72,
    transform: [{ scale: 0.97 }],
  },
});
