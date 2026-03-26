/**
 * ManualEntryBottomSheet
 *
 * Bottom sheet form for recording a manual ingredient consumption event.
 * Uses React Hook Form + Yup validation. Calls `logManualEntry()` from
 * the ingredient_consumption store on submit.
 *
 * Fields:
 *   - Ingredient (searchable picker)
 *   - Quantity (numeric, required > 0)
 *   - Trigger type: MANUAL_ADJUSTMENT | WASTAGE | RETURN | TRANSFER
 *   - Notes (optional, multiline)
 *
 * Design:
 *   - Slides up from the bottom (RN Modal + Animated)
 *   - Matches the dark/light theme of the ingredient-logs screen
 *   - Color-coded trigger selector chips (same palette as LogCard)
 */

import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  useImperativeHandle,
} from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  X,
  Wheat,
  Search,
  CheckCircle,
  AlertCircle,
  Layers,
  RotateCcw,
  Wrench,
  Trash2,
  ArrowRightLeft,
} from 'lucide-react-native';
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { useInventoryStore, selectIngredients } from '@/store';
import { useIngredientConsumptionStore } from '@/store';
import { theme as staticTheme } from '@/core/theme';
import type { IngredientConsumptionTrigger, InventoryItem } from '@/types';
import type { CreateConsumptionLogInput } from '../../../database/repositories/ingredient_consumption_logs.repository';
import { useShallow } from 'zustand/react/shallow';


// ─── Dark-mode palette ────────────────────────────────────────────────────────

const DARK_ACCENT = '#4F9EFF';
const DARK_GREEN  = '#3DD68C';
const DARK_AMBER  = '#FFB020';
const DARK_RED    = '#FF6B6B';

// ─── Trigger selector config ──────────────────────────────────────────────────

type ManualTrigger = Extract<
  IngredientConsumptionTrigger,
  'MANUAL_ADJUSTMENT' | 'WASTAGE' | 'RETURN' | 'TRANSFER'
>;

const MANUAL_TRIGGERS: ManualTrigger[] = [
  'MANUAL_ADJUSTMENT',
  'WASTAGE',
  'RETURN',
  'TRANSFER',
];

const TRIGGER_LABELS: Record<ManualTrigger, string> = {
  MANUAL_ADJUSTMENT: 'Manual',
  WASTAGE:           'Wastage',
  RETURN:            'Return',
  TRANSFER:          'Transfer',
};

function getTriggerColor(trigger: ManualTrigger, isDark: boolean): string {
  switch (trigger) {
    case 'MANUAL_ADJUSTMENT': return isDark ? DARK_AMBER  : staticTheme.colors.warning[500];
    case 'WASTAGE':           return isDark ? DARK_RED    : staticTheme.colors.error[500];
    case 'RETURN':            return isDark ? DARK_GREEN  : staticTheme.colors.success[500];
    case 'TRANSFER':          return isDark ? '#A78BFA'   : staticTheme.colors.info[500];
  }
}

function TriggerChipIcon({
  trigger,
  color,
}: {
  trigger: ManualTrigger;
  color:   string;
}): React.ReactElement {
  switch (trigger) {
    case 'MANUAL_ADJUSTMENT': return <Wrench        size={13} color={color} />;
    case 'WASTAGE':           return <Trash2        size={13} color={color} />;
    case 'RETURN':            return <RotateCcw     size={13} color={color} />;
    case 'TRANSFER':          return <ArrowRightLeft size={13} color={color} />;
  }
}

// ─── Form schema ──────────────────────────────────────────────────────────────

interface ManualEntryFormValues {
  quantity:    string;
  triggerType: ManualTrigger;
  notes:       string;
}

