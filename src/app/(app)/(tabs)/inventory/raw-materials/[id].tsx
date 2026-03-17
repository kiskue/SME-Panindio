/**
 * Edit Raw Material Screen — Premium Redesign
 *
 * Pre-filled form for editing an existing raw material.
 * Shares the same section structure as add.tsx.
 * Includes a styled Danger Zone at the bottom for deactivation.
 *
 * Full dark mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { ChevronLeft, Package, Tag, Ruler, BarChart2, Check, X, Trash2, AlertCircle } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { Text } from '@/components/atoms/Text';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import {
  useRawMaterialsStore,
  selectRawMaterials,
  selectRawMaterialsSaving,
  selectRawMaterialsError,
} from '@/store';
import type { UpdateRawMaterialInput, RawMaterialUnit, RawMaterialCategory } from '@/types';

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = Yup.object({
  name:              Yup.string().trim().min(1).required('Name is required'),
  description:       Yup.string().optional(),
  unit:              Yup.string().oneOf<RawMaterialUnit>(
    ['piece','pack','roll','box','kg','liter','sheet','bag','bottle','set','other'],
  ).required('Unit is required'),
  quantityInStock:   Yup.number().min(0).required(),
  minimumStockLevel: Yup.number().min(0).required(),
  costPerUnit:       Yup.number().min(0).required(),
  category:          Yup.string().oneOf<RawMaterialCategory>(
    ['packaging','cleaning','utensils','office','other'],
  ).optional(),
});

type FormData = Yup.InferType<typeof schema>;

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ value: RawMaterialCategory; label: string; emoji: string; color: string; desc: string }> = [
  { value: 'packaging', label: 'Packaging', emoji: '📦', color: '#6366F1', desc: 'Bags, boxes, containers' },
  { value: 'cleaning',  label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9', desc: 'Soaps, detergents' },
  { value: 'utensils',  label: 'Utensils',  emoji: '🍴', color: '#F59E0B', desc: 'Cutlery, plates' },
  { value: 'office',    label: 'Office',    emoji: '📎', color: '#8B5CF6', desc: 'Paper, pens, etc.' },
  { value: 'other',     label: 'Other',     emoji: '📋', color: '#64748B', desc: 'Miscellaneous supplies' },
];

const UNITS: Array<{ value: RawMaterialUnit; label: string }> = [
  { value: 'piece',  label: 'Piece' },
  { value: 'pack',   label: 'Pack' },
  { value: 'roll',   label: 'Roll' },
  { value: 'box',    label: 'Box' },
  { value: 'bag',    label: 'Bag' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'sheet',  label: 'Sheet' },
  { value: 'kg',     label: 'kg' },
  { value: 'liter',  label: 'Liter' },
  { value: 'set',    label: 'Set' },
  { value: 'other',  label: 'Other' },
];

// ─── SectionHeader sub-component ─────────────────────────────────────────────

interface SectionHeaderProps { icon: React.ReactNode; title: string; isDark: boolean }

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, isDark }) => (
  <View style={[
    sectionStyles.header,
    { borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100] },
  ]}>
    <View style={[sectionStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100] }]}>
      {icon}
    </View>
    <Text variant="body-sm" weight="bold" style={{ color: isDark ? 'rgba(255,255,255,0.80)' : staticTheme.colors.gray[700] }}>
      {title}
    </Text>
  </View>
);

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginTop:      staticTheme.spacing.lg,
    marginBottom:   staticTheme.spacing.md - 2,
    paddingBottom:  staticTheme.spacing.sm + 2,
    borderBottomWidth: 1,
  },
  iconWrap: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditRawMaterialScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ id: string }>();
  const id      = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '');

  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';

  const allMaterials = useRawMaterialsStore(selectRawMaterials);
  const material     = id ? (allMaterials.find((m) => m.id === id) ?? null) : null;

  const isSaving = useRawMaterialsStore(selectRawMaterialsSaving);
  const error    = useRawMaterialsStore(selectRawMaterialsError);
  const { updateRawMaterial, deleteRawMaterial, clearError } = useRawMaterialsStore(
    useShallow((s) => ({
      updateRawMaterial: s.updateRawMaterial,
      deleteRawMaterial: s.deleteRawMaterial,
      clearError:        s.clearError,
    })),
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name:              '',
      description:       '',
      unit:              'piece',
      quantityInStock:   0,
      minimumStockLevel: 0,
      costPerUnit:       0,
    },
  });

  useEffect(() => {
    if (!material) return;
    reset({
      name:              material.name,
      description:       material.description ?? '',
      unit:              material.unit,
      quantityInStock:   material.quantityInStock,
      minimumStockLevel: material.minimumStockLevel,
      costPerUnit:       material.costPerUnit,
      ...(material.category ? { category: material.category } : {}),
    });
  }, [material, reset]);

  const selectedUnit = watch('unit');
  const selectedCat  = watch('category');
  const watchedQty   = watch('quantityInStock');
  const watchedCost  = watch('costPerUnit');
  const totalValue   = (watchedQty || 0) * (watchedCost || 0);

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (!id) return;
      clearError();
      const patch: UpdateRawMaterialInput = {
        name:              data.name,
        unit:              data.unit as RawMaterialUnit,
        quantityInStock:   data.quantityInStock,
        minimumStockLevel: data.minimumStockLevel,
        costPerUnit:       data.costPerUnit,
        ...(data.description ? { description: data.description } : {}),
        ...(data.category    ? { category:    data.category as RawMaterialCategory } : {}),
      };
      try {
        await updateRawMaterial(id, patch);
        router.back();
      } catch {
        // error shown via store
      }
    },
    [id, updateRawMaterial, clearError, router],
  );

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Deactivate Material',
      `Are you sure you want to deactivate "${material?.name ?? 'this material'}"?\n\nIt will no longer appear in active lists, but its usage history is preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            try {
              await deleteRawMaterial(id);
              router.back();
            } catch {
              // error shown via store
            }
          },
        },
      ],
    );
  }, [id, material, deleteRawMaterial, router]);

  const accent = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  // ── Dynamic styles ────────────────────────────────────────────────────────
  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor:  theme.colors.surface,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100],
    },
    headerTitle:    { color: theme.colors.text },
    scroll:         { backgroundColor: theme.colors.background },
    fieldLabel: {
      color: isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[600],
    },
    helperText: {
      color: theme.colors.textSecondary,
    },
    input: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? '#1E2435' : '#fff',
      color:           theme.colors.text,
    },
    inputPrefix: {
      backgroundColor:  isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[50],
      borderRightColor: isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    inputSuffix: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[50],
      borderLeftColor: isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    inputPrefixText: {
      color: theme.colors.textSecondary,
    },
    optionBtnBase: {
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    },
    unitActiveBg: {
      backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : staticTheme.colors.primary[50],
      borderColor:     isDark ? 'rgba(79,158,255,0.40)' : staticTheme.colors.primary[300],
    },
    valuePreviewBox: {
      backgroundColor: isDark ? 'rgba(61,214,140,0.08)' : '#F0FDF4',
      borderColor:     isDark ? 'rgba(61,214,140,0.25)' : '#BBF7D0',
    },
    dangerSection: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FFF1F2',
      borderColor:     isDark ? 'rgba(239,68,68,0.25)' : '#FECDD3',
    },
    dangerTitle: {
      color: isDark ? '#FF8FA3' : '#9F1239',
    },
    dangerNote: {
      color: isDark ? 'rgba(255,143,163,0.65)' : 'rgba(159,18,57,0.70)',
    },
    dangerBtn: {
      borderColor:     isDark ? 'rgba(239,68,68,0.30)' : '#FECDD3',
      backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#fff',
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor:  isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100],
    },
    cancelBtn: {
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    cancelBtnText:  { color: theme.colors.textSecondary },
    notFoundText:   { color: theme.colors.textSecondary },
  }), [theme, isDark]);

  // Focus tracking
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const inputBorder = useCallback((field: string, hasError: boolean) => {
    if (hasError)                return { borderColor: isDark ? '#FF6B6B' : '#EF4444' };
    if (focusedField === field)  return { borderColor: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.primary[300] };
    return {};
  }, [focusedField, isDark]);

  // Not-found state
  if (!material) {
    return (
      <View style={[dynStyles.container, { justifyContent: 'center', alignItems: 'center', gap: 16, padding: staticTheme.spacing.xl }]}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100], alignItems: 'center', justifyContent: 'center' }}>
          <Package size={32} color={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]} />
        </View>
        <Text variant="h5" weight="bold" style={dynStyles.notFoundText}>
          Material not found
        </Text>
        <Text variant="body-sm" style={dynStyles.notFoundText} numberOfLines={2}>
          This material may have been removed or the link is invalid.
        </Text>
        <Pressable
          style={[staticStyles.backFromNotFound, { backgroundColor: accent + '18', borderColor: accent + '30' }]}
          onPress={() => router.back()}
        >
          <ChevronLeft size={16} color={accent} />
          <Text variant="body-sm" weight="semibold" style={{ color: accent }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={dynStyles.container}>
        {/* ── Header ── */}
        <View style={[staticStyles.header, dynStyles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={staticStyles.backBtn} hitSlop={10}>
            <ChevronLeft size={22} color={theme.colors.textSecondary} />
          </Pressable>
          <View style={staticStyles.headerCenter}>
            <Text variant="body" weight="bold" style={dynStyles.headerTitle} numberOfLines={1}>
              {material.name}
            </Text>
            {isDirty ? (
              <Text variant="body-xs" style={{ color: isDark ? '#FFB020' : '#D97706' }}>
                Unsaved changes
              </Text>
            ) : null}
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={[staticStyles.scroll, dynStyles.scroll]}
          contentContainerStyle={staticStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Error */}
          {error ? (
            <Pressable style={staticStyles.errorBox} onPress={clearError}>
              <Text variant="body-xs" weight="semibold" style={{ color: '#fff', flex: 1 }}>
                {error}
              </Text>
              <X size={14} color="#fff" />
            </Pressable>
          ) : null}

          {/* ── Section 1: Basic Info ── */}
          <SectionHeader
            icon={<Package size={15} color={accent} />}
            title="Basic Information"
            isDark={isDark}
          />

          <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
            Material Name *
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                style={[
                  staticStyles.input,
                  dynStyles.input,
                  inputBorder('name', !!errors.name),
                ]}
                value={value}
                onChangeText={onChange}
                onBlur={() => { onBlur(); setFocusedField(null); }}
                onFocus={() => setFocusedField('name')}
                autoCapitalize="words"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
              />
            )}
          />
          {errors.name ? (
            <Text variant="body-xs" style={staticStyles.errText}>{errors.name.message}</Text>
          ) : null}

          <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
            Description
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                style={[
                  staticStyles.input,
                  staticStyles.multiline,
                  dynStyles.input,
                  inputBorder('description', false),
                ]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={() => { onBlur(); setFocusedField(null); }}
                onFocus={() => setFocusedField('description')}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder="Optional notes…"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
              />
            )}
          />

          {/* ── Section 2: Category ── */}
          <SectionHeader
            icon={<Tag size={15} color="#6366F1" />}
            title="Category"
            isDark={isDark}
          />

          <View style={staticStyles.categoryGrid}>
            {CATEGORIES.map((c) => {
              const active = selectedCat === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[
                    staticStyles.categoryBtn,
                    dynStyles.optionBtnBase,
                    active && {
                      backgroundColor: isDark ? c.color + '25' : c.color + '18',
                      borderColor:     c.color + '70',
                    },
                  ]}
                  onPress={() => setValue('category', c.value)}
                >
                  {active ? (
                    <View style={[staticStyles.checkMark, { backgroundColor: c.color }]}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  ) : null}
                  <Text style={staticStyles.categoryEmoji}>{c.emoji}</Text>
                  <Text
                    variant="body-xs"
                    weight={active ? 'bold' : 'semibold'}
                    style={{ color: active ? c.color : theme.colors.text }}
                  >
                    {c.label}
                  </Text>
                  <Text
                    variant="body-xs"
                    style={{ color: active ? c.color + 'BB' : theme.colors.textSecondary }}
                    numberOfLines={1}
                  >
                    {c.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Section 3: Unit ── */}
          <SectionHeader
            icon={<Ruler size={15} color="#F59E0B" />}
            title="Unit of Measurement *"
            isDark={isDark}
          />

          <View style={staticStyles.unitGrid}>
            {UNITS.map((u) => {
              const active = selectedUnit === u.value;
              return (
                <Pressable
                  key={u.value}
                  style={[
                    staticStyles.unitBtn,
                    dynStyles.optionBtnBase,
                    active && dynStyles.unitActiveBg,
                  ]}
                  onPress={() => setValue('unit', u.value)}
                >
                  <Text
                    variant="body-xs"
                    weight={active ? 'bold' : 'medium'}
                    style={{ color: active ? accent : theme.colors.textSecondary }}
                  >
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.unit ? (
            <Text variant="body-xs" style={staticStyles.errText}>{errors.unit.message}</Text>
          ) : null}

          {/* ── Section 4: Stock & Cost ── */}
          <SectionHeader
            icon={<BarChart2 size={15} color={isDark ? '#3DD68C' : '#16A34A'} />}
            title="Stock & Cost"
            isDark={isDark}
          />

          <View style={staticStyles.row2}>
            <View style={{ flex: 1 }}>
              <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
                Current Stock
              </Text>
              <View style={staticStyles.inputWithSuffix}>
                <Controller
                  control={control}
                  name="quantityInStock"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[
                        staticStyles.input,
                        staticStyles.inputFlex,
                        dynStyles.input,
                        inputBorder('qty', !!errors.quantityInStock),
                        { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
                      ]}
                      value={value === 0 ? '' : String(value)}
                      onChangeText={(v) => onChange(parseFloat(v) || 0)}
                      onBlur={() => { onBlur(); setFocusedField(null); }}
                      onFocus={() => setFocusedField('qty')}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                <View style={[staticStyles.inputSuffix, dynStyles.inputSuffix]}>
                  <Text variant="body-xs" weight="semibold" style={dynStyles.inputPrefixText}>{selectedUnit}</Text>
                </View>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
                Minimum Stock
              </Text>
              <View style={staticStyles.inputWithSuffix}>
                <Controller
                  control={control}
                  name="minimumStockLevel"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[
                        staticStyles.input,
                        staticStyles.inputFlex,
                        dynStyles.input,
                        inputBorder('min', !!errors.minimumStockLevel),
                        { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
                      ]}
                      value={value === 0 ? '' : String(value)}
                      onChangeText={(v) => onChange(parseFloat(v) || 0)}
                      onBlur={() => { onBlur(); setFocusedField(null); }}
                      onFocus={() => setFocusedField('min')}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                <View style={[staticStyles.inputSuffix, dynStyles.inputSuffix]}>
                  <Text variant="body-xs" weight="semibold" style={dynStyles.inputPrefixText}>{selectedUnit}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
            Cost per {selectedUnit} (₱)
          </Text>
          <View style={staticStyles.inputWithPrefix}>
            <View style={[staticStyles.inputPrefix, dynStyles.inputPrefix]}>
              <Text variant="body-sm" weight="bold" style={dynStyles.inputPrefixText}>₱</Text>
            </View>
            <Controller
              control={control}
              name="costPerUnit"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[
                    staticStyles.input,
                    staticStyles.inputFlex,
                    dynStyles.input,
                    inputBorder('cost', !!errors.costPerUnit),
                    { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
                  ]}
                  value={value === 0 ? '' : String(value)}
                  onChangeText={(v) => onChange(parseFloat(v) || 0)}
                  onBlur={() => { onBlur(); setFocusedField(null); }}
                  onFocus={() => setFocusedField('cost')}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                />
              )}
            />
          </View>
          {errors.costPerUnit ? (
            <Text variant="body-xs" style={staticStyles.errText}>{errors.costPerUnit.message}</Text>
          ) : null}

          {/* Total value preview */}
          {totalValue > 0 ? (
            <View style={[staticStyles.valuePreview, dynStyles.valuePreviewBox]}>
              <Text variant="body-xs" style={{ color: isDark ? 'rgba(61,214,140,0.80)' : '#15803D' }}>
                Current stock value
              </Text>
              <Text variant="body-sm" weight="bold" style={{ color: isDark ? '#3DD68C' : '#15803D' }}>
                ₱{totalValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </Text>
            </View>
          ) : null}

          {/* ── Danger Zone ── */}
          <View style={[staticStyles.dangerSection, dynStyles.dangerSection]}>
            <View style={staticStyles.dangerHeader}>
              <AlertCircle size={16} color={isDark ? '#FF8FA3' : '#9F1239'} />
              <Text variant="body-sm" weight="bold" style={dynStyles.dangerTitle}>
                Danger Zone
              </Text>
            </View>
            <Text variant="body-xs" style={dynStyles.dangerNote}>
              Deactivating this material removes it from active lists and pickers. Its usage history and records are preserved.
            </Text>
            <Pressable
              style={[staticStyles.dangerBtn, dynStyles.dangerBtn]}
              onPress={handleDelete}
            >
              <Trash2 size={15} color="#EF4444" />
              <Text variant="body-sm" weight="semibold" style={{ color: '#EF4444' }}>
                Deactivate "{material.name}"
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[staticStyles.footer, dynStyles.footer, { paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md) }]}>
          <Pressable style={[staticStyles.cancelBtn, dynStyles.cancelBtn]} onPress={() => router.back()}>
            <Text variant="body-sm" weight="semibold" style={dynStyles.cancelBtnText}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              staticStyles.saveBtn,
              isSaving && staticStyles.disabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving}
          >
            <Text variant="body-sm" weight="bold" style={{ color: '#fff' }}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:  staticTheme.spacing.md - 4,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding:        staticTheme.spacing.xs,
    minWidth:       44,
    minHeight:      44,
    alignItems:     'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex:      1,
    alignItems: 'center',
    gap:        2,
  },
  scroll:        { flex: 1 },
  scrollContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.xl + staticTheme.spacing.sm,
  },
  errorBox: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    backgroundColor: '#EF4444',
    borderRadius:   staticTheme.borderRadius.lg,
    padding:        staticTheme.spacing.sm + 4,
    marginBottom:   staticTheme.spacing.md,
  },
  fieldLabel: {
    marginBottom: staticTheme.spacing.xs + 2,
    marginTop:    staticTheme.spacing.sm - 2,
  },
  input: {
    borderWidth:    1,
    borderRadius:   staticTheme.borderRadius.lg,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.md - 4,
    fontSize:       15,
    marginBottom:   staticTheme.spacing.xs,
    minHeight:      50,
  },
  inputFlex: {
    flex:         1,
    marginBottom: 0,
  },
  multiline: {
    height:          96,
    textAlignVertical: 'top',
    minHeight:       96,
  },
  errText: {
    color:        '#EF4444',
    marginBottom: staticTheme.spacing.xs,
    marginTop:    2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           staticTheme.spacing.sm,
    marginTop:     staticTheme.spacing.sm,
    marginBottom:  staticTheme.spacing.xs,
  },
  categoryBtn: {
    width:       '47%',
    flexGrow:    1,
    alignItems:  'center',
    paddingVertical: staticTheme.spacing.md,
    paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    gap:         4,
    position:    'relative',
    minHeight:   96,
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 28,
    marginBottom: 2,
  },
  checkMark: {
    position:       'absolute',
    top:            8,
    right:          8,
    width:          18,
    height:         18,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           staticTheme.spacing.sm,
    marginTop:     staticTheme.spacing.sm,
    marginBottom:  staticTheme.spacing.xs,
  },
  unitBtn: {
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 1,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
    minHeight:      38,
    alignItems:     'center',
    justifyContent: 'center',
  },
  row2: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
    marginBottom:  staticTheme.spacing.xs,
  },
  inputWithPrefix: {
    flexDirection:   'row',
    marginBottom:    staticTheme.spacing.xs,
  },
  inputPrefix: {
    width:               48,
    alignItems:          'center',
    justifyContent:      'center',
    borderTopLeftRadius: staticTheme.borderRadius.lg,
    borderBottomLeftRadius: staticTheme.borderRadius.lg,
    borderWidth:         1,
  },
  inputWithSuffix: {
    flexDirection:   'row',
    marginBottom:    staticTheme.spacing.xs,
  },
  inputSuffix: {
    paddingHorizontal:      staticTheme.spacing.sm,
    alignItems:             'center',
    justifyContent:         'center',
    borderTopRightRadius:   staticTheme.borderRadius.lg,
    borderBottomRightRadius: staticTheme.borderRadius.lg,
    borderWidth:            1,
    minWidth:               42,
  },
  valuePreview: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 2,
    marginTop:      staticTheme.spacing.sm,
  },
  // Danger zone
  dangerSection: {
    marginTop:    staticTheme.spacing.xl,
    padding:      staticTheme.spacing.md,
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    gap:          staticTheme.spacing.sm + 2,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm - 2,
  },
  dangerBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    paddingVertical: staticTheme.spacing.sm + 4,
    paddingHorizontal: staticTheme.spacing.md - 2,
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
    minHeight:      48,
  },
  // Footer
  footer: {
    flexDirection:  'row',
    gap:            staticTheme.spacing.sm + 2,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:     staticTheme.spacing.md - 4,
    borderTopWidth: 1,
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
  saveBtn: {
    flex:           2,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: staticTheme.spacing.md - 2,
    borderRadius:   staticTheme.borderRadius.xl,
    backgroundColor: staticTheme.colors.primary[500],
    minHeight:      54,
  },
  disabled: { opacity: 0.42 },
  backFromNotFound: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.xs,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm + 2,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
    marginTop:      staticTheme.spacing.sm,
  },
});
