/**
 * Inventory Item Detail / Edit Screen
 *
 * Loads the item from the store by the `id` route param and renders a full,
 * everything-visible editor:
 *   - An overview header (photo, category, product-type badge, live stock health)
 *     so the user can see the item's full state at a glance before editing.
 *   - Editable sections for every field the item supports (varying by category).
 *   - A Delete action (Danger Zone) behind a confirmation dialog.
 *
 * Reuses the shared inventory molecules (PickerTrigger / GenericPickerModal /
 * ProductTypeBadge / StockHealthIndicator / ImagePickerField) and
 * DatePickerFormField rather than re-implementing them — see @/components/molecules.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Trash2, AlertCircle } from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { DatePickerFormField } from '@/components/molecules/DatePickerField';
import { EmptyState } from '@/components/molecules/EmptyState';
import { InfoRow } from '@/components/molecules/InfoRow';
import {
  PickerTrigger,
  GenericPickerModal,
  categoryAccent,
  CATEGORY_OPTIONS,
  UNIT_OPTIONS,
  CONDITION_OPTIONS,
} from '@/components/molecules/InventoryFieldPicker';
import { ProductTypeBadge } from '@/components/molecules/ProductTypeBadge';
import { StockHealthIndicator } from '@/components/molecules/StockHealthIndicator';
import { ImagePickerField } from '@/components/molecules/ImagePickerField';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { useInventoryStore, selectItemById } from '@/store';
import { useAppDialog } from '@/hooks';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import type {
  InventoryCategory,
  EquipmentCondition,
  StockUnit,
} from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Schema (mirrors add.tsx + imageUri) ──────────────────────────────────────

const schema = yup.object({
  name:          yup.string().trim().min(2, 'Name must be at least 2 characters').required('Name is required'),
  category:      yup.mixed<InventoryCategory>().oneOf(['product', 'ingredient', 'equipment']).required('Category is required'),
  quantity:      yup.number().min(0, 'Quantity cannot be negative').required('Quantity is required'),
  unit:          yup.mixed<StockUnit>().required('Unit is required'),
  costPrice:     yup.number().min(0, 'Cost price cannot be negative').optional(),
  description:   yup.string().trim().optional(),
  price:         yup.number().min(0, 'Price cannot be negative').optional(),
  sku:           yup.string().trim().optional(),
  reorderLevel:  yup.number().min(0, 'Reorder level cannot be negative').optional(),
  serialNumber:  yup.string().trim().optional(),
  condition:     yup.mixed<EquipmentCondition>().oneOf(['good', 'fair', 'poor']).optional(),
  purchaseDate:  yup.string().optional(),
  imageUri:      yup.string().optional(),
});

type FormValues = yup.InferType<typeof schema>;

// ─── Section header (left-border style, local to this screen) ─────────────────

const SectionHeader: React.FC<{ title: string; color: string }> = ({ title, color }) => (
  <View style={[sectionStyles.container, { borderLeftColor: color }]}>
    <Text variant="body-sm" weight="semibold" style={{ color }}>{title}</Text>
  </View>
);

const sectionStyles = StyleSheet.create({
  container: { borderLeftWidth: 3, paddingLeft: staticTheme.spacing.sm, marginBottom: staticTheme.spacing.md, marginTop: staticTheme.spacing.xs },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InventoryItemDetailScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();

  // Resolve item from store — selectItemById is a factory
  const itemSelector = useCallback(
    selectItemById(id ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  const item = useInventoryStore(itemSelector);
  const { updateItem, deleteItem } = useInventoryStore();

  const [categoryVisible,  setCategoryVisible]  = useState(false);
  const [unitVisible,      setUnitVisible]      = useState(false);
  const [conditionVisible, setConditionVisible] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    // Pre-populate with existing item values
    defaultValues: item
      ? {
          name:         item.name,
          category:     item.category,
          quantity:     item.quantity,
          unit:         item.unit,
          ...(item.costPrice    !== undefined ? { costPrice:    item.costPrice }    : {}),
          ...(item.description  !== undefined ? { description:  item.description }  : {}),
          ...(item.price        !== undefined ? { price:        item.price }        : {}),
          ...(item.sku          !== undefined ? { sku:          item.sku }          : {}),
          ...(item.reorderLevel !== undefined ? { reorderLevel: item.reorderLevel } : {}),
          ...(item.serialNumber !== undefined ? { serialNumber: item.serialNumber } : {}),
          ...(item.condition    !== undefined ? { condition:    item.condition }    : {}),
          ...(item.purchaseDate !== undefined ? { purchaseDate: item.purchaseDate } : {}),
          ...(item.imageUri     !== undefined ? { imageUri:     item.imageUri }     : {}),
        }
      : { category: 'product', unit: 'pcs', quantity: 0 },
  });

  const selectedCategory  = watch('category');
  const selectedUnit      = watch('unit');
  const selectedCondition = watch('condition');
  const selectedImageUri  = watch('imageUri');

  const handleCategorySelect = useCallback(
    (value: InventoryCategory) => setValue('category', value, { shouldValidate: true, shouldDirty: true }),
    [setValue],
  );
  const handleUnitSelect = useCallback(
    (value: StockUnit) => setValue('unit', value, { shouldValidate: true, shouldDirty: true }),
    [setValue],
  );
  const handleConditionSelect = useCallback(
    (value: EquipmentCondition) => setValue('condition', value, { shouldValidate: true, shouldDirty: true }),
    [setValue],
  );
  // Map "remove" (undefined) to '' so a cleared photo is persisted (the store
  // only forwards fields that are not `undefined`).
  const handleImageChange = useCallback(
    (uri: string | undefined) => setValue('imageUri', uri ?? '', { shouldDirty: true }),
    [setValue],
  );

  const onSubmit = useCallback(
    (values: FormValues) => {
      if (!item) return;
      updateItem(item.id, {
        name:     values.name,
        category: values.category,
        quantity: values.quantity,
        unit:     values.unit,
        ...(values.description  !== undefined ? { description:  values.description }  : {}),
        ...(values.costPrice    !== undefined ? { costPrice:    values.costPrice }    : {}),
        ...(values.price        !== undefined ? { price:        values.price }        : {}),
        ...(values.sku          !== undefined ? { sku:          values.sku }          : {}),
        ...(values.reorderLevel !== undefined ? { reorderLevel: values.reorderLevel } : {}),
        ...(values.serialNumber !== undefined ? { serialNumber: values.serialNumber } : {}),
        ...(values.condition    !== undefined ? { condition:    values.condition }    : {}),
        ...(values.purchaseDate !== undefined ? { purchaseDate: values.purchaseDate } : {}),
        ...(values.imageUri     !== undefined ? { imageUri:     values.imageUri }     : {}),
      });
      router.back();
    },
    [item, updateItem, router],
  );

  const handleDelete = useCallback(() => {
    if (!item) return;
    dialog.confirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteItem(item.id);
        router.back();
      },
    });
  }, [item, deleteItem, router, dialog]);

  const dynStyles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    dangerZone: {
      backgroundColor: theme.colors.error[50],
      borderColor:     theme.colors.error[200],
    },
  }), [theme]);

  // ── Not found state ─────────────────────────────────────────────────────────

  if (!item) {
    return (
      <View style={dynStyles.safe}>
        <StatusBar style="light" />
        <EmptyState
          title="Item Not Found"
          description="This inventory item no longer exists or has been deleted."
          action={{ label: 'Go Back', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const categoryLabel  = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory)?.label;
  const unitLabel      = UNIT_OPTIONS.find((o) => o.value === selectedUnit)?.label;
  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === selectedCondition)?.label;
  const accentColor    = categoryAccent(selectedCategory, isDark);
  const accent         = getInventoryAccent(selectedCategory ?? 'product', isDark);

  return (
    <SafeAreaView style={dynStyles.safe} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Overview header — see-everything-at-a-glance ────────────────── */}
          <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
            <ImagePickerField
              value={selectedImageUri}
              onChange={handleImageChange}
              label="Photo"
              helperText="Optional — helps identify this item at a glance"
            />
            <View style={styles.overviewMeta}>
              <View style={[styles.categoryPill, { backgroundColor: accent.iconBg, borderColor: accent.glow }]}>
                <Text variant="body-xs" weight="medium" style={{ color: accent.accent }}>
                  {accent.label}
                </Text>
              </View>
            </View>
            {selectedCategory === 'product' && (
              <ProductTypeBadge productType={item.productType} style={styles.overviewBadge} />
            )}
            <StockHealthIndicator item={item} style={styles.overviewStock} />
          </Card>

          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
            <SectionHeader title="Basic Information" color={staticTheme.colors.primary[500]} />
            <FormField name="name" control={control} label="Item Name *" placeholder="e.g. Arabica Coffee Beans" autoCapitalize="words" autoCorrect={false} />
            <PickerTrigger
              label="Category *"
              value={categoryLabel}
              placeholder="Select category"
              onPress={() => setCategoryVisible(true)}
              {...(errors.category ? { error: errors.category.message } : {})}
              accentColor={accentColor}
            />
            <View style={styles.row}>
              <View style={styles.halfField}>
                <FormField name="quantity" control={control} label="Quantity *" placeholder="0" keyboardType="decimal-pad" />
              </View>
              <View style={styles.halfField}>
                <PickerTrigger
                  label="Unit *"
                  value={unitLabel}
                  placeholder="Select unit"
                  onPress={() => setUnitVisible(true)}
                  {...(errors.unit ? { error: errors.unit.message } : {})}
                />
              </View>
            </View>

            <FormField name="costPrice" control={control} label="Cost Price (₱)" placeholder="0.00" keyboardType="decimal-pad" helperText="Purchase or production cost" />
            <FormField name="description" control={control} label="Description" placeholder="Optional notes..." multiline numberOfLines={3} autoCapitalize="sentences" />
          </Card>

          {/* ── Product Details ─────────────────────────────────────────────── */}
          {selectedCategory === 'product' && (
            <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
              <SectionHeader title="Product Details" color={staticTheme.colors.primary[500]} />
              <FormField name="price" control={control} label="Selling Price (₱)" placeholder="0.00" keyboardType="decimal-pad" />
              <FormField name="sku" control={control} label="SKU / Barcode" placeholder="e.g. SKU-001" autoCapitalize="characters" autoCorrect={false} />
              <FormField name="reorderLevel" control={control} label="Reorder Level" placeholder="e.g. 10" keyboardType="decimal-pad" helperText="Low-stock alert fires when quantity drops to or below this value" />
            </Card>
          )}

          {/* ── Ingredient Details ──────────────────────────────────────────── */}
          {selectedCategory === 'ingredient' && (
            <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
              <SectionHeader title="Ingredient Details" color={staticTheme.colors.success[500]} />
              <FormField name="reorderLevel" control={control} label="Reorder Level" placeholder="e.g. 10" keyboardType="decimal-pad" helperText="Alert fires when quantity drops to or below this value" />
            </Card>
          )}

          {/* ── Equipment Details ───────────────────────────────────────────── */}
          {selectedCategory === 'equipment' && (
            <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
              <SectionHeader title="Equipment Details" color={staticTheme.colors.highlight[400]} />
              <FormField name="serialNumber" control={control} label="Serial / Asset Number" placeholder="e.g. SN-2024-001" autoCapitalize="characters" autoCorrect={false} />
              <PickerTrigger label="Condition" value={conditionLabel} placeholder="Select condition" onPress={() => setConditionVisible(true)} />
              <DatePickerFormField name="purchaseDate" control={control} label="Purchase Date" maximumDate={new Date()} accessibilityLabel="Purchase date" />
            </Card>
          )}

          {/* ── Metadata ───────────────────────────────────────────────────── */}
          <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section} variant="filled">
            <InfoRow
              label="Created"
              value={new Date(item.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            />
            <InfoRow
              label="Last updated"
              value={new Date(item.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            />
          </Card>

          {/* ── Save button ─────────────────────────────────────────────────── */}
          <Button
            title={isSubmitting ? 'Saving...' : isDirty ? 'Save Changes' : 'No Changes'}
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={!isDirty}
            fullWidth
            style={styles.saveButton}
          />

          {/* ── Danger Zone ─────────────────────────────────────────────────── */}
          <View style={[styles.dangerZone, dynStyles.dangerZone]}>
            <View style={styles.dangerLeftBar} />
            <View style={styles.dangerInner}>
              <View style={styles.dangerHeader}>
                <View style={styles.dangerIconWrap}>
                  <AlertCircle size={16} color={staticTheme.colors.error[500]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body-sm" weight="bold" style={{ color: staticTheme.colors.error[600] }}>
                    Danger Zone
                  </Text>
                  <Text variant="body-xs" style={{ color: staticTheme.colors.error[400] }}>
                    This action cannot be undone
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleDelete}
                style={styles.dangerBtn}
                accessibilityRole="button"
                accessibilityLabel="Delete item"
              >
                <Trash2 size={15} color={staticTheme.colors.error[500]} />
                <Text variant="body-sm" weight="semibold" style={{ color: staticTheme.colors.error[500] }}>
                  Delete "{item.name}"
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <GenericPickerModal visible={categoryVisible} onClose={() => setCategoryVisible(false)} title="Select Category" options={CATEGORY_OPTIONS} selected={selectedCategory} onSelect={handleCategorySelect} />
      <GenericPickerModal visible={unitVisible} onClose={() => setUnitVisible(false)} title="Select Unit" options={UNIT_OPTIONS} selected={selectedUnit} onSelect={handleUnitSelect} />
      <GenericPickerModal visible={conditionVisible} onClose={() => setConditionVisible(false)} title="Select Condition" options={CONDITION_OPTIONS} selected={selectedCondition} onSelect={handleConditionSelect} />
      {dialog.Dialog}
    </SafeAreaView>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  scrollContent: {
    padding: staticTheme.spacing.md, gap: staticTheme.spacing.sm, paddingBottom: staticTheme.spacing.xl,
  },
  section:   { marginBottom: 0 },
  row:       { flexDirection: 'row', gap: staticTheme.spacing.sm },
  halfField: { flex: 1 },
  saveButton: { marginTop: staticTheme.spacing.sm },
  // Overview header
  overviewMeta:  { flexDirection: 'row', marginTop: staticTheme.spacing.sm },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: staticTheme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  overviewBadge: { marginTop: staticTheme.spacing.sm },
  overviewStock: { marginTop: staticTheme.spacing.sm },
  // Danger Zone
  dangerZone: {
    flexDirection: 'row',
    marginTop:     staticTheme.spacing.sm,
    borderRadius:  staticTheme.borderRadius.xl,
    borderWidth:   1,
    overflow:      'hidden',
  },
  dangerLeftBar: {
    width:           4,
    alignSelf:       'stretch',
    backgroundColor: staticTheme.colors.error[500],
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
    backgroundColor: staticTheme.colors.error[50],
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
    borderColor:       staticTheme.colors.error[200],
    backgroundColor:   '#fff',
    minHeight:         48,
  },
});
