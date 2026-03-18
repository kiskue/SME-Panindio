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
  LayoutAnimation,
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
    const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
    const catKey  = (item.category ?? 'other') as RawMaterialCategory | 'other';
    const catConf = CATEGORY_CONFIG[catKey] ?? CATEGORY_CONFIG['other'];

    // Card surface
    const cardBg: string     = isSelected
      ? (isDark ? `${accent}12` : `${accent}08`)
      : (isDark ? '#1A2235' : '#FFFFFF');
    const borderColor: string = isSelected
      ? accent
      : (isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0');
    const borderWidth = isSelected ? 2 : 1;

    // Text colours
    const nameColor: string = isDark ? 'rgba(255,255,255,0.92)' : staticTheme.colors.gray[800];
    const metaColor: string = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];

    // Stepper colours
    const stepperBtnBg: string    = isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9';
    const stepperBtnIcon: string  = isDark ? 'rgba(255,255,255,0.80)' : staticTheme.colors.gray[700];
    const stepperInputBg: string  = isDark ? '#1E2435' : '#FFFFFF';
    const stepperBorder: string   = isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E1';
    const stepperText: string     = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[800];
    const dividerColor: string    = isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0';

    // Checkmark / circle outline colours
    const emptyCircleBorder: string = isDark ? 'rgba(255,255,255,0.20)' : '#CBD5E1';

    const handleToggle = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggle(item);
    };

    return (
      <Pressable
        style={[
          staticRowStyles.outerWrap,
          { borderWidth, borderColor, backgroundColor: cardBg },
        ]}
        onPress={handleToggle}
      >
        {/* Top row — always visible */}
        <View style={staticRowStyles.topRow}>

          {/* Category emoji — rounded square */}
          <View style={[
            staticRowStyles.emojiSquare,
            { backgroundColor: `${catConf.color}20` },
          ]}>
            <Text style={{ fontSize: 16 }}>{catConf.emoji}</Text>
          </View>

          {/* Info column */}
          <View style={staticRowStyles.infoCol}>
            <Text
              variant="body-sm"
              weight="semibold"
              style={{ color: nameColor }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text variant="body-xs" style={{ color: metaColor }}>
              {catConf.label} · {item.quantityInStock} {item.unit} in stock
            </Text>
          </View>

          {/* Selection indicator — filled check or empty circle */}
          {isSelected ? (
            <View style={[staticRowStyles.checkCircle, { backgroundColor: accent }]}>
              <Check size={13} color="#fff" strokeWidth={3} />
            </View>
          ) : (
            <View style={[staticRowStyles.emptyCircle, { borderColor: emptyCircleBorder }]} />
          )}

        </View>

        {/* Qty stepper — only when selected, animated by LayoutAnimation */}
        {isSelected ? (
          <>
            {/* Divider */}
            <View style={[staticRowStyles.divider, { backgroundColor: dividerColor }]} />

            {/* Stepper row */}
            <View style={staticRowStyles.stepperRow}>
              <Text variant="body-xs" weight="medium" style={{ color: metaColor }}>
                Qty:
              </Text>

              {/* Minus button */}
              <Pressable
                style={[staticRowStyles.stepperBtn, { backgroundColor: stepperBtnBg }]}
                onPress={() => onQuantityChange(item.id, Math.max(1, quantity - 1))}
                hitSlop={4}
              >
                <Text style={{ fontSize: 18, lineHeight: 20, color: stepperBtnIcon }}>
                  −
                </Text>
              </Pressable>

              {/* Direct input */}
              <TextInput
                style={[
                  staticRowStyles.stepperInput,
                  {
                    backgroundColor: stepperInputBg,
                    borderColor:     stepperBorder,
                    color:           stepperText,
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

              {/* Plus button */}
              <Pressable
                style={[staticRowStyles.stepperBtn, { backgroundColor: stepperBtnBg }]}
                onPress={() => onQuantityChange(item.id, quantity + 1)}
                hitSlop={4}
              >
                <Text style={{ fontSize: 18, lineHeight: 20, color: stepperBtnIcon }}>
                  +
                </Text>
              </Pressable>

              {/* Unit label */}
              <Text variant="body-xs" style={{ color: metaColor }}>
                {item.unit}
              </Text>
            </View>
          </>
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
    // nowrap keeps the chips on a single line so triggerBtn height never grows
    // beyond its minHeight. We show at most 2 named chips + 1 overflow "+N" chip,
    // each capped at maxWidth: 140, so they always fit within the flex space.
    flexWrap:      'nowrap',
    overflow:      'hidden',
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

// ─── Row static styles — 2024/2025 card redesign ──────────────────────────────

const staticRowStyles = StyleSheet.create({
  // Outer card — no accent bar; border + radius carry the selection state
  outerWrap: {
    borderRadius:      16,
    marginBottom:      8,
    overflow:          'hidden',
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  // Top info row — always visible
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  // 32×32 rounded-square emoji container
  emojiSquare: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  // Name + subtitle column
  infoCol: {
    flex:     1,
    gap:      2,
    minWidth: 0,
  },
  // Filled check circle — shown when selected
  checkCircle: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  // Empty circle outline — shown when not selected
  emptyCircle: {
    width:        24,
    height:       24,
    borderRadius: 12,
    borderWidth:  1.5,
    flexShrink:   0,
  },
  // Hairline divider between top row and stepper
  divider: {
    height:           1,
    marginTop:        10,
    marginBottom:     10,
    marginHorizontal: -14,   // bleed to card edges (cancel paddingHorizontal: 14)
  },
  // Qty stepper row
  stepperRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  // Minus / Plus circular buttons
  stepperBtn: {
    width:          32,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Direct qty TextInput
  stepperInput: {
    width:        56,
    height:       32,
    borderRadius: 8,
    borderWidth:  1,
    textAlign:    'center',
    fontSize:     14,
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
});
