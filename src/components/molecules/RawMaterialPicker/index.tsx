/**
 * RawMaterialPicker — Premium Redesign
 *
 * Picker for selecting raw materials when adding/editing products.
 * Supports multi-select with per-item quantity input.
 *
 * Trigger button variants:
 *   - Empty:    [📦  Add Raw Materials…          [0] ›]
 *   - Selected: shows compact chip list + [+ Add ›]
 *
 * Picker modal (bottom sheet):
 *   Handle
 *   Header: title + selected count badge + close
 *   Search bar
 *   Category filter chips
 *   FlatList of PickerRow (checkbox + name + stock info → qty input when selected)
 *   Footer: "Done — N materials selected" or "Done"
 *
 * Full dark/light mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Check, Package, ChevronRight, Plus } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import {
  useRawMaterialsStore,
  selectRawMaterials,
  selectRawMaterialsLoading,
} from '@/store';
import type { RawMaterial, RawMaterialCategory, SelectedRawMaterial } from '@/types';

// ─── Category config (matching list screen) ───────────────────────────────────

interface CategoryConf { label: string; emoji: string; color: string }

const CATEGORY_CONFIG: Record<RawMaterialCategory | 'other', CategoryConf> = {
  packaging: { label: 'Packaging', emoji: '📦', color: '#6366F1' },
  cleaning:  { label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9' },
  utensils:  { label: 'Utensils',  emoji: '🍴', color: '#F59E0B' },
  office:    { label: 'Office',    emoji: '📎', color: '#8B5CF6' },
  other:     { label: 'Other',     emoji: '📋', color: '#64748B' },
};

const PICKER_CATEGORIES: Array<{ key: RawMaterialCategory | 'all'; label: string; emoji: string; color: string }> = [
  { key: 'all',       label: 'All',       emoji: '🔍', color: staticTheme.colors.primary[500] },
  { key: 'packaging', label: 'Packaging', emoji: '📦', color: '#6366F1' },
  { key: 'cleaning',  label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9' },
  { key: 'utensils',  label: 'Utensils',  emoji: '🍴', color: '#F59E0B' },
  { key: 'office',    label: 'Office',    emoji: '📎', color: '#8B5CF6' },
  { key: 'other',     label: 'Other',     emoji: '📋', color: '#64748B' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RawMaterialPickerProps {
  selectedIds:      string[];
  quantityMap:      Record<string, number>;
  onToggle:         (material: RawMaterial) => void;
  onQuantityChange: (id: string, qty: number) => void;
  visible:          boolean;
  onClose:          () => void;
}

// ─── PickerRow ────────────────────────────────────────────────────────────────

interface PickerRowProps {
  item:             RawMaterial;
  isSelected:       boolean;
  quantity:         number;
  isDark:           boolean;
  onToggle:         (m: RawMaterial) => void;
  onQuantityChange: (id: string, qty: number) => void;
}

const PickerRow: React.FC<PickerRowProps> = React.memo(
  ({ item, isSelected, quantity, isDark, onToggle, onQuantityChange }) => {
    const accent      = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
    const catKey      = (item.category ?? 'other') as RawMaterialCategory | 'other';
    const catConf     = CATEGORY_CONFIG[catKey];

    const rowBg     = isSelected
      ? isDark ? 'rgba(79,158,255,0.10)' : staticTheme.colors.primary[50]
      : 'transparent';
    const rowBorder = isSelected
      ? isDark ? 'rgba(79,158,255,0.35)' : staticTheme.colors.primary[200]
      : isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100];
    const nameColor = isDark ? 'rgba(255,255,255,0.92)' : staticTheme.colors.gray[800];
    const metaColor = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];

    const chkBg     = isSelected ? accent : 'transparent';
    const chkBorder = isSelected ? accent : (isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[300]);

    return (
      <Pressable
        style={[staticRowStyles.row, { backgroundColor: rowBg, borderColor: rowBorder }]}
        onPress={() => onToggle(item)}
      >
        {/* Top row: checkbox + icon + name/meta */}
        <View style={staticRowStyles.topRow}>
          <View style={[staticRowStyles.checkbox, { backgroundColor: chkBg, borderColor: chkBorder }]}>
            {isSelected ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
          </View>

          {/* Category emoji pill */}
          <View style={[
            staticRowStyles.catPill,
            { backgroundColor: isDark ? `${catConf.color}22` : `${catConf.color}18` },
          ]}>
            <Text style={{ fontSize: 14 }}>{catConf.emoji}</Text>
          </View>

          <View style={staticRowStyles.rowInfo}>
            <Text variant="body-sm" weight="semibold" style={{ color: nameColor }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="body-xs" style={{ color: metaColor }}>
              {item.quantityInStock} {item.unit} in stock · ₱{item.costPerUnit.toFixed(2)}/{item.unit}
            </Text>
          </View>

          {isSelected ? (
            <View style={[staticRowStyles.selectedBadge, { backgroundColor: `${accent}20` }]}>
              <Check size={11} color={accent} strokeWidth={3} />
            </View>
          ) : null}
        </View>

        {/* Quantity row — only shown when selected */}
        {isSelected ? (
          <View style={staticRowStyles.qtyRow}>
            <View style={staticRowStyles.qtyIndent} />
            <Text variant="body-xs" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
              Qty needed:
            </Text>
            <TextInput
              style={[
                staticRowStyles.qtyInput,
                {
                  backgroundColor: isDark ? '#1E2435' : '#fff',
                  borderColor:     isDark ? 'rgba(79,158,255,0.40)' : staticTheme.colors.primary[300],
                  color:           isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[800],
                },
              ]}
              value={quantity > 0 ? String(quantity) : ''}
              onChangeText={(v) => {
                const n = parseFloat(v);
                if (!isNaN(n) && n > 0) onQuantityChange(item.id, n);
              }}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
            />
            <Text variant="body-xs" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }}>
              {item.unit}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  },
);
PickerRow.displayName = 'PickerRow';

