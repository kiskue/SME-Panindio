/**
 * InventoryFieldPicker — shared inventory form controls
 *
 * Consolidates the `PickerTrigger`, `GenericPickerModal` and option lists that
 * were duplicated almost verbatim across:
 *   - inventory/add.tsx
 *   - inventory/[id].tsx
 *
 * The dark-mode-aware implementation from add.tsx is used as the single source
 * of truth; `isDark` is resolved internally via `useThemeMode()` so call sites
 * no longer pass a flag. Section headers stay local to each screen because they
 * are styled differently per screen (dot vs left-border).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Check, Package, Wheat, Wrench } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import type { InventoryCategory, EquipmentCondition, StockUnit } from '@/types';

// ─── Option type ────────────────────────────────────────────────────────────────

export interface PickerOption<T extends string> {
  value:        T;
  label:        string;
  description?: string;
  icon?:        React.ReactNode;
}

// ─── Config lists ─────────────────────────────────────────────────────────────

export const UNIT_OPTIONS: PickerOption<StockUnit>[] = [
  { value: 'pcs',    label: 'Pieces (pcs)' },
  { value: 'kg',     label: 'Kilograms (kg)' },
  { value: 'g',      label: 'Grams (g)' },
  { value: 'L',      label: 'Litres (L)' },
  { value: 'mL',     label: 'Millilitres (mL)' },
  { value: 'box',    label: 'Box' },
  { value: 'bag',    label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'pack',   label: 'Pack' },
  { value: 'dozen',  label: 'Dozen' },
  { value: 'roll',   label: 'Roll' },
  { value: 'meter',  label: 'Meter (m)' },
  { value: 'set',    label: 'Set' },
  { value: 'cup',    label: 'Cup' },
];

export const CONDITION_OPTIONS: PickerOption<EquipmentCondition>[] = [
  { value: 'good', label: 'Good', description: 'Fully functional' },
  { value: 'fair', label: 'Fair', description: 'Working but showing wear' },
  { value: 'poor', label: 'Poor', description: 'Needs repair or replacement' },
];

export const CATEGORY_OPTIONS: PickerOption<InventoryCategory>[] = [
  { value: 'product',    label: 'Product',    description: 'Finished goods for sale',      icon: <Package size={20} color={staticTheme.colors.primary[500]} /> },
  { value: 'ingredient', label: 'Ingredient', description: 'Raw materials & consumables',  icon: <Wheat size={20} color={staticTheme.colors.success[500]} /> },
  { value: 'equipment',  label: 'Equipment',  description: 'Tools and assets',             icon: <Wrench size={20} color={staticTheme.colors.highlight[400]} /> },
];

/**
 * Resolve a category accent color for the active mode.
 * Delegates to the single source of truth in inventoryAccents.
 */
export function categoryAccent(cat: InventoryCategory | undefined, isDark: boolean): string {
  if (cat === undefined) return isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400];
  return getInventoryAccent(cat, isDark).accent;
}

// ─── Generic picker modal ─────────────────────────────────────────────────────

export interface GenericPickerModalProps<T extends string> {
  visible:  boolean;
  onClose:  () => void;
  title:    string;
  options:  PickerOption<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
}

export function GenericPickerModal<T extends string>({
  visible, onClose, title, options, selected, onSelect,
}: GenericPickerModalProps<T>) {
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const insets = useSafeAreaInsets();
  const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;
  const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: staticTheme.spacing.md,
      // Clear the home indicator / gesture bar; spacing.xl stays the floor so
      // devices without a bottom inset look unchanged.
      paddingBottom: Math.max(insets.bottom, staticTheme.spacing.xl),
      maxHeight: '72%',
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300],
      borderRadius: 2, alignSelf: 'center',
      marginTop: staticTheme.spacing.sm, marginBottom: staticTheme.spacing.md,
    },
    sheetTitle: { color: theme.colors.text, marginBottom: staticTheme.spacing.sm },
    optionPressed:  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.gray[50] },
    optionSelected: { backgroundColor: isDark ? `${accent}18` : staticTheme.colors.primary[50] },
    separator:      { height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.borderSubtle, marginVertical: 2 },
  }), [theme, sheetBg, isDark, accent, insets.bottom]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={dynStyles.handle} />
          <Text variant="h5" weight="semibold" style={dynStyles.sheetTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={dynStyles.separator} />}
            renderItem={({ item: opt }) => (
              <Pressable
                style={({ pressed }) => [
                  pickerStyles.option,
                  pressed && dynStyles.optionPressed,
                  selected === opt.value && dynStyles.optionSelected,
                ]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                {opt.icon !== undefined && (
                  <View style={pickerStyles.optionIcon}>{opt.icon}</View>
                )}
                <View style={pickerStyles.optionText}>
                  <Text variant="body" weight="medium" style={{ color: theme.colors.text }}>{opt.label}</Text>
                  {opt.description !== undefined && (
                    <Text variant="body-sm" color="gray">{opt.description}</Text>
                  )}
                </View>
                {selected === opt.value && <Check size={18} color={accent} />}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.md, gap: staticTheme.spacing.md,
  },
  optionIcon: { width: 32, alignItems: 'center' },
  optionText: { flex: 1, gap: 2 },
});

// ─── Picker trigger ───────────────────────────────────────────────────────────

export interface PickerTriggerProps {
  label:        string;
  value:        string | undefined;
  placeholder:  string;
  onPress:      () => void;
  error?:       string;
  /** Accent color applied to the selected value text. Defaults to theme text. */
  accentColor?: string;
}

export const PickerTrigger = React.memo<PickerTriggerProps>(
  ({ label, value, placeholder, onPress, error, accentColor }) => {
    const theme  = useAppTheme();
    const isDark = useThemeMode() === 'dark';

    const dynStyles = useMemo(() => StyleSheet.create({
      labelText: { color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: staticTheme.spacing.xs },
      trigger: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1,
        borderColor: error !== undefined
          ? staticTheme.colors.error[500]
          : isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border,
        borderRadius: staticTheme.borderRadius.md,
        paddingHorizontal: staticTheme.spacing.md,
        paddingVertical: staticTheme.spacing.sm,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : theme.colors.surface,
        minHeight: 48,
      },
      triggerPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.gray[50] },
    }), [theme, isDark, error]);

    return (
      <View style={triggerStyles.wrapper}>
        <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>{label}</Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [dynStyles.trigger, pressed && dynStyles.triggerPressed]}
        >
          <Text
            variant="body"
            style={{
              color: value !== undefined
                ? (accentColor ?? theme.colors.text)
                : (isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder),
              flex: 1,
            }}
          >
            {value ?? placeholder}
          </Text>
          <ChevronDown size={18} color={isDark ? 'rgba(255,255,255,0.30)' : theme.colors.gray[400]} />
        </Pressable>
        {error !== undefined && (
          <Text variant="body-xs" style={triggerStyles.errorText}>{error}</Text>
        )}
      </View>
    );
  },
);
PickerTrigger.displayName = 'PickerTrigger';

const triggerStyles = StyleSheet.create({
  wrapper:   { marginBottom: staticTheme.spacing.md },
  errorText: { color: staticTheme.colors.error[500], marginTop: staticTheme.spacing.xs },
});