const schema = yup.object({
  quantity: yup
    .string()
    .required('Quantity is required')
    .test('positive-number', 'Must be a number greater than 0', (v) => {
      const n = parseFloat(v ?? '');
      return !isNaN(n) && n > 0;
    }),
  triggerType: yup
    .mixed<ManualTrigger>()
    .oneOf(MANUAL_TRIGGERS)
    .required('Select a trigger type'),
  notes: yup.string().default(''),
});

// ─── Ingredient picker sub-sheet ──────────────────────────────────────────────

interface IngredientPickerProps {
  visible:     boolean;
  onClose:     () => void;
  onSelect:    (item: InventoryItem) => void;
  isDark:      boolean;
  selectedId:  string | null;
}

const IngredientPicker = React.memo<IngredientPickerProps>(
  ({ visible, onClose, onSelect, isDark, selectedId }) => {
    const ingredients = useInventoryStore(useShallow(selectIngredients));
    const insets      = useSafeAreaInsets();
    const [query, setQuery]       = useState('');

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
    const accent    = isDark ? DARK_GREEN : staticTheme.colors.success[600];

    if (!visible) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <Pressable style={pickerStyles.overlay} onPress={onClose}>
          <Pressable
            style={[
              pickerStyles.sheet,
              {
                backgroundColor: sheetBg,
                borderColor: isDark ? 'rgba(255,255,255,0.07)' : '#E5E7EB',
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[pickerStyles.handle, { backgroundColor: handleBg }]} />

            <View style={pickerStyles.header}>
              <Text variant="h5" weight="semibold" style={{ color: textColor }}>
                Select Ingredient
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  pickerStyles.closeBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#F3F4F6',
                  },
                ]}
                hitSlop={8}
              >
                <X size={16} color={subColor} />
              </Pressable>
            </View>

            <View
              style={[
                pickerStyles.searchWrap,
                { backgroundColor: inputBg, borderColor: inputBdr },
              ]}
            >
              <Search size={15} color={subColor} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search ingredients..."
                placeholderTextColor={subColor}
                style={[pickerStyles.searchInput, { color: textColor }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={14} color={subColor} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View
                  style={{
                    height:          1,
                    backgroundColor: sepColor,
                    marginVertical:  2,
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={pickerStyles.empty}>
                  <Wheat size={32} color={subColor} />
                  <Text
                    variant="body-sm"
                    style={{ color: subColor, marginTop: 8 }}
                  >
                    No ingredients found
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                const rowBg = isSelected
                  ? isDark ? `${accent}18` : `${accent}12`
                  : 'transparent';

                return (
                  <Pressable
                    style={({ pressed }) => [
                      pickerStyles.optionRow,
                      {
                        backgroundColor: pressed
                          ? isDark
                            ? 'rgba(255,255,255,0.05)'
                            : '#F9FAFB'
                          : rowBg,
                      },
                    ]}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <View
                      style={[
                        pickerStyles.optionIconWrap,
                        {
                          backgroundColor: isDark
                            ? 'rgba(61,214,140,0.15)'
                            : 'rgba(34,197,94,0.10)',
                        },
                      ]}
                    >
                      <Wheat size={16} color={accent} />
                    </View>
                    <View style={pickerStyles.optionInfo}>
                      <Text
                        variant="body"
                        weight="medium"
                        style={{ color: textColor }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text variant="body-xs" style={{ color: subColor }}>
                        {item.quantity} {item.unit} in stock
                      </Text>
                    </View>
                    {isSelected && (
                      <CheckCircle size={18} color={accent} />
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
IngredientPicker.displayName = 'IngredientPicker';

const pickerStyles = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 20, maxHeight: '75%' },
  handle:        { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput:   { flex: 1, fontSize: 14, paddingVertical: 0 },
  optionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 8 },
  optionIconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionInfo:    { flex: 1, gap: 2 },
  empty:         { alignItems: 'center', paddingVertical: 32 },
});

// ─── Trigger Selector ─────────────────────────────────────────────────────────

interface TriggerSelectorProps {
  value:    ManualTrigger;
  onChange: (t: ManualTrigger) => void;
  isDark:   boolean;
  error?:   string;
}

const TriggerSelector = React.memo<TriggerSelectorProps>(
  ({ value, onChange, isDark, error }) => {
    const labelColor = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[700];
    const errorColor = isDark ? DARK_RED : staticTheme.colors.error[500];

    return (
      <View style={trigStyles.container}>
        <Text variant="body-sm" weight="medium" style={{ color: labelColor, marginBottom: 8 }}>
          Event Type
        </Text>
        <View style={trigStyles.row}>
          {MANUAL_TRIGGERS.map((t) => {
            const isActive = value === t;
            const clr      = getTriggerColor(t, isDark);
            const chipBg   = isActive
              ? isDark ? `${clr}22` : `${clr}15`
              : isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100];
            const chipBdr  = isActive ? `${clr}40` : 'transparent';

            return (
              <Pressable
                key={t}
                style={[
                  trigStyles.chip,
                  {
                    backgroundColor: chipBg,
                    borderColor:     chipBdr,
                  },
                ]}
                onPress={() => onChange(t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={TRIGGER_LABELS[t]}
              >
                <TriggerChipIcon trigger={t} color={isActive ? clr : (isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500])} />
                <Text
                  variant="body-xs"
                  weight={isActive ? 'semibold' : 'normal'}
                  style={{
                    color: isActive
                      ? clr
                      : isDark
                        ? 'rgba(255,255,255,0.45)'
                        : staticTheme.colors.gray[500],
                  }}
                >
                  {TRIGGER_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error !== undefined && (
          <View style={trigStyles.errorRow}>
            <AlertCircle size={12} color={errorColor} />
            <Text variant="body-xs" style={{ color: errorColor }}>{error}</Text>
          </View>
        )}
      </View>
    );
  },
);
TriggerSelector.displayName = 'TriggerSelector';

const trigStyles = StyleSheet.create({
  container: { marginBottom: staticTheme.spacing.sm },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    paddingHorizontal: 10,
    paddingVertical:   8,
    borderRadius:    staticTheme.borderRadius.full,
    borderWidth:     1,
    minWidth:        80,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

/** Imperative handle to open / close the sheet */
export interface ManualEntryBottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface ManualEntryBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  isDark:  boolean;
  /**
   * When provided the trigger selector is pre-selected to this value when the
   * sheet opens. Only ManualTrigger values are accepted (PRODUCTION is not a
   * valid manual entry type). Pass undefined to use the default
   * (MANUAL_ADJUSTMENT).
   */
  initialTrigger?: ManualTrigger;
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

const ManualEntryBottomSheetInner = (
  { visible, onClose, isDark, initialTrigger }: ManualEntryBottomSheetProps,
  ref: React.Ref<ManualEntryBottomSheetHandle>,
) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const insets   = useSafeAreaInsets();

  const [selectedIngredient, setSelectedIngredient] =
    useState<InventoryItem | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [ingredientError, setIngredientError] = useState<string | undefined>(undefined);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');

  const { logManualEntry } = useIngredientConsumptionStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualEntryFormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      quantity:    '',
      triggerType: initialTrigger ?? 'MANUAL_ADJUSTMENT',
      notes:       '',
    },
  });

  // ── Imperative handle ────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
    dismiss: () => modalRef.current?.dismiss(),
  }));

  // ── Sync `visible` prop → imperative API ─────────────────────────────────────

  const handleClose = useCallback(() => {
    modalRef.current?.dismiss();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setSubmitStatus('idle');
      setIngredientError(undefined);
      setSelectedIngredient(null);
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

    // ── Submit ─────────────────────────────────────────────────────────────────

    const onSubmit = useCallback(
      async (values: ManualEntryFormValues) => {
        if (selectedIngredient === null) {
          setIngredientError('Please select an ingredient');
          return;
        }
        setIngredientError(undefined);
        setSubmitStatus('submitting');

        const qty       = parseFloat(values.quantity);
        const costPrice = selectedIngredient.costPrice;

        // For RETURN trigger the quantity_consumed is negative (stock comes back)
        const quantityConsumed =
          values.triggerType === 'RETURN' ? -Math.abs(qty) : qty;

        const input: CreateConsumptionLogInput = {
          ingredientId:     selectedIngredient.id,
          quantityConsumed,
          unit:             selectedIngredient.unit,
          triggerType:      values.triggerType,
          totalCost:        Math.abs(qty) * (costPrice ?? 0),
          ...(costPrice !== undefined ? { costPrice } : {}),
          ...(values.notes.trim().length > 0
            ? { notes: values.notes.trim() }
            : {}),
        };

        try {
          await logManualEntry(input);
          setSubmitStatus('success');
          setTimeout(() => {
            handleClose();
          }, 900);
        } catch {
          setSubmitStatus('error');
        }
      },
      [selectedIngredient, logManualEntry, handleClose],
    );

    // ── Color tokens ───────────────────────────────────────────────────────────

    const sheetBg      = isDark ? '#1A1F2E' : '#FFFFFF';
    const handleBg     = isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB';
    const labelColor   = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[700];
    const textColor    = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
    const subColor     = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
    const inputBg      = isDark ? '#1E2435' : '#F8F9FC';
    const inputBdr     = isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';
    const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[200];
    const errorColor   = isDark ? DARK_RED : staticTheme.colors.error[500];
    const accent       = isDark ? DARK_ACCENT : staticTheme.colors.primary[500];

    const ingredientBtnBg  = isDark ? '#1E2435' : '#F8F9FC';
    const ingredientBtnBdr = ingredientError !== undefined
      ? errorColor
      : selectedIngredient !== null
        ? `${accent}40`
        : inputBdr;

    const isSubmitting = submitStatus === 'submitting';
    const isSuccess    = submitStatus === 'success';

    // ── Backdrop renderer ───────────────────────────────────────────────────────

    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
          opacity={0.55}
        />
      ),
      [],
    );

    const snapPoints = useMemo(() => ['65%'], []);

    const handleIndicatorStyle = useMemo(
      () => ({
        backgroundColor: handleBg,
        width: 36,
        height: 4,
      }),
      [handleBg],
    );

    const backgroundStyle = useMemo(
      () => ({ backgroundColor: sheetBg }),
      [sheetBg],
    );

    return (
      <>
        <BottomSheetModal
          ref={modalRef}
          snapPoints={snapPoints}
          onDismiss={onClose}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={handleIndicatorStyle}
          backgroundStyle={backgroundStyle}
          enablePanDownToClose
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: dividerColor }]}>
            <View style={[styles.headerIcon, { backgroundColor: `${accent}18` }]}>
              <Layers size={16} color={accent} />
            </View>
            <View style={styles.headerText}>
              <Text
                variant="h5"
                weight="semibold"
                style={{ color: textColor }}
              >
                Manual Entry
              </Text>
              <Text variant="body-xs" style={{ color: subColor }}>
                {initialTrigger !== undefined
                  ? `Pre-filled from ${TRIGGER_LABELS[initialTrigger]} event`
                  : 'Record a consumption event'}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={[
                styles.closeBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : staticTheme.colors.gray[100],
                },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={subColor} />
            </Pressable>
          </View>

          {/* Form body */}
          <BottomSheetScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
              {/* Ingredient selector */}
              <View style={styles.fieldBlock}>
                <Text
                  variant="body-sm"
                  weight="medium"
                  style={{ color: labelColor, marginBottom: 8 }}
                >
                  Ingredient
                  <Text style={{ color: errorColor }}> *</Text>
                </Text>

                <Pressable
                  style={[
                    styles.ingredientBtn,
                    {
                      backgroundColor: ingredientBtnBg,
                      borderColor:     ingredientBtnBdr,
                    },
                  ]}
                  onPress={() => setPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedIngredient !== null
                      ? `Selected ingredient: ${selectedIngredient.name}`
                      : 'Select an ingredient'
                  }
                >
                  <View
                    style={[
                      styles.ingredientBtnIcon,
                      {
                        backgroundColor: selectedIngredient !== null
                          ? `${accent}18`
                          : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : staticTheme.colors.gray[100],
                      },
                    ]}
                  >
                    <Wheat
                      size={16}
                      color={
                        selectedIngredient !== null
                          ? accent
                          : subColor
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    {selectedIngredient !== null ? (
                      <>
                        <Text
                          variant="body"
                          weight="medium"
                          style={{ color: textColor }}
                          numberOfLines={1}
                        >
                          {selectedIngredient.name}
                        </Text>
                        <Text variant="body-xs" style={{ color: subColor }}>
                          {selectedIngredient.quantity} {selectedIngredient.unit} in stock
                        </Text>
                      </>
                    ) : (
                      <Text variant="body" style={{ color: subColor }}>
                        Tap to select ingredient...
                      </Text>
                    )}
                  </View>

                  <Search size={15} color={subColor} />
                </Pressable>

                {ingredientError !== undefined && (
                  <View style={styles.errorRow}>
                    <AlertCircle size={12} color={errorColor} />
                    <Text variant="body-xs" style={{ color: errorColor }}>
                      {ingredientError}
                    </Text>
                  </View>
                )}
              </View>

              {/* Quantity */}
              <View style={styles.fieldBlock}>
                <Text
                  variant="body-sm"
                  weight="medium"
                  style={{ color: labelColor, marginBottom: 8 }}
                >
                  Quantity
                  {selectedIngredient !== null && (
                    <Text style={{ color: subColor }}>
                      {' '}({selectedIngredient.unit})
                    </Text>
                  )}
                  <Text style={{ color: errorColor }}> *</Text>
                </Text>
                <Controller
                  control={control}
                  name="quantity"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View>
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 2.5"
                        placeholderTextColor={subColor}
                        style={[
                          styles.textInput,
                          {
                            backgroundColor: inputBg,
                            borderColor:     errors.quantity !== undefined
                              ? errorColor
                              : inputBdr,
                            color:           textColor,
                          },
                        ]}
                        accessibilityLabel="Quantity"
                      />
                      {errors.quantity?.message !== undefined && (
                        <View style={styles.errorRow}>
                          <AlertCircle size={12} color={errorColor} />
                          <Text variant="body-xs" style={{ color: errorColor }}>
                            {errors.quantity.message}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                />
              </View>

              {/* Trigger type */}
              <Controller
                control={control}
                name="triggerType"
                render={({ field: { onChange, value } }) => (
                  <TriggerSelector
                    value={value}
                    onChange={onChange}
                    isDark={isDark}
                    {...(errors.triggerType?.message !== undefined
                      ? { error: errors.triggerType.message }
                      : {})}
                  />
                )}
              />

              {/* Notes */}
              <View style={styles.fieldBlock}>
                <Text
                  variant="body-sm"
                  weight="medium"
                  style={{ color: labelColor, marginBottom: 8 }}
                >
                  Notes{' '}
                  <Text style={{ color: subColor }}>(optional)</Text>
                </Text>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Add a note about this event..."
                      placeholderTextColor={subColor}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      style={[
                        styles.textInput,
                        styles.notesInput,
                        {
                          backgroundColor: inputBg,
                          borderColor:     inputBdr,
                          color:           textColor,
                        },
                      ]}
                      accessibilityLabel="Notes"
                    />
                  )}
                />
              </View>

              {/* Status feedback */}
              {submitStatus === 'error' && (
                <View
                  style={[
                    styles.statusBanner,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,107,107,0.10)'
                        : staticTheme.colors.error[50],
                      borderColor: isDark
                        ? 'rgba(255,107,107,0.30)'
                        : staticTheme.colors.error[200],
                    },
                  ]}
                >
                  <AlertCircle size={15} color={errorColor} />
                  <Text variant="body-xs" style={{ color: errorColor, flex: 1 }}>
                    Failed to save entry. Please try again.
                  </Text>
                </View>
              )}

              {submitStatus === 'success' && (
                <View
                  style={[
                    styles.statusBanner,
                    {
                      backgroundColor: isDark
                        ? 'rgba(61,214,140,0.10)'
                        : staticTheme.colors.success[50],
                      borderColor: isDark
                        ? 'rgba(61,214,140,0.30)'
                        : staticTheme.colors.success[200],
                    },
                  ]}
                >
                  <CheckCircle size={15} color={isDark ? DARK_GREEN : staticTheme.colors.success[600]} />
                  <Text
                    variant="body-xs"
                    style={{
                      color:  isDark ? DARK_GREEN : staticTheme.colors.success[600],
                      flex: 1,
                    }}
                  >
                    Entry saved successfully!
                  </Text>
                </View>
              )}
          </BottomSheetScrollView>

          {/* Footer action */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor:  dividerColor,
                backgroundColor: sheetBg,
                paddingBottom:   Math.max(insets.bottom, staticTheme.spacing.md),
              },
            ]}
          >
            <Button
              title="Cancel"
              variant="ghost"
              size="md"
              onPress={handleClose}
              style={{ flex: 1 }}
            />
            <Button
              title={
                isSubmitting
                  ? 'Saving…'
                  : isSuccess
                    ? 'Saved!'
                    : 'Save Entry'
              }
              variant="primary"
              size="md"
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || isSuccess}
              {...(isSubmitting
                ? { leftIcon: <ActivityIndicator size="small" color="#FFFFFF" /> }
                : isSuccess
                  ? { leftIcon: <CheckCircle size={16} color="#FFFFFF" /> }
                  : {}
              )}
              style={{ flex: 2 }}
            />
          </View>
        </BottomSheetModal>

        {/* Ingredient picker (nested RN Modal — intentionally kept separate) */}
        <IngredientPicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={(item) => {
            setSelectedIngredient(item);
            setIngredientError(undefined);
          }}
          isDark={isDark}
          selectedId={selectedIngredient?.id ?? null}
        />
      </>
    );
};