// ─── Main component ───────────────────────────────────────────────────────────

export const RawMaterialPicker: React.FC<RawMaterialPickerProps> = ({
  selectedIds,
  quantityMap,
  onToggle,
  onQuantityChange,
  visible,
  onClose,
}) => {
  const insets  = useSafeAreaInsets();
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';
  const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const [query,       setQuery]       = useState('');
  const [activeCat,   setActiveCat]   = useState<RawMaterialCategory | 'all'>('all');

  const allMaterials = useRawMaterialsStore(selectRawMaterials);
  const isLoading    = useRawMaterialsStore(selectRawMaterialsLoading);

  const filtered = useMemo(() => {
    let list = allMaterials;
    if (activeCat !== 'all') list = list.filter((m) => m.category === activeCat);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [allMaterials, query, activeCat]);

  const keyExtractor = useCallback((item: RawMaterial) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: RawMaterial }) => (
      <PickerRow
        item={item}
        isSelected={selectedIds.includes(item.id)}
        quantity={quantityMap[item.id] ?? 0}
        isDark={isDark}
        onToggle={onToggle}
        onQuantityChange={onQuantityChange}
      />
    ),
    [selectedIds, quantityMap, isDark, onToggle, onQuantityChange],
  );

  const footerBottomPad = Math.max(insets.bottom, staticTheme.spacing.md);

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: isDark ? '#1A2235' : theme.colors.surface,
      borderTopWidth:  1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor:     isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border,
    },
    handle: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : staticTheme.colors.gray[200],
    },
    header: {
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
    },
    title: {
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    selectedBadge: {
      backgroundColor: isDark ? 'rgba(79,158,255,0.20)' : staticTheme.colors.primary[50],
      borderColor:     isDark ? 'rgba(79,158,255,0.40)' : staticTheme.colors.primary[200],
    },
    selectedBadgeText: {
      color: accent,
    },
    searchWrap: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? '#1E2435' : staticTheme.colors.gray[50],
    },
    searchInput: {
      color: theme.colors.text,
    },
    chipBase: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    footer: {
      borderTopColor:  isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
      backgroundColor: isDark ? '#1A2235' : theme.colors.surface,
    },
  }), [theme, isDark, accent]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={staticStyles.overlay}>
        <Pressable style={staticStyles.backdrop} onPress={onClose} />
        <View style={[staticStyles.sheet, dynStyles.sheet]}>
          {/* Handle */}
          <View style={[staticStyles.handle, dynStyles.handle]} />

          {/* Header */}
          <View style={[staticStyles.header, dynStyles.header]}>
            <View style={staticStyles.headerLeft}>
              <View style={staticStyles.headerTitleRow}>
                <Text variant="body" weight="bold" style={dynStyles.title}>
                  Select Raw Materials
                </Text>
                {selectedIds.length > 0 ? (
                  <View style={[staticStyles.selectedBadge, dynStyles.selectedBadge]}>
                    <Text variant="body-xs" weight="bold" style={dynStyles.selectedBadgeText}>
                      {selectedIds.length}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="body-xs" style={dynStyles.subtitle}>
                Tap to select, then set the quantity needed
              </Text>
            </View>
            <Pressable onPress={onClose} style={staticStyles.closeBtn} hitSlop={8}>
              <X size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={[staticStyles.searchWrap, dynStyles.searchWrap]}>
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[staticStyles.searchInput, dynStyles.searchInput]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search raw materials…"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]}
              autoCapitalize="none"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <X size={15} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={staticStyles.chipsRow}
            style={staticStyles.chipsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {PICKER_CATEGORIES.map((c) => {
              const isActive = activeCat === c.key;
              return (
                <Pressable
                  key={c.key}
                  style={[
                    staticStyles.chip,
                    dynStyles.chipBase,
                    isActive && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => setActiveCat(c.key)}
                >
                  <Text style={{ fontSize: 12 }}>{c.emoji}</Text>
                  <Text
                    variant="body-xs"
                    weight="semibold"
                    style={{ color: isActive ? '#fff' : theme.colors.textSecondary }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={staticStyles.list}
            contentContainerStyle={staticStyles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={12}
            ListEmptyComponent={
              <View style={staticStyles.emptyWrap}>
                <Package size={44} color={isDark ? 'rgba(255,255,255,0.20)' : staticTheme.colors.gray[300]} />
                <Text variant="body-sm" weight="semibold" style={dynStyles.emptyText}>
                  {isLoading ? 'Loading…' : 'No raw materials found'}
                </Text>
                {!isLoading && !query ? (
                  <Text variant="body-xs" style={dynStyles.emptyText}>
                    Add raw materials in Inventory first.
                  </Text>
                ) : null}
              </View>
            }
          />

          {/* Done button */}
          <View style={[staticStyles.footer, dynStyles.footer, { paddingBottom: footerBottomPad }]}>
            <Pressable
              style={[
                staticStyles.doneBtn,
                { backgroundColor: selectedIds.length > 0 ? staticTheme.colors.primary[500] : (isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[100]) },
              ]}
              onPress={onClose}
            >
              {selectedIds.length > 0 ? (
                <Check size={16} color="#fff" strokeWidth={2.5} />
              ) : null}
              <Text
                variant="body-sm"
                weight="bold"
                style={{ color: selectedIds.length > 0 ? '#fff' : theme.colors.textSecondary }}
              >
                {selectedIds.length > 0
                  ? `Done — ${selectedIds.length} material${selectedIds.length !== 1 ? 's' : ''} selected`
                  : 'Done'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Trigger button (convenience component) ───────────────────────────────────

interface RawMaterialPickerButtonProps {
  selectedMaterials: SelectedRawMaterial[];
  onPress:           () => void;
}

export const RawMaterialPickerButton: React.FC<RawMaterialPickerButtonProps> = ({
  selectedMaterials,
  onPress,
}) => {
  const theme  = useAppTheme();
  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const accent = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const isEmpty = selectedMaterials.length === 0;

  return (
    <Pressable
      style={({ pressed }) => [
        staticStyles.triggerBtn,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50],
          borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
        },
        pressed && staticStyles.pressed,
      ]}
      onPress={onPress}
    >
      {isEmpty ? (
        <>
          <View style={[staticStyles.triggerIconWrap, { backgroundColor: `${accent}18` }]}>
            <Package size={16} color={accent} />
          </View>
          <Text variant="body-sm" style={{ color: theme.colors.textSecondary, flex: 1 }}>
            Add raw materials…
          </Text>
          <View style={[staticStyles.triggerCountBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100] }]}>
            <Text variant="body-xs" weight="bold" style={{ color: theme.colors.textSecondary }}>0</Text>
          </View>
          <ChevronRight size={16} color={theme.colors.textSecondary} />
        </>
      ) : (
        <>
          <View style={[staticStyles.triggerIconWrap, { backgroundColor: `${accent}18` }]}>
            <Package size={16} color={accent} />
          </View>
          <View style={staticStyles.triggerChips}>
            {selectedMaterials.slice(0, 2).map((sm) => (
              <View
                key={sm.rawMaterialId}
                style={[staticStyles.triggerChip, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}
              >
                <Text variant="body-xs" weight="semibold" style={{ color: accent }} numberOfLines={1}>
                  {sm.rawMaterialName} ×{sm.quantityRequired}
                </Text>
              </View>
            ))}
            {selectedMaterials.length > 2 ? (
              <View style={[staticStyles.triggerChip, { backgroundColor: `${accent}18`, borderColor: `${accent}30` }]}>
                <Text variant="body-xs" weight="semibold" style={{ color: accent }}>
                  +{selectedMaterials.length - 2}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            style={[staticStyles.triggerAddMore, { backgroundColor: `${accent}18` }]}
            onPress={onPress}
          >
            <Plus size={13} color={accent} />
          </Pressable>
        </>
      )}
    </Pressable>
  );
};
RawMaterialPickerButton.displayName = 'RawMaterialPickerButton';

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  overlay: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    maxHeight:            '90%',
    minHeight:            '55%',
  },
  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    alignSelf:    'center',
    marginTop:    staticTheme.spacing.sm + 2,
    marginBottom: staticTheme.spacing.xs,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:     staticTheme.spacing.sm,
    paddingBottom:  staticTheme.spacing.md - 2,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    gap:  4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  selectedBadge: {
    width:          22,
    height:         22,
    borderRadius:   11,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding:        staticTheme.spacing.xs,
    marginLeft:     staticTheme.spacing.sm,
    minWidth:       44,
    minHeight:      44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginHorizontal: staticTheme.spacing.md,
    marginTop:      staticTheme.spacing.md - 2,
    marginBottom:   staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md - 4,
    paddingVertical:   staticTheme.spacing.sm + 2,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    minHeight:      46,
  },
  searchInput: {
    flex:     1,
    fontSize: 14,
    padding:  0,
  },
  chipsScroll: {
    overflow: 'visible',
  },
  chipsRow: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.sm,
    gap:               staticTheme.spacing.sm,
  },
  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: 10,
    paddingVertical:   staticTheme.spacing.xs + 1,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
    minHeight:      32,
  },
  list:        { flex: 1 },
  listContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.xs,
    paddingBottom:     staticTheme.spacing.sm,
  },
  emptyWrap: {
    alignItems:    'center',
    paddingVertical: 48,
    gap:           staticTheme.spacing.sm + 2,
  },
  footer: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md - 2,
    borderTopWidth:    1,
  },
  doneBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            staticTheme.spacing.sm - 2,
    borderRadius:   staticTheme.borderRadius.xl,
    paddingVertical: staticTheme.spacing.md,
    minHeight:      54,
  },
  // Trigger button styles
  triggerBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    borderWidth:    1,
    borderRadius:   staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 4,
    minHeight:      52,
  },
  triggerIconWrap: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  triggerCountBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
  },
  triggerChips: {
    flex:          1,
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           staticTheme.spacing.xs,
    minWidth:      0,
  },
  triggerChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    maxWidth:          140,
  },
  triggerAddMore: {
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  pressed: { opacity: 0.75 },
});

