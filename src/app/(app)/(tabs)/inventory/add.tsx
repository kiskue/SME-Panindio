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
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ScanBarcode } from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { DatePickerFormField } from '@/components/molecules/DatePickerField';
import {
  PickerTrigger,
  GenericPickerModal,
  categoryAccent,
  UNIT_OPTIONS,
  CONDITION_OPTIONS,
} from '@/components/molecules/InventoryFieldPicker';
import { ProductTypeBadge } from '@/components/molecules/ProductTypeBadge';
import { AddInitialStockSheet } from '@/components/molecules/AddInitialStockSheet';
import { BarcodeScannerModal } from '@/components/molecules/BarcodeScannerModal';
import { LoaderOverlay } from '@/components/molecules/LoaderOverlay';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { IngredientSelector } from '@/components/organisms/IngredientSelector';
import { RawMaterialSelector } from '@/components/organisms/RawMaterialSelector';
import { useInventoryStore, useThemeStore, selectThemeMode, useAuthStore, selectCurrentUser } from '@/store';
import { isProductionBusiness } from '@/types';
import {
  replaceProductIngredients,
} from '@/database/repositories/product_ingredients.repository';
import { setProductRawMaterials } from '@/database/repositories/raw_materials.repository';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { useAppDialog } from '@/hooks/useAppDialog';
import type {
  InventoryCategory,
  EquipmentCondition,
  StockUnit,
  SelectedIngredient,
  SelectedRawMaterial,
  InventoryItem,
  ProductType,
} from '@/types';

// ─── Yup schema ───────────────────────────────────────────────────────────────