export const ManualEntryBottomSheet = React.forwardRef<
  ManualEntryBottomSheetHandle,
  ManualEntryBottomSheetProps
>(ManualEntryBottomSheetInner);

ManualEntryBottomSheet.displayName = 'ManualEntryBottomSheet';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   staticTheme.spacing.sm,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  headerText: { flex: 1, gap: 2 },
  closeBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  formScroll:  { flex: 1 },
  formContent: {
    padding:    staticTheme.spacing.md,
    gap:        staticTheme.spacing.xs,
    paddingBottom: staticTheme.spacing.xl,
  },
  fieldBlock: { marginBottom: staticTheme.spacing.sm },
  ingredientBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    borderRadius:      staticTheme.borderRadius.lg,
    borderWidth:       1,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical:   12,
    minHeight:         56,
  },
  ingredientBtnIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  textInput: {
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.lg,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical:   12,
    fontSize:          15,
    minHeight:         48,
  },
  notesInput: {
    minHeight:   88,
    paddingTop:  12,
    textAlignVertical: 'top',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     5,
  },
  statusBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               staticTheme.spacing.sm,
    borderWidth:       1,
    borderRadius:      staticTheme.borderRadius.xl,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical:   staticTheme.spacing.sm,
    marginTop:         staticTheme.spacing.xs,
  },
  footer: {
    flexDirection:     'row',
    gap:               staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.sm,
    borderTopWidth:    1,
  },
});