// ─── Row static styles ────────────────────────────────────────────────────────

const CHECKBOX_SIZE = 24;
const CHECKBOX_GAP  = staticTheme.spacing.sm + 2;

const staticRowStyles = StyleSheet.create({
  row: {
    paddingVertical:   staticTheme.spacing.sm + 4,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    borderRadius:      staticTheme.borderRadius.xl,
    marginBottom:      staticTheme.spacing.xs + 2,
    borderWidth:       1,
    gap:               staticTheme.spacing.xs + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           CHECKBOX_GAP,
  },
  checkbox: {
    width:          CHECKBOX_SIZE,
    height:         CHECKBOX_SIZE,
    borderRadius:   staticTheme.borderRadius.sm + 3,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  catPill: {
    width:          30,
    height:         30,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowInfo: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
  selectedBadge: {
    width:          22,
    height:         22,
    borderRadius:   11,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm - 2,
    paddingTop:    staticTheme.spacing.xs,
  },
  qtyIndent: {
    width:     CHECKBOX_SIZE + CHECKBOX_GAP + 30 + CHECKBOX_GAP,
    flexShrink: 0,
  },
  qtyInput: {
    borderWidth:      1,
    borderRadius:     staticTheme.borderRadius.md + 2,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical:  staticTheme.spacing.xs + 2,
    fontSize:         14,
    width:            64,
    textAlign:        'center',
    minHeight:        36,
  },
});
