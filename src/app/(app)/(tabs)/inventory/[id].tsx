/**
 * Inventory Item Detail / Edit Screen
 *
 * Loads item from the store by the `id` route parameter.
 * Renders the same form layout as add.tsx, pre-populated with existing values.
 * Also exposes a Delete action (confirmation alert before deletion).
 *
 * Shares the same PickerTrigger, GenericPickerModal, and SectionHeader
 * sub-components pattern as add.tsx. In a larger codebase these would be
 * extracted into a shared `InventoryFormShared.tsx` — kept inline here
 * to avoid premature abstraction before a full form redesign.
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Package,
  Wheat,
  Wrench,
  ChevronDown,
  ChevronLeft,
  Check,
  Trash2,
} from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Badge } from '@/components/atoms/Badge';
import { useInventoryStore, selectItemById } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type {
  InventoryCategory,
  EquipmentCondition,
  StockUnit,
} from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Schema (same as add.tsx) ─────────────────────────────────────────────────

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
});

type FormValues = yup.InferType<typeof schema>;

// ─── Picker option types ──────────────────────────────────────────────────────

interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const CATEGORY_OPTIONS: PickerOption<InventoryCategory>[] = [
  { value: 'product',    label: 'Product',    description: 'Finished goods for sale', icon: <Package size={20} color={staticTheme.colors.primary[500]} /> },
  { value: 'ingredient', label: 'Ingredient', description: 'Raw materials & consumables', icon: <Wheat size={20} color={staticTheme.colors.success[500]} /> },
  { value: 'equipment',  label: 'Equipment',  description: 'Tools and assets', icon: <Wrench size={20} color={staticTheme.colors.highlight[400]} /> },
];

const UNIT_OPTIONS: PickerOption<StockUnit>[] = [
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
];

const CONDITION_OPTIONS: PickerOption<EquipmentCondition>[] = [
  { value: 'good', label: 'Good', description: 'Fully functional' },
  { value: 'fair', label: 'Fair', description: 'Working but showing wear' },
  { value: 'poor', label: 'Poor', description: 'Needs repair or replacement' },
];

// ─── Category colour helper ───────────────────────────────────────────────────

function categoryColor(cat: InventoryCategory | undefined): string {
  switch (cat) {
    case 'product':    return staticTheme.colors.primary[500];
    case 'ingredient': return staticTheme.colors.success[500];
    case 'equipment':  return staticTheme.colors.highlight[400];
    default:           return staticTheme.colors.gray[400];
  }
}

// ─── Generic picker modal ─────────────────────────────────────────────────────

interface GenericPickerModalProps<T extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
}

function GenericPickerModal<T extends string>({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: GenericPickerModalProps<T>) {
  const theme = useAppTheme();

  const dynPickerStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: staticTheme.borderRadius['2xl'],
      borderTopRightRadius: staticTheme.borderRadius['2xl'],
      paddingHorizontal: staticTheme.spacing.md,
      paddingBottom: staticTheme.spacing.xl,
      maxHeight: '70%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.gray[300],
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: staticTheme.spacing.sm,
      marginBottom: staticTheme.spacing.md,
    },
    sheetTitle: { color: theme.colors.text, marginBottom: staticTheme.spacing.sm },
    optionPressed:  { backgroundColor: theme.colors.gray[50] },
    optionSelected: { backgroundColor: staticTheme.colors.primary[50] },
  }), [theme]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.overlay} onPress={onClose}>
        <Pressable style={dynPickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={dynPickerStyles.handle} />
          <Text variant="h5" weight="semibold" style={dynPickerStyles.sheetTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: opt }) => (
              <Pressable
                style={({ pressed }) => [
                  pickerStyles.option,
                  pressed && dynPickerStyles.optionPressed,
                  selected === opt.value && dynPickerStyles.optionSelected,
                ]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                {opt.icon !== undefined && <View style={pickerStyles.optionIcon}>{opt.icon}</View>}
                <View style={pickerStyles.optionText}>
                  <Text variant="body" weight="medium" style={{ color: theme.colors.text }}>{opt.label}</Text>
                  {opt.description !== undefined && (
                    <Text variant="body-sm" color="gray">{opt.description}</Text>
                  )}
                </View>
                {selected === opt.value && <Check size={18} color={staticTheme.colors.primary[500]} />}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: staticTheme.spacing.md, paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.md, gap: staticTheme.spacing.md,
  },
  optionIcon: { width: 32, alignItems: 'center' },
  optionText: { flex: 1, gap: 2 },
});

// ─── Picker trigger ───────────────────────────────────────────────────────────

interface PickerTriggerProps {
  label: string;
  value: string | undefined;
  placeholder: string;
  onPress: () => void;
  error?: string;
  accentColor?: string;
}

const PickerTrigger = React.memo<PickerTriggerProps>(
  ({ label, value, placeholder, onPress, error, accentColor }) => {
    const theme = useAppTheme();

    const dynTriggerStyles = useMemo(() => StyleSheet.create({
      label: { color: theme.colors.gray[700], marginBottom: staticTheme.spacing.xs },
      trigger: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
        borderRadius: staticTheme.borderRadius.md,
        paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm,
        backgroundColor: theme.colors.surface, minHeight: 48,
      },
      triggerPressed: { backgroundColor: theme.colors.gray[50] },
    }), [theme]);

    return (
      <View style={triggerStyles.wrapper}>
        <Text variant="body-sm" weight="medium" style={dynTriggerStyles.label}>{label}</Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            dynTriggerStyles.trigger,
            error !== undefined && triggerStyles.triggerError,
            pressed && dynTriggerStyles.triggerPressed,
          ]}
        >
          <Text variant="body" style={{ color: value !== undefined ? (accentColor ?? theme.colors.text) : theme.colors.placeholder, flex: 1 }}>
            {value ?? placeholder}
          </Text>
          <ChevronDown size={18} color={theme.colors.gray[400]} />
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
  wrapper: { marginBottom: staticTheme.spacing.md },
  triggerError: { borderColor: staticTheme.colors.error[500] },
  errorText: { color: staticTheme.colors.error[500], marginTop: staticTheme.spacing.xs },
});

// ─── Section header ───────────────────────────────────────────────────────────

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
  const theme  = useAppTheme();
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
        }
      : { category: 'product', unit: 'pcs', quantity: 0 },
  });

  const selectedCategory  = watch('category');
  const selectedUnit      = watch('unit');
  const selectedCondition = watch('condition');

  const handleCategorySelect = useCallback(
    (value: InventoryCategory) => setValue('category', value, { shouldValidate: true }),
    [setValue],
  );
  const handleUnitSelect = useCallback(
    (value: StockUnit) => setValue('unit', value, { shouldValidate: true }),
    [setValue],
  );
  const handleConditionSelect = useCallback(
    (value: EquipmentCondition) => setValue('condition', value, { shouldValidate: true }),
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
      });
      router.back();
    },
    [item, updateItem, router],
  );

  const handleDelete = useCallback(() => {
    if (!item) return;
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteItem(item.id);
            router.back();
          },
        },
      ],
    );
  }, [item, deleteItem, router]);

  const dynStyles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    navBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm,
      borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.surface,
    },
    navTitle: { color: theme.colors.text, textAlign: 'center' },
  }), [theme]);

  // ── Not found state ─────────────────────────────────────────────────────────

  if (!item) {
    return (
      <View style={dynStyles.safe}>
        <StatusBar style="light" />
        <View style={dynStyles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <ChevronLeft size={24} color={theme.colors.text} />
          </Pressable>
          <Text variant="h5" weight="semibold" style={dynStyles.navTitle}>Item Details</Text>
          <View style={styles.navSpacer} />
        </View>
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
  const accentColor    = categoryColor(selectedCategory);

  const isLowStock =
    item.reorderLevel !== undefined && item.quantity <= item.reorderLevel;

  return (
    <SafeAreaView style={dynStyles.safe} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Nav bar */}
      <View style={dynStyles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text variant="h5" weight="semibold" style={dynStyles.navTitle} numberOfLines={1}>
            {item.name}
          </Text>
          {isLowStock && (
            <Badge label="Low Stock" variant="error" size="sm" />
          )}
        </View>
        <Pressable
          onPress={handleDelete}
          style={styles.deleteButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete item"
        >
          <Trash2 size={20} color={staticTheme.colors.error[500]} />
        </Pressable>
      </View>

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

            <FormField name="costPrice" control={control} label="Cost Price (\u20B1)" placeholder="0.00" keyboardType="decimal-pad" helperText="Purchase or production cost" />
            <FormField name="description" control={control} label="Description" placeholder="Optional notes..." multiline numberOfLines={3} autoCapitalize="sentences" />
          </Card>

          {/* ── Product Details ─────────────────────────────────────────────── */}
          {selectedCategory === 'product' && (
            <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section}>
              <SectionHeader title="Product Details" color={staticTheme.colors.primary[500]} />
              <FormField name="price" control={control} label="Selling Price (\u20B1)" placeholder="0.00" keyboardType="decimal-pad" />
              <FormField name="sku" control={control} label="SKU / Barcode" placeholder="e.g. SKU-001" autoCapitalize="characters" autoCorrect={false} />
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
              <FormField name="purchaseDate" control={control} label="Purchase Date" placeholder="YYYY-MM-DD" keyboardType="numeric" helperText="Format: YYYY-MM-DD" />
            </Card>
          )}

          {/* ── Metadata ───────────────────────────────────────────────────── */}
          <Card borderRadius="lg" padding="md" shadow="sm" style={styles.section} variant="filled">
            <Text variant="body-xs" color="gray">
              Created: {new Date(item.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
            <Text variant="body-xs" color="gray">
              Last updated: {new Date(item.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <GenericPickerModal visible={categoryVisible} onClose={() => setCategoryVisible(false)} title="Select Category" options={CATEGORY_OPTIONS} selected={selectedCategory} onSelect={handleCategorySelect} />
      <GenericPickerModal visible={unitVisible} onClose={() => setUnitVisible(false)} title="Select Unit" options={UNIT_OPTIONS} selected={selectedUnit} onSelect={handleUnitSelect} />
      <GenericPickerModal visible={conditionVisible} onClose={() => setConditionVisible(false)} title="Select Condition" options={CONDITION_OPTIONS} selected={selectedCondition} onSelect={handleConditionSelect} />
    </SafeAreaView>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  backButton: {
    padding: staticTheme.spacing.xs, minWidth: 44, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  navCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: staticTheme.spacing.xs,
  },
  navSpacer: { minWidth: 44 },
  deleteButton: {
    padding: staticTheme.spacing.xs, minWidth: 44, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: {
    padding: staticTheme.spacing.md, gap: staticTheme.spacing.sm, paddingBottom: staticTheme.spacing.xl,
  },
  section: { marginBottom: 0 },
  row: { flexDirection: 'row', gap: staticTheme.spacing.sm },
  halfField: { flex: 1 },
  saveButton: { marginTop: staticTheme.spacing.sm },
});
