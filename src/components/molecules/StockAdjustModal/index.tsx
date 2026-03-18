/**
 * StockAdjustModal — Premium Redesign
 *
 * Bottom-sheet modal for adjusting raw material stock.
 *
 * Layout:
 *   Handle
 *   Header: "Adjust Stock" · material name · close btn
 *   ─────────────────────────────────────
 *   Preview: Current → projected (live update, color-coded)
 *   ─────────────────────────────────────
 *   [+ Add Stock] [− Remove Stock]
 *   Quantity input with unit suffix
 *   Reason grid (2×2)
 *   Notes (optional)
 *   ─────────────────────────────────────
 *   [Cancel]  [Confirm — "Remove 10 pcs" / "Add 10 pcs"]
 *
 * Full dark/light mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Minus, TrendingDown, Trash2, Settings, ArrowRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import type { RawMaterial, RawMaterialReason } from '@/types';

// ─── Reason config ────────────────────────────────────────────────────────────

interface ReasonConfig {
  label:       string;
  description: string;
  color:       string;
  lightBg:     string;
  darkBg:      string;
  makeIcon:    (color: string) => React.ReactNode;
}

const REASON_CONFIG: Record<RawMaterialReason, ReasonConfig> = {
  sale:       {
    label: 'Sale', description: 'Consumed in a sale',
    color: '#0EA5E9', lightBg: '#E0F2FE', darkBg: 'rgba(14,165,233,0.16)',
    makeIcon: (c) => <TrendingDown size={15} color={c} />,
  },
  production: {
    label: 'Production', description: 'Used in production',
    color: '#8B5CF6', lightBg: '#EDE9FE', darkBg: 'rgba(139,92,246,0.16)',
    makeIcon: (c) => <Settings size={15} color={c} />,
  },
  waste:      {
    label: 'Waste', description: 'Spoilage or breakage',
    color: '#EF4444', lightBg: '#FEE2E2', darkBg: 'rgba(239,68,68,0.16)',
    makeIcon: (c) => <Trash2 size={15} color={c} />,
  },
  adjustment: {
    label: 'Adjustment', description: 'Manual correction',
    color: '#F59E0B', lightBg: '#FEF3C7', darkBg: 'rgba(245,158,11,0.16)',
    makeIcon: (c) => <Settings size={15} color={c} />,
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface StockAdjustModalProps {
  visible:   boolean;
  material:  RawMaterial | null;
  isSaving:  boolean;
  onConfirm: (quantity: number, reason: RawMaterialReason, notes?: string) => void;
  onClose:   () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  visible,
  material,
  isSaving,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const theme  = useAppTheme();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';

  const [adjustType, setAdjustType]   = useState<'add' | 'remove'>('remove');
  const [quantityStr, setQuantityStr] = useState('');
  const [reason, setReason]           = useState<RawMaterialReason>('adjustment');
  const [notes, setNotes]             = useState('');

  const parsedQty    = parseFloat(quantityStr) || 0;
  const signedDelta  = adjustType === 'add' ? parsedQty : -parsedQty;
  const currentStock = material?.quantityInStock ?? 0;
  const projected    = Math.max(0, currentStock + signedDelta);

  const projectedColor = isDark
    ? projected <= 0                                        ? '#FF6B6B'
    : projected <= (material?.minimumStockLevel ?? 0)      ? '#FFB020'
    : '#3DD68C'
    : projected <= 0                                        ? '#EF4444'
    : projected <= (material?.minimumStockLevel ?? 0)      ? '#D97706'
    : '#16A34A';

  const confirmLabel = parsedQty > 0
    ? `${adjustType === 'add' ? 'Add' : 'Remove'} ${parsedQty} ${material?.unit ?? ''}`
    : 'Confirm Adjustment';

  const handleConfirm = useCallback(() => {
    if (parsedQty <= 0 || !material) return;
    const trimmedNotes = notes.trim();
    onConfirm(signedDelta, reason, ...(trimmedNotes !== '' ? [trimmedNotes] : []));
    setQuantityStr('');
    setNotes('');
    setReason('adjustment');
    setAdjustType('remove');
  }, [parsedQty, material, signedDelta, reason, notes, onConfirm]);

  const handleClose = useCallback(() => {
    setQuantityStr('');
    setNotes('');
    setReason('adjustment');
    setAdjustType('remove');
    onClose();
  }, [onClose]);

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: isDark ? '#1A2235' : theme.colors.surface,
      borderTopWidth:  1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor:     isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200],
    },
    handle: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : staticTheme.colors.gray[300],
    },
    sheetHeader: {
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
    },
    sheetTitle: {
      color: theme.colors.text,
    },
    sheetSubtitle: {
      color: isDark ? '#4F9EFF' : staticTheme.colors.primary[500],
    },
    previewBox: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50],
      borderColor:     isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200],
    },
    previewLabel: {
      color: theme.colors.textSecondary,
    },
    previewCurrent: {
      color: theme.colors.text,
    },
    previewUnit: {
      color: theme.colors.textSecondary,
    },
    deltaChip: {
      backgroundColor: adjustType === 'add'
        ? isDark ? 'rgba(61,214,140,0.15)' : '#DCFCE7'
        : isDark ? 'rgba(255,107,107,0.15)' : '#FEE2E2',
    },
    fieldLabel: {
      color: isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[600],
    },
    toggleBtnBase: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
    },
    input: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? '#1E2435' : '#F8F9FC',
      color:           theme.colors.text,
    },
    inputUnitTag: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    inputUnitText: {
      color: theme.colors.textSecondary,
    },
    reasonBtnBase: {
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    },
    sectionDivider: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
    },
    footer: {
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
      backgroundColor: isDark ? '#1A2235' : theme.colors.surface,
    },
    cancelBtn: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50],
    },
    cancelText: {
      color: theme.colors.textSecondary,
    },
  }), [theme, isDark, adjustType]);

  if (!material) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={staticStyles.overlay}
      >
        <Pressable style={staticStyles.backdrop} onPress={handleClose} />
        <View style={[staticStyles.sheet, dynStyles.sheet]}>
          {/* Handle */}
          <View style={[staticStyles.handle, dynStyles.handle]} />

          {/* Header */}
          <View style={[staticStyles.sheetHeader, dynStyles.sheetHeader]}>
            <View style={staticStyles.headerLeft}>
              <Text variant="body" weight="bold" style={dynStyles.sheetTitle}>
                Adjust Stock
              </Text>
              <Text variant="body-xs" weight="medium" style={dynStyles.sheetSubtitle} numberOfLines={1}>
                {material.name}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={staticStyles.closeBtn} hitSlop={8}>
              <X size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={staticStyles.body}
            contentContainerStyle={staticStyles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Live preview box ── */}
            <View style={[staticStyles.previewBox, dynStyles.previewBox]}>
              {/* Current */}
              <View style={staticStyles.previewColumn}>
                <Text variant="body-xs" style={dynStyles.previewLabel}>Current</Text>
                <Text variant="h4" weight="bold" style={dynStyles.previewCurrent}>
                  {currentStock}
                </Text>
                <Text variant="body-xs" style={dynStyles.previewUnit}>{material.unit}</Text>
              </View>

              {/* Arrow + delta chip */}
              <View style={staticStyles.previewMid}>
                <View style={[staticStyles.deltaChip, dynStyles.deltaChip]}>
                  <Text
                    variant="body-xs"
                    weight="bold"
                    style={{
                      color: adjustType === 'add'
                        ? (isDark ? '#3DD68C' : '#16A34A')
                        : (isDark ? '#FF6B6B' : '#EF4444'),
                    }}
                  >
                    {parsedQty > 0
                      ? `${adjustType === 'add' ? '+' : '−'}${parsedQty}`
                      : '—'}
                  </Text>
                </View>
                <ArrowRight size={18} color={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]} />
              </View>

              {/* After */}
              <View style={staticStyles.previewColumn}>
                <Text variant="body-xs" style={dynStyles.previewLabel}>After</Text>
                <Text variant="h4" weight="bold" style={{ color: projectedColor }}>
                  {projected % 1 === 0 ? projected : projected.toFixed(1)}
                </Text>
                <Text variant="body-xs" style={dynStyles.previewUnit}>{material.unit}</Text>
              </View>
            </View>

            {/* ── Section divider ── */}
            <View style={[staticStyles.sectionDivider, dynStyles.sectionDivider]} />

            {/* ── Add / Remove toggle ── */}
            <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
              ADJUSTMENT TYPE
            </Text>
            <View style={staticStyles.toggleRow}>
              <Pressable
                style={[
                  staticStyles.toggleBtn,
                  dynStyles.toggleBtnBase,
                  adjustType === 'add' && staticStyles.toggleAddActive,
                ]}
                onPress={() => setAdjustType('add')}
              >
                <Plus size={16} color={adjustType === 'add' ? '#fff' : theme.colors.textSecondary} />
                <Text
                  variant="body-sm"
                  weight="semibold"
                  style={{ color: adjustType === 'add' ? '#fff' : theme.colors.textSecondary }}
                >
                  Add Stock
                </Text>
              </Pressable>
              <Pressable
                style={[
                  staticStyles.toggleBtn,
                  dynStyles.toggleBtnBase,
                  adjustType === 'remove' && staticStyles.toggleRemoveActive,
                ]}
                onPress={() => setAdjustType('remove')}
              >
                <Minus size={16} color={adjustType === 'remove' ? '#fff' : theme.colors.textSecondary} />
                <Text
                  variant="body-sm"
                  weight="semibold"
                  style={{ color: adjustType === 'remove' ? '#fff' : theme.colors.textSecondary }}
                >
                  Remove Stock
                </Text>
              </Pressable>
            </View>

            {/* ── Quantity input ── */}
            <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
              QUANTITY
            </Text>
            <View style={staticStyles.inputRow}>
              <TextInput
                style={[staticStyles.qtyInput, dynStyles.input]}
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
              />
              <View style={[staticStyles.unitTag, dynStyles.inputUnitTag]}>
                <Text variant="body-sm" weight="semibold" style={dynStyles.inputUnitText}>
                  {material.unit}
                </Text>
              </View>
            </View>

            {/* ── Reason ── */}
            <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
              REASON
            </Text>
            <View style={staticStyles.reasonGrid}>
              {(Object.entries(REASON_CONFIG) as [RawMaterialReason, ReasonConfig][]).map(
                ([key, conf]) => {
                  const isActive = reason === key;
                  return (
                    <Pressable
                      key={key}
                      style={[
                        staticStyles.reasonBtn,
                        dynStyles.reasonBtnBase,
                        isActive && {
                          backgroundColor: isDark ? conf.darkBg : conf.lightBg,
                          borderColor:     conf.color + '70',
                        },
                      ]}
                      onPress={() => setReason(key)}
                    >
                      {conf.makeIcon(isActive ? conf.color : theme.colors.textSecondary)}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          variant="body-xs"
                          weight="semibold"
                          style={{ color: isActive ? conf.color : theme.colors.text }}
                          numberOfLines={1}
                        >
                          {conf.label}
                        </Text>
                        <Text
                          variant="body-xs"
                          style={{ color: isActive ? conf.color + 'CC' : theme.colors.textSecondary }}
                          numberOfLines={1}
                        >
                          {conf.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>

            {/* ── Notes ── */}
            <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
              NOTES{' '}
              <Text variant="body-xs" style={{ color: theme.colors.textSecondary }}>(optional)</Text>
            </Text>
            <TextInput
              style={[staticStyles.notesInput, dynStyles.input]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note about this adjustment…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          {/* ── Footer ── */}
          <View style={[staticStyles.footer, dynStyles.footer, { paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md) }]}>
            <Pressable style={[staticStyles.cancelBtn, dynStyles.cancelBtn]} onPress={handleClose}>
              <Text variant="body-sm" weight="semibold" style={dynStyles.cancelText}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[
                staticStyles.confirmBtn,
                adjustType === 'add' ? staticStyles.confirmAdd : staticStyles.confirmRemove,
                (parsedQty <= 0 || isSaving) && staticStyles.disabledBtn,
              ]}
              onPress={handleConfirm}
              disabled={parsedQty <= 0 || isSaving}
            >
              {adjustType === 'add'
                ? <Plus size={15} color="#fff" strokeWidth={2.5} />
                : <Minus size={15} color="#fff" strokeWidth={2.5} />}
              <Text variant="body-sm" weight="bold" style={{ color: '#fff' }}>
                {isSaving ? 'Saving…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    maxHeight:            '92%',
  },
  handle: {
    width:       40,
    height:      4,
    borderRadius: 2,
    alignSelf:   'center',
    marginTop:    staticTheme.spacing.sm + 2,
    marginBottom: staticTheme.spacing.xs,
  },
  sheetHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     staticTheme.spacing.md - 2,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    gap:  3,
  },
  closeBtn: {
    padding:        staticTheme.spacing.xs,
    minWidth:       44,
    minHeight:      44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  body: { flexShrink: 1 },
  bodyContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.lg,
  },
  // Preview box
  previewBox: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    padding:        staticTheme.spacing.md,
    marginBottom:   staticTheme.spacing.md,
  },
  previewColumn: {
    flex:           1,
    alignItems:     'center',
    gap:            2,
  },
  previewMid: {
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: staticTheme.spacing.sm,
  },
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
  },
  sectionDivider: {
    height:        1,
    marginBottom:  staticTheme.spacing.md,
  },
  fieldLabel: {
    marginBottom: staticTheme.spacing.sm,
    letterSpacing: 0.5,
  },
  toggleRow: {
    flexDirection:  'row',
    gap:            staticTheme.spacing.sm,
    marginBottom:   staticTheme.spacing.md,
  },
  toggleBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.sm - 2,
    paddingVertical: staticTheme.spacing.sm + 4,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    minHeight:      50,
  },
  toggleAddActive: {
    backgroundColor: '#16A34A',
    borderColor:     '#15803D',
  },
  toggleRemoveActive: {
    backgroundColor: '#EF4444',
    borderColor:     '#DC2626',
  },
  inputRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginBottom:   staticTheme.spacing.md,
  },
  qtyInput: {
    flex:            1,
    borderWidth:     1,
    borderRadius:    staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.md - 4,
    fontSize:        20,
    fontWeight:      '600',
    textAlign:       'center',
    minHeight:       54,
  },
  unitTag: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.md - 4,
    borderRadius:      staticTheme.borderRadius.xl,
    borderWidth:       1,
    minHeight:         54,
    justifyContent:    'center',
  },
  reasonGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            staticTheme.spacing.sm,
    marginBottom:   staticTheme.spacing.md,
  },
  reasonBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm - 2,
    minWidth:       '47%',
    flex:           1,
    paddingHorizontal: staticTheme.spacing.sm + 2,
    paddingVertical:   staticTheme.spacing.sm + 4,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    minHeight:      52,
  },
  notesInput: {
    borderWidth:     1,
    borderRadius:    staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.sm + 2,
    fontSize:        14,
    height:          88,
    minHeight:       88,
    marginBottom:    staticTheme.spacing.sm,
  },
  footer: {
    flexDirection:    'row',
    gap:              staticTheme.spacing.sm + 2,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:       staticTheme.spacing.md - 2,
    borderTopWidth:   1,
  },
  cancelBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: staticTheme.spacing.md - 2,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    minHeight:      54,
  },
  confirmBtn: {
    flex:           2,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.sm - 2,
    paddingVertical: staticTheme.spacing.md - 2,
    borderRadius:   staticTheme.borderRadius.xl,
    minHeight:      54,
  },
  confirmAdd: {
    backgroundColor: '#16A34A',
  },
  confirmRemove: {
    backgroundColor: staticTheme.colors.primary[500],
  },
  disabledBtn: { opacity: 0.40 },
});
