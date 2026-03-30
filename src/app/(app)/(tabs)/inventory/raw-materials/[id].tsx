/**
 * Edit Raw Material Screen — 2025 Redesign
 *
 * Pre-filled form matching add.tsx structure.
 * Header shows material name + "Unsaved changes" pill when dirty.
 * Danger Zone: red left-border card — visually distinct from form sections.
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
import { useAppDialog } from '@/hooks';

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

// ─── SectionBadge sub-component ───────────────────────────────────────────────

interface SectionBadgeProps {
  number:  number;
  title:   string;
  icon:    React.ReactNode;
  accent:  string;
  isDark:  boolean;
}

const SectionBadge: React.FC<SectionBadgeProps> = ({ number, title, icon: _icon, accent, isDark }) => (
  <View style={badgeStyles.row}>
    <View style={[badgeStyles.badge, { backgroundColor: accent }]}>
      <Text variant="body-xs" weight="bold" style={{ color: '#fff', lineHeight: 16 }}>
        {number}
      </Text>
    </View>
    <Text
      variant="body"
      weight="bold"
      style={{ color: isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[800] }}
    >
      {title}
    </Text>
  </View>
);

const badgeStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginTop:      staticTheme.spacing.lg,
    marginBottom:   staticTheme.spacing.sm + 2,
  },
  badge: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
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
  const dialog  = useAppDialog();

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
    dialog.confirm({
      title:       'Deactivate Material',
      message:     `Are you sure you want to deactivate "${material?.name ?? 'this material'}"?\n\nIt will no longer appear in active lists, but its usage history is preserved.`,
      confirmText: 'Deactivate',
      cancelText:  'Cancel',
      onConfirm:   async () => {
        if (!id) return;
        try {
          await deleteRawMaterial(id);
          router.back();
        } catch {
          // error shown via store
        }
      },
    });
  }, [id, material, deleteRawMaterial, router, dialog]);

  const accent      = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const pageBg      = isDark ? '#0F1117' : '#F8FAFC';
  const surfaceBg   = isDark ? '#1A2235' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : '#E8EDF3';

  // Input theme
  const inputBg           = isDark ? '#242D42' : '#FFFFFF';
  const inputBorderRest   = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
  const inputTextColor: string = theme.colors.text as string;
  const prefixBg          = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
  const prefixBorderColor = isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0';

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const inputBorder = useCallback((field: string, hasError: boolean) => {
    if (hasError)               return { borderColor: isDark ? '#FF6B6B' : '#EF4444' };
    if (focusedField === field) return { borderColor: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.primary[300] };
    return { borderColor: inputBorderRest };
  }, [focusedField, isDark, inputBorderRest]);

  const dynStyles = useMemo(() => StyleSheet.create({
    container:    { flex: 1, backgroundColor: pageBg },
    scroll:       { backgroundColor: pageBg },
    fieldLabel:   { color: isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.gray[500] },
    helperText:   { color: theme.colors.textSecondary },
    input:        { borderColor: inputBorderRest, backgroundColor: inputBg, color: inputTextColor },
    prefixBlock:  { backgroundColor: prefixBg, borderColor: prefixBorderColor },
    suffixBlock:  { backgroundColor: prefixBg, borderColor: prefixBorderColor },
    prefixText:   { color: theme.colors.textSecondary },
    unitActive:   {
      backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : staticTheme.colors.primary[50],
      borderColor:     isDark ? accent : staticTheme.colors.primary[400],
    },
    unitInactive: {
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : '#E2E8F0',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    },
    cancelBtn:        { borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' },
    cancelText:       { color: theme.colors.textSecondary },
    footer:           { backgroundColor: surfaceBg, borderTopColor: borderColor },
    notFoundText:     { color: theme.colors.textSecondary },
    // Section 4 card
    stockCard:        { backgroundColor: isDark ? '#1A2235' : '#F8FAFC', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' },
    stockCardIconWrap:{ backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : '#DCFCE7' },
    stockDivider:     { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0' },
    stockColDivider:  { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0' },
    stockInput:       { borderColor: isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200], backgroundColor: isDark ? '#242D42' : '#FFFFFF', color: inputTextColor },
    pesoInputWrap:    { borderColor: isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200], backgroundColor: isDark ? '#242D42' : '#FFFFFF' },
    pesoSign:         { color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500] },
    pesoTextInput:    { color: inputTextColor },
    valuePreviewRow:  { backgroundColor: isDark ? 'rgba(61,214,140,0.08)' : '#F0FDF4', borderColor: isDark ? 'rgba(61,214,140,0.20)' : '#BBF7D0' },
  }), [theme, isDark, pageBg, surfaceBg, borderColor, inputBg, inputBorderRest, inputTextColor, prefixBg, prefixBorderColor, accent]);

  // ── Not-found state ──────────────────────────────────────────────────────────
  if (!material) {
    return (
      <View style={[dynStyles.container, staticStyles.notFoundWrap]}>
        <View style={[staticStyles.notFoundIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]}>
          <Package size={34} color={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]} />
        </View>
        <Text variant="h5" weight="bold" style={dynStyles.notFoundText}>
          Material not found
        </Text>
        <Text variant="body-sm" style={[dynStyles.notFoundText, { textAlign: 'center' }]} numberOfLines={2}>
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

          {/* Unsaved changes banner */}
          {isDirty ? (
            <View style={[
              staticStyles.dirtyBanner,
              {
                backgroundColor: isDark ? 'rgba(255,176,32,0.10)' : '#FFFBEB',
                borderColor:     isDark ? 'rgba(255,176,32,0.28)' : '#FDE68A',
              },
            ]}>
              <Text variant="body-xs" weight="semibold" style={{ color: isDark ? '#FFB020' : '#D97706' }}>
                Unsaved changes — save or cancel to leave
              </Text>
            </View>
          ) : null}

          {/* ══ Section 1: Basic Information ══ */}
          <SectionBadge number={1} title="Basic Information" icon={<Package size={15} color={accent} />} accent={accent} isDark={isDark} />

          <Text variant="body-xs" weight="semibold" style={[staticStyles.fieldLabel, dynStyles.fieldLabel]}>
            Material Name *
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <TextInput
                style={[staticStyles.input, dynStyles.input, inputBorder('name', !!errors.name)]}
                value={value}
                onChangeText={onChange}
                onBlur={() => { onBlur(); setFocusedField(null); }}
                onFocus={() => setFocusedField('name')}
                autoCapitalize="words"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
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
                style={[staticStyles.input, staticStyles.multiline, dynStyles.input, inputBorder('description', false)]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={() => { onBlur(); setFocusedField(null); }}
                onFocus={() => setFocusedField('description')}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholder="Optional notes…"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
              />
            )}
          />

          {/* ══ Section 2: Category ══ */}
          <SectionBadge number={2} title="Category" icon={<Tag size={15} color="#6366F1" />} accent="#6366F1" isDark={isDark} />

          <View style={staticStyles.categoryGrid}>
            {CATEGORIES.map((c) => {
              const active = selectedCat === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[
                    staticStyles.categoryBtn,
                    {
                      backgroundColor: active
                        ? (isDark ? c.color + '28' : c.color + '15')
                        : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
                      borderColor: active
                        ? c.color
                        : (isDark ? 'rgba(255,255,255,0.10)' : '#E8EDF3'),
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                  onPress={() => setValue('category', c.value)}
                >
                  {active ? (
                    <View style={[staticStyles.checkMark, { backgroundColor: c.color }]}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  ) : null}
                  <View style={[staticStyles.categoryIconWrap, { backgroundColor: c.color + (isDark ? '28' : '18') }]}>
                    <Text style={staticStyles.categoryEmoji}>{c.emoji}</Text>
                  </View>
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

          {/* ══ Section 3: Unit ══ */}
          <SectionBadge number={3} title="Unit of Measurement *" icon={<Ruler size={15} color="#F59E0B" />} accent="#F59E0B" isDark={isDark} />

          <View style={staticStyles.unitGrid}>
            {UNITS.map((u) => {
              const active = selectedUnit === u.value;
              return (
                <Pressable
                  key={u.value}
                  style={[
                    staticStyles.unitBtn,
                    active ? dynStyles.unitActive : dynStyles.unitInactive,
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

          {/* ══ Section 4: Stock & Cost ══ */}
          <View style={[staticStyles.stockCard, dynStyles.stockCard]}>

            {/* Card header */}
            <View style={staticStyles.stockCardHeader}>
              <View style={[staticStyles.stockCardIconWrap, dynStyles.stockCardIconWrap]}>
                <BarChart2 size={15} color={isDark ? '#3DD68C' : '#16A34A'} />
              </View>
              <Text variant="body-sm" weight="bold" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : staticTheme.colors.gray[800] }}>
                Stock &amp; Cost
              </Text>
            </View>

            <View style={[staticStyles.stockDivider, dynStyles.stockDivider]} />

            {/* Stock inputs row */}
            <View style={staticStyles.stockRow}>
              {/* Current Stock */}
              <View style={staticStyles.stockCol}>
                <Text variant="body-xs" weight="semibold" style={[staticStyles.stockFieldLabel, dynStyles.fieldLabel]}>
                  CURRENT STOCK *
                </Text>
                <Controller
                  control={control}
                  name="quantityInStock"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[
                        staticStyles.stockInput,
                        dynStyles.stockInput,
                        inputBorder('qty', !!errors.quantityInStock),
                      ]}
                      value={value === 0 ? '' : String(value)}
                      onChangeText={(v) => onChange(parseFloat(v) || 0)}
                      onBlur={() => { onBlur(); setFocusedField(null); }}
                      onFocus={() => setFocusedField('qty')}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                {errors.quantityInStock ? (
                  <Text variant="body-xs" style={staticStyles.errText}>{errors.quantityInStock.message}</Text>
                ) : (
                  <Text variant="body-xs" style={[staticStyles.stockHelper, dynStyles.helperText]}>
                    {selectedUnit} — how much on hand
                  </Text>
                )}
              </View>

              <View style={[staticStyles.stockColDivider, dynStyles.stockColDivider]} />

              {/* Minimum Stock */}
              <View style={staticStyles.stockCol}>
                <Text variant="body-xs" weight="semibold" style={[staticStyles.stockFieldLabel, dynStyles.fieldLabel]}>
                  MINIMUM STOCK *
                </Text>
                <Controller
                  control={control}
                  name="minimumStockLevel"
                  render={({ field: { onChange, value, onBlur } }) => (
                    <TextInput
                      style={[
                        staticStyles.stockInput,
                        dynStyles.stockInput,
                        inputBorder('min', !!errors.minimumStockLevel),
                      ]}
                      value={value === 0 ? '' : String(value)}
                      onChangeText={(v) => onChange(parseFloat(v) || 0)}
                      onBlur={() => { onBlur(); setFocusedField(null); }}
                      onFocus={() => setFocusedField('min')}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                {errors.minimumStockLevel ? (
                  <Text variant="body-xs" style={staticStyles.errText}>{errors.minimumStockLevel.message}</Text>
                ) : (
                  <Text variant="body-xs" style={[staticStyles.stockHelper, dynStyles.helperText]}>
                    {selectedUnit} — alert threshold
                  </Text>
                )}
              </View>
            </View>

            <View style={[staticStyles.stockDivider, dynStyles.stockDivider]} />

            {/* Cost per unit — full width with inline ₱ prefix */}
            <Text variant="body-xs" weight="semibold" style={[staticStyles.stockFieldLabel, dynStyles.fieldLabel]}>
              COST PER {(selectedUnit ?? 'unit').toUpperCase()} *
            </Text>
            <View style={[staticStyles.pesoInputWrap, dynStyles.pesoInputWrap, inputBorder('cost', !!errors.costPerUnit)]}>
              <Text variant="body-sm" weight="bold" style={[staticStyles.pesoSign, dynStyles.pesoSign]}>₱</Text>
              <Controller
                control={control}
                name="costPerUnit"
                render={({ field: { onChange, value, onBlur } }) => {
                  // Local string state preserves the raw text while typing
                  // so that intermediate inputs like "0." and "0.0" are not
                  // swallowed by parseFloat before the user finishes typing.
                  const [displayText, setDisplayText] = React.useState(
                    value === 0 ? '' : String(value),
                  );
                  // Sync display text when the form value is set externally
                  // (e.g. reset() called from the useEffect after material loads).
                  React.useEffect(() => {
                    if (focusedField !== 'cost') {
                      setDisplayText(value === 0 ? '' : String(value));
                    }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                  }, [value]);
                  return (
                    <TextInput
                      style={[staticStyles.pesoTextInput, dynStyles.pesoTextInput]}
                      value={displayText}
                      onChangeText={(v) => {
                        const sanitised = v.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
                        setDisplayText(sanitised);
                        const parsed = parseFloat(sanitised);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      onBlur={() => {
                        const parsed = parseFloat(displayText);
                        if (isNaN(parsed) || parsed === 0) {
                          setDisplayText('');
                          onChange(0);
                        } else {
                          setDisplayText(String(parsed));
                        }
                        onBlur();
                        setFocusedField(null);
                      }}
                      onFocus={() => setFocusedField('cost')}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[400]}
                    />
                  );
                }}
              />
            </View>
            {errors.costPerUnit ? (
              <Text variant="body-xs" style={staticStyles.errText}>{errors.costPerUnit.message}</Text>
            ) : (
              <Text variant="body-xs" style={[staticStyles.stockHelper, dynStyles.helperText]}>
                Your purchase cost — used for expense tracking
              </Text>
            )}

            <View style={[staticStyles.stockDivider, dynStyles.stockDivider]} />

            {/* Stock value preview — always visible */}
            <View style={[staticStyles.valuePreviewRow, dynStyles.valuePreviewRow]}>
              <View style={staticStyles.valuePreviewLeft}>
                <BarChart2 size={13} color={isDark ? 'rgba(61,214,140,0.70)' : '#16A34A'} />
                <Text variant="body-xs" style={{ color: isDark ? 'rgba(61,214,140,0.80)' : '#15803D' }}>
                  Current stock value
                </Text>
              </View>
              <Text variant="body-sm" weight="bold" style={{ color: isDark ? '#3DD68C' : '#15803D' }}>
                ₱{totalValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </Text>
            </View>

          </View>

          {/* ── Danger Zone — red left-border card ── */}
          <View style={[
            staticStyles.dangerZone,
            {
              backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : '#FFF5F5',
              borderColor:     isDark ? 'rgba(239,68,68,0.20)' : '#FECDD3',
            },
          ]}>
            {/* Red left accent bar */}
            <View style={staticStyles.dangerLeftBar} />

            <View style={staticStyles.dangerInner}>
              <View style={staticStyles.dangerHeader}>
                <View style={[staticStyles.dangerIconWrap, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FFE4E6' }]}>
                  <AlertCircle size={16} color={isDark ? '#FF8FA3' : '#E11D48'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body-sm" weight="bold" style={{ color: isDark ? '#FF8FA3' : '#9F1239' }}>
                    Danger Zone
                  </Text>
                  <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,143,163,0.60)' : 'rgba(159,18,57,0.65)' }}>
                    This action cannot be easily undone
                  </Text>
                </View>
              </View>

              <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,143,163,0.55)' : 'rgba(159,18,57,0.65)' }}>
                Deactivating this material removes it from active lists and pickers. Its usage history and records are preserved.
              </Text>

              <Pressable
                style={[
                  staticStyles.dangerBtn,
                  {
                    backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fff',
                    borderColor:     isDark ? 'rgba(239,68,68,0.35)' : '#FECDD3',
                  },
                ]}
                onPress={handleDelete}
              >
                <Trash2 size={15} color="#EF4444" />
                <Text variant="body-sm" weight="semibold" style={{ color: '#EF4444' }}>
                  Deactivate "{material.name}"
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[staticStyles.footer, dynStyles.footer, { paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md) }]}>
          <Pressable style={[staticStyles.cancelBtn, dynStyles.cancelBtn]} onPress={() => router.back()}>
            <Text variant="body-sm" weight="semibold" style={dynStyles.cancelText}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[staticStyles.saveBtn, isSaving && staticStyles.disabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSaving}
          >
            <Text variant="body-sm" weight="bold" style={{ color: '#fff' }}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </View>
      {dialog.Dialog}
    </KeyboardAvoidingView>
  );
}

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  notFoundWrap: {
    justifyContent:    'center',
    alignItems:        'center',
    gap:               16,
    padding:           staticTheme.spacing.xl,
  },
  notFoundIcon: {
    width:          72,
    height:         72,
    borderRadius:   22,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backFromNotFound: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.xs,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm + 2,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    marginTop:         staticTheme.spacing.sm,
  },
  dirtyBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.xs + 2,
    marginBottom:      staticTheme.spacing.sm,
  },
  scroll:        { flex: 1 },
  scrollContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    paddingBottom:     staticTheme.spacing.xl + staticTheme.spacing.sm,
  },
  errorBox: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             staticTheme.spacing.sm,
    backgroundColor: '#EF4444',
    borderRadius:    staticTheme.borderRadius.lg,
    padding:         staticTheme.spacing.sm + 4,
    marginBottom:    staticTheme.spacing.md,
  },
  fieldLabel: {
    marginBottom: staticTheme.spacing.xs + 2,
    marginTop:    staticTheme.spacing.sm - 2,
  },
  input: {
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.lg,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.md - 4,
    fontSize:          15,
    marginBottom:      staticTheme.spacing.xs,
    minHeight:         52,
  },
  inputFlex: {
    flex:         1,
    marginBottom: 0,
  },
  multiline: {
    height:            96,
    textAlignVertical: 'top',
    minHeight:         96,
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
    width:          '47%',
    flexGrow:       1,
    alignItems:     'center',
    paddingVertical: staticTheme.spacing.md + 2,
    paddingHorizontal: staticTheme.spacing.sm,
    borderRadius:   staticTheme.borderRadius.xl,
    gap:            4,
    position:       'relative',
    minHeight:      100,
    justifyContent: 'center',
  },
  categoryIconWrap: {
    width:          48,
    height:         48,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   6,
    overflow:       'hidden',
  },
  categoryEmoji: {
    fontSize:   26,
    lineHeight: 32,
    textAlign:  'center',
  },
  checkMark: {
    position:       'absolute',
    top:            8,
    right:          8,
    width:          20,
    height:         20,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           staticTheme.spacing.sm - 2,
    marginTop:     staticTheme.spacing.sm,
    marginBottom:  staticTheme.spacing.xs,
  },
  unitBtn: {
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 1,
    borderRadius:      staticTheme.borderRadius.full,
    borderWidth:       1,
    minHeight:         38,
    alignItems:        'center',
    justifyContent:    'center',
  },
  row2: {
    flexDirection: 'row',
    gap:           staticTheme.spacing.sm,
    marginBottom:  staticTheme.spacing.xs,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    marginBottom:  staticTheme.spacing.xs,
  },
  inputPrefix: {
    width:                  48,
    alignItems:             'center',
    justifyContent:         'center',
    borderTopLeftRadius:    staticTheme.borderRadius.lg,
    borderBottomLeftRadius: staticTheme.borderRadius.lg,
    borderWidth:            1,
    minHeight:              52,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    marginBottom:  staticTheme.spacing.xs,
  },
  inputSuffix: {
    paddingHorizontal:       staticTheme.spacing.sm,
    alignItems:              'center',
    justifyContent:          'center',
    borderTopRightRadius:    staticTheme.borderRadius.lg,
    borderBottomRightRadius: staticTheme.borderRadius.lg,
    borderWidth:             1,
    minWidth:                44,
    minHeight:               52,
  },
  valuePreview: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm + 2,
    borderRadius:      staticTheme.borderRadius.xl,
    borderWidth:       1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.md,
    marginTop:         staticTheme.spacing.md,
  },
  valuePreviewDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    flexShrink:   0,
  },
  // Danger zone — left red border card
  dangerZone: {
    flexDirection: 'row',
    marginTop:     staticTheme.spacing.xl,
    borderRadius:  staticTheme.borderRadius.xl,
    borderWidth:   1,
    overflow:      'hidden',
  },
  dangerLeftBar: {
    width:           4,
    alignSelf:       'stretch',
    backgroundColor: '#EF4444',
    flexShrink:      0,
  },
  dangerInner: {
    flex:    1,
    padding: staticTheme.spacing.md,
    gap:     staticTheme.spacing.sm + 2,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.sm,
  },
  dangerIconWrap: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  dangerBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    paddingVertical:   staticTheme.spacing.sm + 4,
    paddingHorizontal: staticTheme.spacing.md - 2,
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    minHeight:         48,
  },
  footer: {
    flexDirection:     'row',
    gap:               staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.md - 4,
    borderTopWidth:    1,
  },
  cancelBtn: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: staticTheme.spacing.md - 2,
    borderRadius:    staticTheme.borderRadius.xl,
    borderWidth:     1,
    minHeight:       54,
  },
  saveBtn: {
    flex:            2,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: staticTheme.spacing.md - 2,
    borderRadius:    staticTheme.borderRadius.xl,
    backgroundColor: staticTheme.colors.primary[500],
    minHeight:       54,
  },
  disabled: { opacity: 0.42 },

  // ── Section 4 card ────────────────────────────────────────────────────────
  stockCard: {
    borderRadius:  16,
    borderWidth:   1,
    padding:       16,
    marginTop:     staticTheme.spacing.lg,
    marginBottom:  staticTheme.spacing.xs,
  },
  stockCardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginBottom:   staticTheme.spacing.sm + 2,
  },
  stockCardIconWrap: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stockDivider: {
    height:         1,
    marginVertical: 14,
  },
  stockRow: {
    flexDirection: 'row',
    gap:           0,
  },
  stockCol: {
    flex: 1,
  },
  stockColDivider: {
    width:            1,
    marginHorizontal: staticTheme.spacing.sm + 2,
  },
  stockFieldLabel: {
    marginBottom:  staticTheme.spacing.xs + 2,
    marginTop:     0,
    letterSpacing: 0.4,
  },
  stockHelper: {
    marginTop:    4,
    marginBottom: 0,
  },
  stockInput: {
    borderWidth:       1,
    borderRadius:      12,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   staticTheme.spacing.sm + 3,
    fontSize:          15,
    minHeight:         52,
  },
  pesoInputWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    1,
    borderRadius:   12,
    minHeight:      52,
    marginBottom:   staticTheme.spacing.xs,
    overflow:       'hidden',
  },
  pesoSign: {
    paddingLeft:  14,
    paddingRight: 6,
    fontSize:     16,
    fontWeight:   '700',
  },
  pesoTextInput: {
    flex:            1,
    paddingVertical: staticTheme.spacing.sm + 3,
    paddingRight:    staticTheme.spacing.sm + 4,
    fontSize:        15,
    minHeight:       52,
  },
  valuePreviewRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    borderRadius:      10,
    borderWidth:       1,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   staticTheme.spacing.sm + 2,
  },
  valuePreviewLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.xs + 2,
  },
});
