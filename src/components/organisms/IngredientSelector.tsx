/**
 * IngredientSelector
 *
 * Section component rendered inside the product add/edit form.
 * Lets the user attach ingredient items from inventory to a product,
 * specify how much of each ingredient is used per unit, and shows the
 * auto-calculated total ingredient cost.
 *
 * Used exclusively when `category === 'product'`.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Plus, Trash2, Wheat, Search, X } from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { useShallow } from 'zustand/react/shallow';
import { useInventoryStore, selectIngredients } from '@/store';
import { theme as staticTheme } from '@/core/theme';
import type { SelectedIngredient } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IngredientSelectorProps {
  selectedIngredients: SelectedIngredient[];
  onIngredientsChange: (ingredients: SelectedIngredient[]) => void;
  isDark:              boolean;
  accentColor:         string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ─── Ingredient row (selected item) ──────────────────────────────────────────

interface IngredientRowProps {
  item:      SelectedIngredient;
  isDark:    boolean;
  accent:    string;
  onRemove:  (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
}

const IngredientRow = React.memo<IngredientRowProps>(
  ({ item, isDark, accent, onRemove, onQtyChange }) => {
    const [raw, setRaw] = useState(String(item.quantityUsed));

    const handleEndEditing = useCallback(() => {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= 0) {
        onQtyChange(item.ingredientId, parsed);
      } else {
        setRaw(String(item.quantityUsed));
      }
    }, [raw, item.ingredientId, item.quantityUsed, onQtyChange]);

    const rowBg     = isDark ? '#1E2435' : '#F8F9FC';
    const border    = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
    const subColor  = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
    const inputBg   = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
    const inputBdr  = isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB';

    return (
      <View style={[rowStyles.row, { backgroundColor: rowBg, borderColor: border }]}>
        {/* Icon */}
        <View style={[rowStyles.iconWrap, { backgroundColor: `${accent}18` }]}>
          <Wheat size={14} color={accent} />
        </View>

        {/* Name + unit */}
        <View style={rowStyles.info}>
          <Text variant="body-sm" weight="semibold" style={{ color: textColor }} numberOfLines={1}>
            {item.ingredientName}
          </Text>
          <Text variant="body-xs" style={{ color: subColor }}>
            {formatCurrency(item.lineCost)} · {item.unit}
          </Text>
        </View>

        {/* Qty input */}
        <TextInput
          value={raw}
          onChangeText={setRaw}
          onEndEditing={handleEndEditing}
          keyboardType="decimal-pad"
          style={[rowStyles.qtyInput, {
            backgroundColor: inputBg,
            borderColor: inputBdr,
            color: textColor,
          }]}
          placeholderTextColor={subColor}
          selectTextOnFocus
        />

        {/* Remove */}
        <Pressable
          onPress={() => onRemove(item.ingredientId)}
          style={[rowStyles.removeBtn, { backgroundColor: isDark ? 'rgba(255,80,80,0.12)' : 'rgba(239,68,68,0.08)' }]}
          hitSlop={8}
        >
          <Trash2 size={14} color={staticTheme.colors.error[500]} />
        </Pressable>
      </View>
    );
  },
);
IngredientRow.displayName = 'IngredientRow';

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  iconWrap: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  qtyInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  removeBtn: {
    width: 32, height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Ingredient picker modal ──────────────────────────────────────────────────

interface IngredientPickerModalProps {
  visible:             boolean;
  onClose:             () => void;
  selectedIds:         Set<string>;
  onSelect:            (id: string, name: string, unit: string, costPrice: number | undefined) => void;
  isDark:              boolean;
  accent:              string;
}

const IngredientPickerModal = React.memo<IngredientPickerModalProps>(
  ({ visible, onClose, selectedIds, onSelect, isDark, accent }) => {
    const ingredients = useInventoryStore(useShallow(selectIngredients));
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return q.length === 0
        ? ingredients
        : ingredients.filter((i) => i.name.toLowerCase().includes(q));
    }, [ingredients, query]);

    const sheetBg   = isDark ? '#1A1F2E' : '#FFFFFF';
    const handleBg  = isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB';
    const inputBg   = isDark ? '#1E2435' : '#F3F4F6';
    const inputBdr  = isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0';
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
    const subColor  = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
    const sepColor  = isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6';

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={modalStyles.overlay} onPress={onClose}>
          <Pressable
            style={[modalStyles.sheet, {
              backgroundColor: sheetBg,
              borderTopWidth: 1,
              borderLeftWidth: 1,
              borderRightWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
            }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={[modalStyles.handle, { backgroundColor: handleBg }]} />

            {/* Header */}
            <View style={modalStyles.header}>
              <Text variant="h5" weight="semibold" style={{ color: textColor }}>
                Add Ingredient
              </Text>
              <Pressable onPress={onClose} style={[modalStyles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}>
                <X size={16} color={subColor} />
              </Pressable>
            </View>

            {/* Search */}
            <View style={[modalStyles.searchWrap, { backgroundColor: inputBg, borderColor: inputBdr }]}>
              <Search size={15} color={subColor} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search ingredients..."
                placeholderTextColor={subColor}
                style={[modalStyles.searchInput, { color: textColor }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={14} color={subColor} />
                </Pressable>
              )}
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: sepColor, marginVertical: 2 }} />}
              ListEmptyComponent={
                <View style={modalStyles.empty}>
                  <Wheat size={32} color={subColor} />
                  <Text variant="body-sm" style={{ color: subColor, marginTop: 8 }}>
                    No ingredients found
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const alreadyAdded = selectedIds.has(item.id);
                const rowBg = alreadyAdded
                  ? (isDark ? `${accent}10` : `${accent}12`)
                  : 'transparent';

                return (
                  <Pressable
                    style={({ pressed }) => [
                      modalStyles.optionRow,
                      { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : '#F9FAFB') : rowBg },
                    ]}
                    onPress={() => {
                      if (!alreadyAdded) {
                        onSelect(item.id, item.name, item.unit, item.costPrice);
                        onClose();
                      }
                    }}
                    disabled={alreadyAdded}
                  >
                    <View style={[modalStyles.optionIconWrap, { backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : 'rgba(34,197,94,0.10)' }]}>
                      <Wheat size={16} color={isDark ? '#3DD68C' : staticTheme.colors.success[600]} />
                    </View>
                    <View style={modalStyles.optionInfo}>
                      <Text
                        variant="body"
                        weight="medium"
                        style={{ color: alreadyAdded ? subColor : textColor }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text variant="body-xs" style={{ color: subColor }}>
                        {item.quantity} {item.unit} in stock
                        {item.costPrice !== undefined ? ` · ${formatCurrency(item.costPrice)}/${item.unit}` : ''}
                      </Text>
                    </View>
                    {alreadyAdded && (
                      <View style={[modalStyles.addedBadge, { backgroundColor: `${accent}20` }]}>
                        <Text variant="body-xs" weight="semibold" style={{ color: accent }}>Added</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
IngredientPickerModal.displayName = 'IngredientPickerModal';

const modalStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 32, maxHeight: '75%' },
  handle:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput:{ flex: 1, fontSize: 14, paddingVertical: 0 },
  optionRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8 },
  optionIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionInfo: { flex: 1, gap: 2 },
  addedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  empty:      { alignItems: 'center', paddingVertical: 32 },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const IngredientSelector = React.memo<IngredientSelectorProps>(
  ({ selectedIngredients, onIngredientsChange, isDark, accentColor }) => {
    const [pickerVisible, setPickerVisible] = useState(false);

    const selectedIds = useMemo(
      () => new Set(selectedIngredients.map((i) => i.ingredientId)),
      [selectedIngredients],
    );

    const totalCost = useMemo(
      () => selectedIngredients.reduce((sum, i) => sum + i.lineCost, 0),
      [selectedIngredients],
    );

    const handleSelect = useCallback(
      (id: string, name: string, unit: string, costPrice: number | undefined) => {
        const lineCost = 1 * (costPrice ?? 0);
        const next: SelectedIngredient = {
          ingredientId:   id,
          ingredientName: name,
          quantityUsed:   1,
          unit,
          lineCost,
          ...(costPrice !== undefined ? { costPrice } : {}),
        };
        onIngredientsChange([...selectedIngredients, next]);
      },
      [selectedIngredients, onIngredientsChange],
    );

    const handleRemove = useCallback(
      (ingredientId: string) => {
        onIngredientsChange(selectedIngredients.filter((i) => i.ingredientId !== ingredientId));
      },
      [selectedIngredients, onIngredientsChange],
    );

    const handleQtyChange = useCallback(
      (ingredientId: string, qty: number) => {
        onIngredientsChange(
          selectedIngredients.map((i) =>
            i.ingredientId === ingredientId
              ? { ...i, quantityUsed: qty, lineCost: qty * (i.costPrice ?? 0) }
              : i,
          ),
        );
      },
      [selectedIngredients, onIngredientsChange],
    );

    const headerColor = isDark ? 'rgba(255,255,255,0.75)' : staticTheme.colors.gray[600];
    const emptyColor  = isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400];
    const totalBg     = isDark ? `${accentColor}14` : `${accentColor}10`;
    const totalBdr    = isDark ? `${accentColor}30` : `${accentColor}25`;

    return (
      <View>
        {/* Section header */}
        <View style={headerStyles.row}>
          <View style={[headerStyles.iconPill, { backgroundColor: `${accentColor}20` }]}>
            <Wheat size={14} color={accentColor} />
          </View>
          <Text variant="body-sm" weight="semibold" style={{ color: headerColor }}>
            Ingredients Used
          </Text>
          {selectedIngredients.length > 0 && (
            <View style={[headerStyles.countBadge, { backgroundColor: `${accentColor}20` }]}>
              <Text variant="body-xs" weight="bold" style={{ color: accentColor }}>
                {selectedIngredients.length}
              </Text>
            </View>
          )}
        </View>

        {/* Selected list */}
        {selectedIngredients.length === 0 ? (
          <View style={listStyles.emptyHint}>
            <Text variant="body-sm" style={{ color: emptyColor, textAlign: 'center' }}>
              No ingredients added yet.{'\n'}Tap below to link ingredients to this product.
            </Text>
          </View>
        ) : (
          <>
            {selectedIngredients.map((item) => (
              <IngredientRow
                key={item.ingredientId}
                item={item}
                isDark={isDark}
                accent={accentColor}
                onRemove={handleRemove}
                onQtyChange={handleQtyChange}
              />
            ))}

            {/* Total cost bar */}
            <View style={[listStyles.totalBar, { backgroundColor: totalBg, borderColor: totalBdr }]}>
              <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[600] }}>
                Total Ingredient Cost
              </Text>
              <Text variant="body" weight="bold" style={{ color: accentColor }}>
                {formatCurrency(totalCost)}
              </Text>
            </View>
          </>
        )}

        {/* Add button */}
        <Button
          title="Add Ingredient"
          variant="outline"
          size="sm"
          onPress={() => setPickerVisible(true)}
          leftIcon={<Plus size={15} color={accentColor} />}
          fullWidth
          style={{ marginTop: 8 }}
        />

        <IngredientPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          isDark={isDark}
          accent={accentColor}
        />
      </View>
    );
  },
);
IngredientSelector.displayName = 'IngredientSelector';

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: staticTheme.spacing.md,
  },
  iconPill: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 2,
  },
});

const listStyles = StyleSheet.create({
  emptyHint: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
    marginTop: 2,
  },
});
