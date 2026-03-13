/**
 * Add Inventory Item Screen — dark-mode-first redesign
 *
 * React Hook Form + Yup form.
 * Fields render dynamically based on the selected category:
 *   All:         name, category, quantity, unit, costPrice, description
 *   Products:    + price, sku
 *   Ingredients: + reorderLevel
 *   Equipment:   + serialNumber, condition, purchaseDate
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Package,
  Wheat,
  Wrench,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { IngredientSelector } from '@/components/organisms/IngredientSelector';
import { useInventoryStore, useThemeStore, selectThemeMode } from '@/store';
import { initializeInventory } from '@/store';
import { replaceProductIngredients, consumeIngredients } from '../../../../../database/repositories/product_ingredients.repository';
import { createProductionLog } from '../../../../../database/repositories/production_logs.repository';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type {
  InventoryCategory,
  EquipmentCondition,
  StockUnit,
  SelectedIngredient,
} from '@/types';

// ─── Yup schema ───────────────────────────────────────────────────────────────

const schema = yup.object({
  name:         yup.string().trim().min(2, 'Name must be at least 2 characters').required('Name is required'),
  category:     yup.mixed<InventoryCategory>().oneOf(['product', 'ingredient', 'equipment']).required('Category is required'),
  quantity:     yup.number().min(0, 'Quantity cannot be negative').required('Quantity is required'),
  unit:         yup.mixed<StockUnit>().required('Unit is required'),
  costPrice:    yup.number().min(0, 'Cost price cannot be negative').optional(),
  description:  yup.string().trim().optional(),
  price:        yup.number().min(0, 'Price cannot be negative').optional(),
  sku:          yup.string().trim().optional(),
  reorderLevel: yup.number().min(0, 'Reorder level cannot be negative').optional(),
  serialNumber: yup.string().trim().optional(),
  condition:    yup.mixed<EquipmentCondition>().oneOf(['good', 'fair', 'poor']).optional(),
  purchaseDate: yup.string().optional(),
});

type FormValues = yup.InferType<typeof schema>;

// ─── Picker option types ──────────────────────────────────────────────────────

interface PickerOption<T extends string> {
  value:        T;
  label:        string;
  description?: string;
  icon?:        React.ReactNode;
}

// ─── Config lists ─────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: PickerOption<InventoryCategory>[] = [
  { value: 'product',    label: 'Product',    description: 'Finished goods for sale — price, SKU, stock',   icon: <Package size={20} color={staticTheme.colors.primary[500]} /> },
  { value: 'ingredient', label: 'Ingredient', description: 'Raw materials & consumables — reorder alerts',  icon: <Wheat   size={20} color={staticTheme.colors.success[500]} /> },
  { value: 'equipment',  label: 'Equipment',  description: 'Tools and assets — condition tracking',         icon: <Wrench  size={20} color={staticTheme.colors.highlight[400]} /> },
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
  { value: 'cup',    label: 'Cup' },
];

const CONDITION_OPTIONS: PickerOption<EquipmentCondition>[] = [
  { value: 'good', label: 'Good', description: 'Fully functional' },
  { value: 'fair', label: 'Fair', description: 'Working but showing wear' },
  { value: 'poor', label: 'Poor', description: 'Needs repair or replacement' },
];

// ─── Category accent ──────────────────────────────────────────────────────────

function categoryAccentDark(cat: InventoryCategory | undefined): string {
  switch (cat) {
    case 'product':    return '#4F9EFF';
    case 'ingredient': return '#3DD68C';
    case 'equipment':  return '#FFB020';
    default:           return 'rgba(255,255,255,0.35)';
  }
}

function categoryAccentLight(cat: InventoryCategory | undefined): string {
  switch (cat) {
    case 'product':    return staticTheme.colors.primary[500];
    case 'ingredient': return staticTheme.colors.success[500];
    case 'equipment':  return staticTheme.colors.highlight[400];
    default:           return staticTheme.colors.gray[400];
  }
}

// ─── Section card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  children:    React.ReactNode;
  accentColor: string;
  isDark:      boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ children, accentColor, isDark }) => (
  <View style={[
    sectionCardStyles.card,
    {
      backgroundColor: isDark ? '#151A27' : '#FFFFFF',
      borderColor: isDark ? `${accentColor}22` : `${accentColor}20`,
      borderLeftColor: accentColor,
    },
  ]}>
    {children}
  </View>
);

const sectionCardStyles = StyleSheet.create({
  card: {
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    borderLeftWidth: 3,
    overflow: 'hidden',
    padding: staticTheme.spacing.md,
  },
});

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ title: string; accentColor: string; isDark: boolean }> = ({ title, accentColor, isDark }) => (
  <View style={sectionHeaderStyles.row}>
    <View style={[sectionHeaderStyles.dot, { backgroundColor: accentColor }]} />
    <Text variant="body-sm" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : staticTheme.colors.gray[600] }}>
      {title}
    </Text>
  </View>
);

const sectionHeaderStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: staticTheme.spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ─── Generic picker modal ─────────────────────────────────────────────────────

interface GenericPickerModalProps<T extends string> {
  visible:  boolean;
  onClose:  () => void;
  title:    string;
  options:  PickerOption<T>[];
  selected: T | undefined;
  onSelect: (value: T) => void;
  isDark:   boolean;
}

function GenericPickerModal<T extends string>({
  visible, onClose, title, options, selected, onSelect, isDark,
}: GenericPickerModalProps<T>) {
  const theme   = useAppTheme();
  const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;
  const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: staticTheme.spacing.md,
      paddingBottom: staticTheme.spacing.xl,
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
  }), [theme, sheetBg, isDark, accent]);

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

interface PickerTriggerProps {
  label:       string;
  value:       string | undefined;
  placeholder: string;
  onPress:     () => void;
  error?:      string;
  accentColor: string;
  isDark:      boolean;
}

const PickerTrigger = React.memo<PickerTriggerProps>(
  ({ label, value, placeholder, onPress, error, accentColor, isDark }) => {
    const theme = useAppTheme();

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
                ? (isDark ? accentColor : (accentColor !== '' ? accentColor : theme.colors.text))
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddInventoryItemScreen() {
  const router  = useRouter();
  const addItem = useInventoryStore((s) => s.addItem);
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';

  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategory: InventoryCategory =
    params.category === 'ingredient' ? 'ingredient'
    : params.category === 'equipment' ? 'equipment'
    : 'product';

  const [categoryVisible,    setCategoryVisible]    = useState(false);
  const [unitVisible,        setUnitVisible]        = useState(false);
  const [conditionVisible,   setConditionVisible]   = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: { category: initialCategory, unit: 'pcs', quantity: 0 },
  });

  const selectedCategory  = watch('category');
  const selectedUnit      = watch('unit');
  const selectedCondition = watch('condition');

  // Auto-fill costPrice from total ingredient cost when ingredients change
  const handleIngredientsChange = useCallback((ingredients: SelectedIngredient[]) => {
    setSelectedIngredients(ingredients);
    if (ingredients.length > 0) {
      const total = ingredients.reduce((sum, i) => sum + i.lineCost, 0);
      setValue('costPrice', total, { shouldValidate: false });
    }
  }, [setValue]);

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
    async (values: FormValues) => {
      try {
        const newItem = await addItem({
          name:          values.name,
          category:      values.category,
          quantity:      values.quantity,
          unit:          values.unit,
          description:   values.description    ?? null,
          cost_price:    values.costPrice       ?? null,
          image_uri:     null,
          price:         values.price           ?? null,
          sku:           values.sku             ?? null,
          reorder_level: values.reorderLevel    ?? null,
          serial_number: values.serialNumber    ?? null,
          condition:     values.condition       ?? null,
          purchase_date: values.purchaseDate    ?? null,
        });

        // Persist ingredient links, deduct stock, and log production — products only.
        if (values.category === 'product' && selectedIngredients.length > 0) {
          // 1. Save ingredient recipe links
          await replaceProductIngredients(
            newItem.id,
            selectedIngredients.map((i) => ({
              ingredientId: i.ingredientId,
              quantityUsed: i.quantityUsed,
              unit:         i.unit,
            })),
          );

          // 2. Deduct ingredient quantities from stock
          const consumed = await consumeIngredients(newItem.id, values.quantity);

          // 3. Log this production run for tracking
          const totalCost = selectedIngredients.reduce((sum, i) => sum + i.lineCost, 0) * values.quantity;
          await createProductionLog(
            newItem.id,
            values.quantity,
            totalCost,
            consumed.map((c) => {
              const ing = selectedIngredients.find((i) => i.ingredientId === c.ingredientId);
              return {
                ingredientId:     c.ingredientId,
                quantityConsumed: c.deducted,
                unit:             ing?.unit ?? '',
                lineCost:         c.deducted * (ing?.costPrice ?? 0),
                ...(ing?.costPrice !== undefined ? { costPrice: ing.costPrice } : {}),
              };
            }),
          );

          // 4. Refresh Zustand cache so ingredient quantities update in UI
          await initializeInventory();
        }

        router.back();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save item. Please try again.';
        console.error('[AddInventoryItem] onSubmit error:', err);
        Alert.alert('Save Failed', message);
      }
    },
    [addItem, router, selectedIngredients],
  );

  const categoryLabel  = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory)?.label;
  const unitLabel      = UNIT_OPTIONS.find((o) => o.value === selectedUnit)?.label;
  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === selectedCondition)?.label;
  const accentColor    = isDark ? categoryAccentDark(selectedCategory) : categoryAccentLight(selectedCategory);

  const dynStyles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
  }), [theme]);

  return (
    <View style={dynStyles.safe}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={kbStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={scrollStyles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark}>
            <SectionHeader title="Basic Information" accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} />
            <FormField name="name" control={control} label="Item Name *" placeholder="e.g. Arabica Coffee Beans" autoCapitalize="words" autoCorrect={false} />
            <PickerTrigger
              label="Category *"
              value={categoryLabel}
              placeholder="Select category"
              onPress={() => setCategoryVisible(true)}
              accentColor={accentColor}
              isDark={isDark}
              {...(errors.category ? { error: errors.category.message } : {})}
            />
            <View style={rowStyles.row}>
              <View style={rowStyles.half}>
                <FormField name="quantity" control={control} label="Quantity *" placeholder="0" keyboardType="decimal-pad" />
              </View>
              <View style={rowStyles.half}>
                <PickerTrigger
                  label="Unit *"
                  value={unitLabel}
                  placeholder="Select unit"
                  onPress={() => setUnitVisible(true)}
                  accentColor={accentColor}
                  isDark={isDark}
                  {...(errors.unit ? { error: errors.unit.message } : {})}
                />
              </View>
            </View>
            <FormField
              name="costPrice"
              control={control}
              label="Cost Price (₱)"
              placeholder="0.00"
              keyboardType="decimal-pad"
              helperText={selectedIngredients.length > 0 ? 'Auto-calculated from ingredients — you can override' : 'Purchase or production cost'}
            />
            <FormField name="description" control={control} label="Description" placeholder="Optional notes about this item..." multiline numberOfLines={3} autoCapitalize="sentences" />
          </SectionCard>

          {/* Product-specific */}
          {selectedCategory === 'product' && (
            <>
              <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark}>
                <SectionHeader title="Product Details" accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} />
                <FormField name="price" control={control} label="Selling Price (₱)" placeholder="0.00" keyboardType="decimal-pad" />
                <FormField name="sku" control={control} label="SKU / Barcode" placeholder="e.g. SKU-001" autoCapitalize="characters" autoCorrect={false} />
              </SectionCard>

              <SectionCard accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]} isDark={isDark}>
                <IngredientSelector
                  selectedIngredients={selectedIngredients}
                  onIngredientsChange={handleIngredientsChange}
                  isDark={isDark}
                  accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]}
                />
              </SectionCard>
            </>
          )}

          {/* Ingredient-specific */}
          {selectedCategory === 'ingredient' && (
            <SectionCard accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]} isDark={isDark}>
              <SectionHeader title="Ingredient Details" accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]} isDark={isDark} />
              <FormField name="reorderLevel" control={control} label="Reorder Level" placeholder="e.g. 10" keyboardType="decimal-pad" helperText="Alert fires when quantity drops to or below this value" />
            </SectionCard>
          )}

          {/* Equipment-specific */}
          {selectedCategory === 'equipment' && (
            <SectionCard accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} isDark={isDark}>
              <SectionHeader title="Equipment Details" accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} isDark={isDark} />
              <FormField name="serialNumber" control={control} label="Serial / Asset Number" placeholder="e.g. SN-2024-001" autoCapitalize="characters" autoCorrect={false} />
              <PickerTrigger
                label="Condition"
                value={conditionLabel}
                placeholder="Select condition"
                onPress={() => setConditionVisible(true)}
                accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]}
                isDark={isDark}
              />
              <FormField name="purchaseDate" control={control} label="Purchase Date" placeholder="YYYY-MM-DD" keyboardType="numeric" helperText="Format: YYYY-MM-DD" />
            </SectionCard>
          )}

          <Button
            title={isSubmitting ? 'Saving...' : 'Save Item'}
            onPress={handleSubmit(onSubmit)}
            variant="primary"
            size="lg"
            loading={isSubmitting}
            fullWidth
            style={scrollStyles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <GenericPickerModal
        visible={categoryVisible}
        onClose={() => setCategoryVisible(false)}
        title="Select Category"
        options={CATEGORY_OPTIONS}
        selected={selectedCategory}
        onSelect={handleCategorySelect}
        isDark={isDark}
      />
      <GenericPickerModal
        visible={unitVisible}
        onClose={() => setUnitVisible(false)}
        title="Select Unit"
        options={UNIT_OPTIONS}
        selected={selectedUnit}
        onSelect={handleUnitSelect}
        isDark={isDark}
      />
      <GenericPickerModal
        visible={conditionVisible}
        onClose={() => setConditionVisible(false)}
        title="Select Condition"
        options={CONDITION_OPTIONS}
        selected={selectedCondition}
        onSelect={handleConditionSelect}
        isDark={isDark}
      />
    </View>
  );
}

const kbStyles = StyleSheet.create({
  flex: { flex: 1 },
});

const scrollStyles = StyleSheet.create({
  content: { padding: staticTheme.spacing.md, gap: staticTheme.spacing.sm, paddingBottom: staticTheme.spacing.xl },
  saveBtn: { marginTop: staticTheme.spacing.sm },
});

const rowStyles = StyleSheet.create({
  row:  { flexDirection: 'row', gap: staticTheme.spacing.sm },
  half: { flex: 1 },
});