// `quantity` is intentionally excluded — stock levels are managed exclusively
// via the Add Initial Stock sheet (shown after product creation) and subsequent
// Add Stock / Reduce Stock actions. Never by direct form entry at creation time.
const schema = yup.object({
  name:         yup.string().trim().min(2, 'Name must be at least 2 characters').required('Name is required'),
  category:     yup.mixed<InventoryCategory>().oneOf(['product', 'ingredient', 'equipment']).required('Category is required'),
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

// PickerOption / UNIT_OPTIONS / CONDITION_OPTIONS / categoryAccent now live in
// the shared molecule `@/components/molecules/InventoryFieldPicker`.

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

// PickerTrigger, GenericPickerModal and ProductTypeBadge were extracted to
// shared molecules (`@/components/molecules/InventoryFieldPicker` and
// `@/components/molecules/ProductTypeBadge`) and are imported above.

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddInventoryItemScreen() {
  const router  = useRouter();
  const addItem = useInventoryStore((s) => s.addItem);
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';

  // Feature gate: production-only features (BOM, ingredients, raw materials) are
  // hidden for reseller businesses. Default to true when the mode is unknown
  // (e.g. user logged in before this field was introduced) to avoid hiding features.
  const currentUser    = useAuthStore(selectCurrentUser);
  const operationMode  = currentUser?.businessOperationMode ?? 'production';
  const showProduction = isProductionBusiness(operationMode);

  const params = useLocalSearchParams<{ category?: string; productType?: string }>();
  const initialCategory: InventoryCategory =
    params.category === 'ingredient' ? 'ingredient'
    : params.category === 'equipment' ? 'equipment'
    : 'product';

  // Product type passed from ProductTypeSelectionSheet via URL param.
  // Defaults to 'ready_to_sell' so the form is always in a valid state even
  // when navigated to directly (e.g. from a deep link or the inventory overview FAB).
  const initialProductType: ProductType =
    params.productType === 'manufactured' ? 'manufactured' : 'ready_to_sell';

  const dialog = useAppDialog();

  const [unitVisible,          setUnitVisible]          = useState(false);
  const [conditionVisible,     setConditionVisible]     = useState(false);
  const [scannerVisible,       setScannerVisible]       = useState(false);
  const [selectedIngredients,  setSelectedIngredients]  = useState<SelectedIngredient[]>([]);
  const [selectedRawMaterials, setSelectedRawMaterials] = useState<SelectedRawMaterial[]>([]);

  // Post-save state: holds the newly created product item while the initial
  // stock sheet is open. Null means the sheet is not yet visible.
  const [pendingStockItem, setPendingStockItem] = useState<InventoryItem | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: { category: initialCategory, unit: 'pcs' },
  });

  const selectedCategory  = watch('category');
  const selectedUnit      = watch('unit');
  const selectedCondition = watch('condition');
  const skuValue          = watch('sku');

  // Auto-fill costPrice from total ingredient + raw material cost when either changes
  const handleIngredientsChange = useCallback((ingredients: SelectedIngredient[]) => {
    setSelectedIngredients(ingredients);
    if (ingredients.length > 0) {
      const ingTotal = ingredients.reduce((sum, i) => sum + i.lineCost, 0);
      const rmTotal  = selectedRawMaterials.reduce((sum, m) => sum + m.lineCost, 0);
      setValue('costPrice', ingTotal + rmTotal, { shouldValidate: false });
    }
  }, [setValue, selectedRawMaterials]);

  const handleRawMaterialsChange = useCallback((materials: SelectedRawMaterial[]) => {
    setSelectedRawMaterials(materials);
    // Re-calculate costPrice to include raw material cost alongside ingredients
    const ingTotal = selectedIngredients.reduce((sum, i) => sum + i.lineCost, 0);
    const rmTotal  = materials.reduce((sum, m) => sum + m.lineCost, 0);
    if (selectedIngredients.length > 0 || materials.length > 0) {
      setValue('costPrice', ingTotal + rmTotal, { shouldValidate: false });
    }
  }, [setValue, selectedIngredients]);

  const handleUnitSelect = useCallback(
    (value: StockUnit) => setValue('unit', value, { shouldValidate: true }),
    [setValue],
  );
  const handleConditionSelect = useCallback(
    (value: EquipmentCondition) => setValue('condition', value, { shouldValidate: true }),
    [setValue],
  );

  // Receives a scanned barcode value from BarcodeScannerModal and populates
  // the SKU field. The modal closes itself after firing this callback.
  const handleSkuScanned = useCallback(
    (barcode: string) => {
      setValue('sku', barcode, { shouldValidate: true });
    },
    [setValue],
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        // ── 1. Create the item master record ─────────────────────────────────
        // Products are always created with quantity = 0.
        // Stock is added separately via AddInitialStockSheet after creation.
        const newItem = await addItem({
          name:          values.name,
          category:      values.category,
          quantity:      0,
          unit:          values.unit,
          description:   values.description ?? null,
          cost_price:    values.costPrice    ?? null,
          image_uri:     null,
          price:         values.price        ?? null,
          sku:           values.sku          ?? null,
          // Only store the product type for product category items.
          // For ingredients and equipment the column defaults to 'ready_to_sell'
          // which is harmless — the UI never reads it for those categories.
          ...(values.category === 'product'
            ? { product_type: initialProductType }
            : {}),
          reorder_level: values.reorderLevel ?? null,
          serial_number: values.serialNumber ?? null,
          condition:     values.condition    ?? null,
          purchase_date: values.purchaseDate ?? null,
        });

        // ── 2. Save BOM links for products (no stock deductions at this step) ─
        // Ingredient and raw material links define the recipe but do NOT
        // consume any stock here. Stock deductions happen when stock is added
        // via the Add Stock (production) flow on the product detail screen.
        if (values.category === 'product') {
          if (selectedIngredients.length > 0) {
            await replaceProductIngredients(
              newItem.id,
              selectedIngredients.map((i) => ({
                ingredientId: i.ingredientId,
                quantityUsed: i.quantityUsed,
                unit:         i.unit,
                stockUnit:    i.stockUnit,
              })),
            );
          }

          if (selectedRawMaterials.length > 0) {
            await setProductRawMaterials(
              newItem.id,
              selectedRawMaterials.map((m) => ({
                rawMaterialId:    m.rawMaterialId,
                quantityRequired: m.quantityRequired,
              })),
            );
          }

          // ── 3. For products: show the initial stock sheet instead of navigating back.
          // Non-product categories (ingredient, equipment) go straight back.
          setPendingStockItem(newItem);
        } else {
          router.back();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save item. Please try again.';
        console.error('[AddInventoryItem] onSubmit error:', err);
        dialog.show({ variant: 'error', title: 'Save Failed', message });
      }
    },
    [addItem, router, selectedIngredients, selectedRawMaterials],
  );

  const handleInitialStockSuccess = useCallback((_newQuantity: number) => {
    setPendingStockItem(null);
    router.back();
  }, [router]);

  const handleInitialStockSkip = useCallback(() => {
    setPendingStockItem(null);
    router.back();
  }, [router]);

  const unitLabel      = UNIT_OPTIONS.find((o) => o.value === selectedUnit)?.label;
  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === selectedCondition)?.label;
  const accentColor    = categoryAccent(selectedCategory, isDark);

  const skuInputBg     = isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background;
  const skuInputBorder = isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border;
  const skuInputText   = isDark ? '#FFFFFF'                : theme.colors.text;
  const skuPlaceholder = isDark ? 'rgba(255,255,255,0.25)' : theme.colors.placeholder;
  const skuScanAccent  = isDark ? '#4F9EFF'                : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    // SKU row: TextInput + scan button side-by-side
    skuRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: staticTheme.spacing.sm,
    },
    skuInput: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: skuInputBorder,
      borderRadius: staticTheme.borderRadius.md,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
      backgroundColor: skuInputBg,
      minHeight: 48,
    },
    skuTextInput: {
      flex: 1,
      color: skuInputText,
      fontSize: 15,
    },
    skuScanBtn: {
      width: 48,
      height: 48,
      borderRadius: staticTheme.borderRadius.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: `${skuScanAccent}18`,
      borderWidth: 1,
      borderColor: `${skuScanAccent}40`,
    },
    skuLabel: {
      color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700],
      marginBottom: staticTheme.spacing.xs,
    },
    skuWrapper: {
      marginBottom: staticTheme.spacing.md,
    },
  }), [theme, isDark, skuInputBg, skuInputBorder, skuInputText, skuScanAccent]);

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
          {/* Product type indicator — only shown for 'product' category */}
          {selectedCategory === 'product' && (
            <ProductTypeBadge productType={initialProductType} />
          )}

          {/* Basic Info */}
          <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark}>
            <SectionHeader title="Basic Information" accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} />
            <FormField name="name" control={control} label="Item Name *" placeholder="e.g. Arabica Coffee Beans" autoCapitalize="words" autoCorrect={false} />
            <PickerTrigger
              label="Unit of Measure *"
              value={unitLabel}
              placeholder="Select unit"
              onPress={() => setUnitVisible(true)}
              accentColor={accentColor}
              {...(errors.unit ? { error: errors.unit.message } : {})}
            />
            <FormField
              name="costPrice"
              control={control}
              label="Cost Price (₱)"
              placeholder="0.00"
              keyboardType="decimal-pad"
              helperText={
                showProduction &&
                initialProductType === 'manufactured' &&
                selectedIngredients.length > 0
                  ? 'Auto-calculated from ingredients — you can override'
                  : initialProductType === 'manufactured'
                    ? 'Total production cost per unit'
                    : 'Purchase price from supplier'
              }
            />
            <FormField name="description" control={control} label="Description" placeholder="Optional notes about this item..." multiline numberOfLines={3} autoCapitalize="sentences" />
          </SectionCard>

          {/* Product-specific */}
          {selectedCategory === 'product' && (
            <>
              <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark}>
                <SectionHeader title="Product Details" accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} />
                <FormField name="price" control={control} label="Selling Price (₱)" placeholder="0.00" keyboardType="decimal-pad" />

                {/* SKU / Barcode — plain TextInput + scan button */}
                <View style={dynStyles.skuWrapper}>
                  <Text
                    variant="body-sm"
                    weight="medium"
                    style={dynStyles.skuLabel}
                  >
                    SKU / Barcode
                  </Text>
                  <View style={dynStyles.skuRow}>
                    <View style={dynStyles.skuInput}>
                      <TextInput
                        style={dynStyles.skuTextInput}
                        value={skuValue ?? ''}
                        onChangeText={(text) =>
                          setValue('sku', text.length > 0 ? text : undefined, {
                            shouldValidate: true,
                          })
                        }
                        placeholder="e.g. SKU-001 or scan barcode"
                        placeholderTextColor={skuPlaceholder}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        accessibilityLabel="SKU or barcode"
                      />
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        dynStyles.skuScanBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => setScannerVisible(true)}
                      accessibilityLabel="Scan barcode"
                      accessibilityRole="button"
                      hitSlop={4}
                    >
                      <ScanBarcode
                        size={22}
                        color={skuScanAccent}
                      />
                    </Pressable>
                  </View>
                  {errors.sku?.message !== undefined && (
                    <Text
                      variant="body-xs"
                      style={{ color: staticTheme.colors.error[500], marginTop: staticTheme.spacing.xs }}
                    >
                      {errors.sku.message}
                    </Text>
                  )}
                </View>
              </SectionCard>

              {/* BOM sections — only shown for production businesses
                  adding a manufactured product. Ready-to-sell products
                  have no recipe and never show these selectors.           */}
              {showProduction && initialProductType === 'manufactured' && (
                <>
                  <SectionCard accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]} isDark={isDark}>
                    <IngredientSelector
                      selectedIngredients={selectedIngredients}
                      onIngredientsChange={handleIngredientsChange}
                      isDark={isDark}
                      accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]}
                    />
                  </SectionCard>

                  <SectionCard accentColor={isDark ? '#F59E0B' : staticTheme.colors.highlight[500]} isDark={isDark}>
                    <RawMaterialSelector
                      selectedMaterials={selectedRawMaterials}
                      onMaterialsChange={handleRawMaterialsChange}
                      isDark={isDark}
                      accentColor={isDark ? '#F59E0B' : staticTheme.colors.highlight[500]}
                    />
                  </SectionCard>
                </>
              )}
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
              />
              <DatePickerFormField name="purchaseDate" control={control} label="Purchase Date" maximumDate={new Date()} accessibilityLabel="Purchase date" />
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
        visible={unitVisible}
        onClose={() => setUnitVisible(false)}
        title="Select Unit"
        options={UNIT_OPTIONS}
        selected={selectedUnit}
        onSelect={handleUnitSelect}
      />
      <GenericPickerModal
        visible={conditionVisible}
        onClose={() => setConditionVisible(false)}
        title="Select Condition"
        options={CONDITION_OPTIONS}
        selected={selectedCondition}
        onSelect={handleConditionSelect}
      />

      {/* Initial stock sheet — shown after product creation */}
      {pendingStockItem !== null && (
        <AddInitialStockSheet
          visible
          productId={pendingStockItem.id}
          productName={pendingStockItem.name}
          productUnit={pendingStockItem.unit}
          {...(pendingStockItem.costPrice !== undefined
            ? { defaultCostPrice: pendingStockItem.costPrice }
            : {})}
          onSuccess={handleInitialStockSuccess}
          onSkip={handleInitialStockSkip}
        />
      )}

      {/* Barcode scanner — triggered by the scan icon next to the SKU field */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleSkuScanned}
      />

      {/* App dialog — replaces native Alert.alert */}
      {dialog.Dialog}

      {/* Saving overlay — blocks interaction while RHF isSubmitting */}
      <LoaderOverlay visible={isSubmitting} message="Saving item…" />
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

