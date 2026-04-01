/**
 * Add Raw Material Screen — Premium Redesign
 *
 * Guided form with clear section headers and helper text:
 *   1. Basic Info   — Name + Description
 *   2. Category     — visual grid (emoji + label cards)
 *   3. Unit         — compact pill grid
 *   4. Stock & Cost — numeric inputs with ₱ prefix, unit suffix, live total value preview
 *
 * Full dark mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Package, Tag, Ruler, BarChart2, Check, X } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { Text } from '@/components/atoms/Text';
import { LoaderOverlay } from '@/components/molecules/LoaderOverlay';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import { useRawMaterialsStore, selectRawMaterialsSaving, selectRawMaterialsError } from '@/store';
import type { CreateRawMaterialInput, RawMaterialUnit, RawMaterialCategory } from '@/types';

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = Yup.object({
  name:              Yup.string().trim().min(1, 'Name is required').required('Name is required'),
  description:       Yup.string().optional(),
  unit:              Yup.string().oneOf<RawMaterialUnit>(
    ['piece','pack','roll','box','kg','liter','sheet','bag','bottle','set','other'],
    'Select a unit',
  ).required('Unit is required'),
  quantityInStock:   Yup.number().min(0, 'Cannot be negative').required('Initial stock is required'),
  minimumStockLevel: Yup.number().min(0, 'Cannot be negative').required('Minimum stock is required'),
  costPerUnit:       Yup.number().min(0, 'Cannot be negative').required('Cost per unit is required'),
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

// ─── Reusable sub-components ──────────────────────────────────────────────────

interface SectionHeaderProps {
  icon:    React.ReactNode;
  title:   string;
  isDark:  boolean;
}

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

export default function AddRawMaterialScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';

  const isSaving = useRawMaterialsStore(selectRawMaterialsSaving);
  const error    = useRawMaterialsStore(selectRawMaterialsError);
  const { createRawMaterial, clearError } = useRawMaterialsStore(
    useShallow((s) => ({ createRawMaterial: s.createRawMaterial, clearError: s.clearError })),
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
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
    mode: 'onChange',
  });

  const watchedName  = watch('name');
  const selectedUnit = watch('unit');
  const selectedCat  = watch('category');
  const watchedQty   = watch('quantityInStock');
  const watchedCost  = watch('costPerUnit');

  const totalValue = (watchedQty || 0) * (watchedCost || 0);

  const onSubmit = useCallback(
    async (data: FormData) => {
      clearError();
      const input: CreateRawMaterialInput = {
        name:              data.name,
        unit:              data.unit as RawMaterialUnit,
        quantityInStock:   data.quantityInStock,
        minimumStockLevel: data.minimumStockLevel,
        costPerUnit:       data.costPerUnit,
        ...(data.description ? { description: data.description } : {}),
        ...(data.category    ? { category:    data.category as RawMaterialCategory } : {}),
      };
      try {
        await createRawMaterial(input);
        router.back();
      } catch {
        // error shown via store
      }
    },
    [createRawMaterial, clearError, router],
  );

  const accent = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  // ── Dynamic styles ────────────────────────────────────────────────────────
  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: { backgroundColor: theme.colors.background },
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[50],
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
    // Section 4 card tokens
    stockCard: {
      backgroundColor: isDark ? '#1A2235' : '#F8FAFC',
      borderColor:     isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
    },
    stockCardIconWrap: {
      backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : '#DCFCE7',
    },
    stockDivider: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
    },
    stockColDivider: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0',
    },
    stockInput: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? '#242D42' : '#FFFFFF',
      color:           theme.colors.text,
    },
    pesoInputWrap: {
      borderColor:     isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.gray[200],
      backgroundColor: isDark ? '#242D42' : '#FFFFFF',
    },
    pesoSign: {
      color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500],
    },
    pesoTextInput: {
      color: theme.colors.text,
    },
    valuePreviewRow: {
      backgroundColor: isDark ? 'rgba(61,214,140,0.08)' : '#F0FDF4',
      borderColor:     isDark ? 'rgba(61,214,140,0.20)' : '#BBF7D0',
    },
    footer: {
      backgroundColor: theme.colors.surface,
      borderTopColor:  isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100],
    },
    cancelBtn: {
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    cancelBtnText: { color: theme.colors.textSecondary },
  }), [theme, isDark]);

  // Focus tracking for border highlight
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const inputBorder = useCallback((field: string, hasError: boolean) => {
    if (hasError)                return { borderColor: isDark ? '#FF6B6B' : '#EF4444' };
    if (focusedField === field)  return { borderColor: isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.primary[300] };
    return {};
  }, [focusedField, isDark]);

  const saveLabel = useMemo(() => {
    const trimmed = watchedName.trim();
    if (isSaving) return 'Saving…';
    if (trimmed)  return `Save "${trimmed}"`;
    return 'Save Material';
  }, [watchedName, isSaving]);

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
                placeholder="e.g. Paper Plates, Sauce Container"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                autoCapitalize="words"
              />
            )}
          />
          {errors.name ? (
            <Text variant="body-xs" style={staticStyles.errText}>{errors.name.message}</Text>
          ) : (
            <Text variant="body-xs" style={[staticStyles.helperText, dynStyles.helperText]}>
              Give it a clear, recognizable name
            </Text>
          )}

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
                placeholder="Optional — add any notes about this material…"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
          />

          {/* ── Section 2: Category ── */}
          <SectionHeader
            icon={<Tag size={15} color="#6366F1" />}
            title="Category"
            isDark={isDark}
          />
          <Text variant="body-xs" style={[staticStyles.helperText, dynStyles.helperText]}>
            Choose the category that best describes this material
          </Text>

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

          {/* ── Section 3: Unit ── */}
          <SectionHeader
            icon={<Ruler size={15} color="#F59E0B" />}
            title="Unit of Measurement *"
            isDark={isDark}
          />
          <Text variant="body-xs" style={[staticStyles.helperText, dynStyles.helperText]}>
            How is this material measured or counted?
          </Text>

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
              {/* Initial Stock */}
              <View style={staticStyles.stockCol}>
                <Text variant="body-xs" weight="semibold" style={[staticStyles.stockFieldLabel, dynStyles.fieldLabel]}>
                  INITIAL STOCK *
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
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                {errors.quantityInStock ? (
                  <Text variant="body-xs" style={staticStyles.errText}>{errors.quantityInStock.message}</Text>
                ) : (
                  <Text variant="body-xs" style={[staticStyles.stockHelper, dynStyles.helperText]}>
                    {selectedUnit ?? 'unit'} — how much you have now
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
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
                    />
                  )}
                />
                {errors.minimumStockLevel ? (
                  <Text variant="body-xs" style={staticStyles.errText}>{errors.minimumStockLevel.message}</Text>
                ) : (
                  <Text variant="body-xs" style={[staticStyles.stockHelper, dynStyles.helperText]}>
                    {selectedUnit ?? 'unit'} — alert threshold
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
                  return (
                    <TextInput
                      style={[staticStyles.pesoTextInput, dynStyles.pesoTextInput]}
                      value={displayText}
                      onChangeText={(v) => {
                        // Accept: digits, one leading zero, one decimal point
                        // Strip anything that is not a digit or decimal point.
                        const sanitised = v.replace(/[^0-9.]/g, '').replace(/^(\d*\.?\d*).*$/, '$1');
                        setDisplayText(sanitised);
                        const parsed = parseFloat(sanitised);
                        onChange(isNaN(parsed) ? 0 : parsed);
                      }}
                      onBlur={() => {
                        // Normalise display on blur: empty → '', number → formatted string
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
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
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
                  Estimated Value
                </Text>
              </View>
              <Text variant="body-sm" weight="bold" style={{ color: isDark ? '#3DD68C' : '#15803D' }}>
                ₱{totalValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </Text>
            </View>

          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[staticStyles.footer, dynStyles.footer, { paddingBottom: Math.max( staticTheme.spacing.md) }]}>
          <Pressable style={[staticStyles.cancelBtn, dynStyles.cancelBtn]} onPress={() => router.back()}>
            <Text variant="body-sm" weight="semibold" style={dynStyles.cancelBtnText}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              staticStyles.saveBtn,
              (!isValid || isSaving) && staticStyles.disabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isSaving}
          >
            <Text variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
              {saveLabel}
            </Text>
          </Pressable>
        </View>
      </View>
      {/* Saving overlay */}
      <LoaderOverlay visible={isSaving} message="Saving material…" />
    </KeyboardAvoidingView>
  );
}

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
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
  helperText: {
    marginTop:    3,
    marginBottom: staticTheme.spacing.xs,
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
  // Category grid — 2 columns
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
    width:          18,
    height:         18,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Unit pill grid
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
  // Input with ₱ prefix
  inputWithPrefix: {
    flexDirection:  'row',
    marginBottom:   staticTheme.spacing.xs,
  },
  inputPrefix: {
    width:               48,
    alignItems:          'center',
    justifyContent:      'center',
    borderTopLeftRadius: staticTheme.borderRadius.lg,
    borderBottomLeftRadius: staticTheme.borderRadius.lg,
    borderWidth:         1,
  },
  // Input with unit suffix
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
  // Total value preview pill
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
    paddingHorizontal: staticTheme.spacing.sm,
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
  // Two-column stock row
  stockRow: {
    flexDirection: 'row',
    gap:           0,
  },
  stockCol: {
    flex: 1,
  },
  stockColDivider: {
    width:          1,
    marginHorizontal: staticTheme.spacing.sm + 2,
  },
  stockFieldLabel: {
    marginBottom:  staticTheme.spacing.xs + 2,
    marginTop:     0,
    letterSpacing: 0.4,
  },
  stockHelper: {
    marginTop:  4,
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
  // Inline ₱ prefix input
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
    paddingLeft:    14,
    paddingRight:   6,
    fontSize:       16,
    fontWeight:     '700',
  },
  pesoTextInput: {
    flex:           1,
    paddingVertical:   staticTheme.spacing.sm + 3,
    paddingRight:   staticTheme.spacing.sm + 4,
    fontSize:       15,
    minHeight:      52,
  },
  // Value preview — always visible at card bottom
  valuePreviewRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderRadius:   10,
    borderWidth:    1,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   staticTheme.spacing.sm + 2,
  },
  valuePreviewLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           staticTheme.spacing.xs + 2,
  },
});
