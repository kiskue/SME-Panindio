/**
 * Inventory Item Detail Screen
 *
 * Two-zone layout:
 *   1. VIEW ZONE — hero header + read-only info panels showing all item fields beautifully.
 *   2. EDIT ZONE — collapsible edit form (same logic as add.tsx) with Save / Delete actions.
 *
 * Dark-mode-first. Every color responds to `isDark` via `useThemeStore(selectThemeMode)`.
 * Category accent palette is the same as InventoryItemCard so the two screens feel cohesive.
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
  Animated,
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
  ChevronRight,
  Check,
  Trash2,
  Clock,
  DollarSign,
  Tag,
  Hash,
  BarChart2,
  AlertTriangle,
  Edit3,
  Info,
  CalendarDays,
  Layers,
  ShieldCheck,
} from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useInventoryStore, selectItemById, useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryCategory, EquipmentCondition, StockUnit } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Validation schema (unchanged from add.tsx) ───────────────────────────────

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

const CATEGORY_OPTIONS: PickerOption<InventoryCategory>[] = [
  { value: 'product',    label: 'Product',    description: 'Finished goods for sale',     icon: <Package size={20} color={staticTheme.colors.primary[500]} /> },
  { value: 'ingredient', label: 'Ingredient', description: 'Raw materials & consumables', icon: <Wheat   size={20} color={staticTheme.colors.success[500]} /> },
  { value: 'equipment',  label: 'Equipment',  description: 'Tools and assets',             icon: <Wrench  size={20} color={staticTheme.colors.highlight[400]} /> },
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

// ─── Stock health ─────────────────────────────────────────────────────────────

type StockHealth = 'out' | 'low' | 'healthy';

interface HealthPalette {
  text:   string;
  bg:     string;
  border: string;
  bar:    string;
  barBg:  string;
  label:  string;
}

function resolveHealth(quantity: number, reorderLevel: number | undefined): StockHealth {
  if (quantity === 0) return 'out';
  if (reorderLevel !== undefined && quantity <= reorderLevel) return 'low';
  return 'healthy';
}

function healthPalette(health: StockHealth, isDark: boolean): HealthPalette {
  if (isDark) {
    switch (health) {
      case 'out':     return { text: '#FF6B6B', bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.35)', bar: '#FF6B6B', barBg: 'rgba(255,107,107,0.12)', label: 'Out of Stock' };
      case 'low':     return { text: '#FFB020', bg: 'rgba(255,176,32,0.15)',  border: 'rgba(255,176,32,0.35)',  bar: '#FFB020', barBg: 'rgba(255,176,32,0.12)',  label: 'Low Stock'    };
      case 'healthy': return { text: '#3DD68C', bg: 'rgba(61,214,140,0.13)', border: 'rgba(61,214,140,0.30)', bar: '#3DD68C', barBg: 'rgba(61,214,140,0.10)', label: 'In Stock'     };
    }
  } else {
    switch (health) {
      case 'out':     return { text: staticTheme.colors.error[500],   bg: staticTheme.colors.error[50],   border: staticTheme.colors.error[200],   bar: staticTheme.colors.error[500],   barBg: staticTheme.colors.error[100],   label: 'Out of Stock' };
      case 'low':     return { text: staticTheme.colors.warning[600], bg: staticTheme.colors.warning[50], border: staticTheme.colors.warning[200], bar: staticTheme.colors.warning[500], barBg: staticTheme.colors.warning[100], label: 'Low Stock'    };
      case 'healthy': return { text: staticTheme.colors.success[600], bg: staticTheme.colors.success[50], border: staticTheme.colors.success[200], bar: staticTheme.colors.success[500], barBg: staticTheme.colors.success[100], label: 'In Stock'     };
    }
  }
}

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  accentColor: string;
  glowColor:   string;
  iconBg:      string;
  label:       string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const DARK_CAT: Record<InventoryCategory, CategoryConfig> = {
  product:    { accentColor: '#4F9EFF', glowColor: 'rgba(79,158,255,0.22)',  iconBg: 'rgba(79,158,255,0.15)',  label: 'Product',    Icon: Package },
  ingredient: { accentColor: '#3DD68C', glowColor: 'rgba(61,214,140,0.20)',  iconBg: 'rgba(61,214,140,0.13)',  label: 'Ingredient', Icon: Wheat   },
  equipment:  { accentColor: '#FFB020', glowColor: 'rgba(255,176,32,0.20)',  iconBg: 'rgba(255,176,32,0.13)',  label: 'Equipment',  Icon: Wrench  },
};

const LIGHT_CAT: Record<InventoryCategory, CategoryConfig> = {
  product:    { accentColor: staticTheme.colors.primary[500],   glowColor: `${staticTheme.colors.primary[500]}20`,   iconBg: staticTheme.colors.primary[50],   label: 'Product',    Icon: Package },
  ingredient: { accentColor: staticTheme.colors.success[500],   glowColor: `${staticTheme.colors.success[500]}20`,   iconBg: staticTheme.colors.success[50],   label: 'Ingredient', Icon: Wheat   },
  equipment:  { accentColor: staticTheme.colors.highlight[400], glowColor: `${staticTheme.colors.highlight[400]}20`, iconBg: staticTheme.colors.highlight[50], label: 'Equipment',  Icon: Wrench  },
};

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function stockFillRatio(quantity: number, reorderLevel: number | undefined): number {
  if (reorderLevel === undefined || reorderLevel === 0) return 1;
  return Math.min(1, quantity / (reorderLevel * 3));
}

// ─── Read-only info row ───────────────────────────────────────────────────────

interface InfoRowProps {
  icon:       React.ReactNode;
  label:      string;
  value:      string;
  valueColor?: string;
  isDark:     boolean;
}

const InfoRow: React.FC<InfoRowProps> = React.memo(({ icon, label, value, valueColor, isDark }) => {
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500];
  const valColor   = valueColor ?? (isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[800]);

  return (
    <View style={infoRowStyles.row}>
      <View style={infoRowStyles.iconWrap}>{icon}</View>
      <Text variant="body-sm" style={[infoRowStyles.label, { color: labelColor }]}>{label}</Text>
      <Text variant="body-sm" weight="medium" style={[infoRowStyles.value, { color: valColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
});
InfoRow.displayName = 'InfoRow';

const infoRowStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  iconWrap:{ width: 20, alignItems: 'center', paddingTop: 1 },
  label:   { width: 110, flexShrink: 0 },
  value:   { flex: 1 },
});

// ─── Divider ──────────────────────────────────────────────────────────────────

const InfoDivider: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <View style={[dividerStyles.line, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]} />
);
const dividerStyles = StyleSheet.create({ line: { height: 1, marginVertical: 2 } });

// ─── Section card (glassmorphism) ─────────────────────────────────────────────

interface SectionCardProps {
  children:    React.ReactNode;
  accentColor: string;
  isDark:      boolean;
  style?:      object;
}

const SectionCard: React.FC<SectionCardProps> = ({ children, accentColor, isDark, style }) => (
  <View style={[
    sectionCardStyles.card,
    {
      backgroundColor: isDark ? '#151A27' : '#FFFFFF',
      borderColor:     isDark ? `${accentColor}22` : `${accentColor}20`,
      borderLeftColor: accentColor,
      ...(isDark
        ? { shadowColor: accentColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 3 }
        : staticTheme.shadows.sm
      ),
    },
    style,
  ]}>
    {children}
  </View>
);

const sectionCardStyles = StyleSheet.create({
  card: {
    borderRadius:  staticTheme.borderRadius.xl,
    borderWidth:   1,
    borderLeftWidth: 3,
    overflow: 'hidden',
    padding: staticTheme.spacing.md,
  },
});

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon:        React.ReactNode;
  title:       string;
  accentColor: string;
  isDark:      boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, accentColor, isDark }) => {
  const textColor = isDark ? 'rgba(255,255,255,0.75)' : staticTheme.colors.gray[600];
  return (
    <View style={sectionHeaderStyles.row}>
      <View style={[sectionHeaderStyles.iconPill, { backgroundColor: isDark ? `${accentColor}22` : `${accentColor}18` }]}>
        {icon}
      </View>
      <Text variant="body-sm" weight="semibold" style={{ color: textColor }}>{title}</Text>
    </View>
  );
};

const sectionHeaderStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconPill:{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

// ─── Stock progress bar ───────────────────────────────────────────────────────

interface StockBarProps {
  fill:    number;
  color:   string;
  bgColor: string;
  height?: number;
}

const StockBar: React.FC<StockBarProps> = ({ fill, color, bgColor, height = 6 }) => (
  <View style={[stockBarStyles.track, { backgroundColor: bgColor, height }]}>
    <View style={[stockBarStyles.fill, { width: `${Math.round(fill * 100)}%` as unknown as number, backgroundColor: color }]} />
  </View>
);

const stockBarStyles = StyleSheet.create({
  track: { borderRadius: 4, overflow: 'hidden', flex: 1 },
  fill:  { height: '100%', borderRadius: 4 },
});

// ─── Picker modal ─────────────────────────────────────────────────────────────

interface GenericPickerModalProps<T extends string> {
  visible:   boolean;
  onClose:   () => void;
  title:     string;
  options:   PickerOption<T>[];
  selected:  T | undefined;
  onSelect:  (value: T) => void;
  isDark:    boolean;
}

function GenericPickerModal<T extends string>({ visible, onClose, title, options, selected, onSelect, isDark }: GenericPickerModalProps<T>) {
  const theme   = useAppTheme();
  const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;
  const accent  = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  const dynStyles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: sheetBg,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.xl,
      maxHeight: '72%',
      borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
    },
    handle:        { width: 36, height: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300], borderRadius: 2, alignSelf: 'center', marginTop: staticTheme.spacing.sm, marginBottom: staticTheme.spacing.md },
    sheetTitle:    { color: theme.colors.text, marginBottom: staticTheme.spacing.sm },
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
                style={({ pressed }) => [pickerStyles.option, pressed && dynStyles.optionPressed, selected === opt.value && dynStyles.optionSelected]}
                onPress={() => { onSelect(opt.value); onClose(); }}
              >
                {opt.icon !== undefined && <View style={pickerStyles.optionIcon}>{opt.icon}</View>}
                <View style={pickerStyles.optionText}>
                  <Text variant="body" weight="medium" style={{ color: theme.colors.text }}>{opt.label}</Text>
                  {opt.description !== undefined && <Text variant="body-sm" color="gray">{opt.description}</Text>}
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
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  option:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: staticTheme.spacing.sm, borderRadius: staticTheme.borderRadius.md, gap: staticTheme.spacing.md },
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

const PickerTrigger = React.memo<PickerTriggerProps>(({ label, value, placeholder, onPress, error, accentColor, isDark }) => {
  const theme = useAppTheme();
  const dynStyles = useMemo(() => StyleSheet.create({
    labelText: { color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: staticTheme.spacing.xs },
    trigger: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1,
      borderColor: error !== undefined ? staticTheme.colors.error[500] : isDark ? 'rgba(255,255,255,0.12)' : theme.colors.border,
      borderRadius: staticTheme.borderRadius.md,
      paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : theme.colors.surface,
      minHeight: 48,
    },
    triggerPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.gray[50] },
  }), [theme, isDark, error]);

  return (
    <View style={triggerStyles.wrapper}>
      <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [dynStyles.trigger, pressed && dynStyles.triggerPressed]}>
        <Text variant="body" style={{ color: value !== undefined ? accentColor : (isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder), flex: 1 }}>
          {value ?? placeholder}
        </Text>
        <ChevronDown size={18} color={isDark ? 'rgba(255,255,255,0.30)' : theme.colors.gray[400]} />
      </Pressable>
      {error !== undefined && <Text variant="body-xs" style={triggerStyles.errorText}>{error}</Text>}
    </View>
  );
});
PickerTrigger.displayName = 'PickerTrigger';

const triggerStyles = StyleSheet.create({
  wrapper:   { marginBottom: staticTheme.spacing.md },
  errorText: { color: staticTheme.colors.error[500], marginTop: staticTheme.spacing.xs },
});

// ─── Collapsible edit section ─────────────────────────────────────────────────

interface CollapsibleEditProps {
  expanded:    boolean;
  onToggle:    () => void;
  accentColor: string;
  isDark:      boolean;
  children:    React.ReactNode;
}

const CollapsibleEdit: React.FC<CollapsibleEditProps> = ({ expanded, onToggle, accentColor, isDark, children }) => {
  const labelColor = isDark ? 'rgba(255,255,255,0.80)' : staticTheme.colors.gray[700];
  const bgColor    = isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50];
  const borderCol  = isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200];

  return (
    <View style={[collapsibleStyles.wrapper, { borderColor: borderCol }]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          collapsibleStyles.header,
          { backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100]) : bgColor },
        ]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse edit form' : 'Expand edit form'}
      >
        <View style={[collapsibleStyles.editIconBg, { backgroundColor: isDark ? `${accentColor}22` : `${accentColor}18` }]}>
          <Edit3 size={15} color={accentColor} />
        </View>
        <Text variant="body-sm" weight="semibold" style={{ color: labelColor, flex: 1 }}>Edit Details</Text>
        <ChevronRight
          size={16}
          color={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {expanded && <View style={collapsibleStyles.body}>{children}</View>}
    </View>
  );
};

const collapsibleStyles = StyleSheet.create({
  wrapper:    { borderRadius: staticTheme.borderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: staticTheme.spacing.md, paddingVertical: 14, minHeight: 52 },
  editIconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  body:       { padding: staticTheme.spacing.md, paddingTop: 4 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InventoryItemDetailScreen() {
  const router  = useRouter();
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';
  const { id }  = useLocalSearchParams<{ id: string }>();

  const itemSelector = useCallback(selectItemById(id ?? ''), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const item         = useInventoryStore(itemSelector);
  const { updateItem, deleteItem } = useInventoryStore();

  const [editExpanded,     setEditExpanded]     = useState(false);
  const [categoryVisible,  setCategoryVisible]  = useState(false);
  const [unitVisible,      setUnitVisible]      = useState(false);
  const [conditionVisible, setConditionVisible] = useState(false);

  // Fade animation for the edit section expand
  const [expandAnim] = useState(() => new Animated.Value(0));
  const handleToggleEdit = useCallback(() => {
    setEditExpanded((prev) => {
      Animated.timing(expandAnim, {
        toValue: prev ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return !prev;
    });
  }, [expandAnim]);

  const {
    control, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: item
      ? {
          name: item.name, category: item.category, quantity: item.quantity, unit: item.unit,
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

  const handleCategorySelect  = useCallback((v: InventoryCategory)  => setValue('category',  v, { shouldValidate: true }), [setValue]);
  const handleUnitSelect      = useCallback((v: StockUnit)           => setValue('unit',      v, { shouldValidate: true }), [setValue]);
  const handleConditionSelect = useCallback((v: EquipmentCondition)  => setValue('condition', v, { shouldValidate: true }), [setValue]);

  const onSubmit = useCallback((values: FormValues) => {
    if (!item) return;
    updateItem(item.id, {
      name: values.name, category: values.category, quantity: values.quantity, unit: values.unit,
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
  }, [item, updateItem, router]);

  const handleDelete = useCallback(() => {
    if (!item) return;
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteItem(item.id); router.back(); } },
      ],
    );
  }, [item, deleteItem, router]);

  // ── Derived display values ─────────────────────────────────────────────────

  const categoryLabel  = CATEGORY_OPTIONS.find((o) => o.value === selectedCategory)?.label ?? '';
  const unitLabel      = UNIT_OPTIONS.find((o) => o.value === selectedUnit)?.label ?? '';
  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === selectedCondition)?.label;

  const catConfig   = isDark ? DARK_CAT[item?.category ?? 'product'] : LIGHT_CAT[item?.category ?? 'product'];
  const accentColor = catConfig.accentColor;

  const health   = item ? resolveHealth(item.quantity, item.reorderLevel) : 'healthy';
  const hPal     = healthPalette(health, isDark);
  const fillRatio = item ? stockFillRatio(item.quantity, item.reorderLevel) : 1;

  // Color aliases for edit form pickers
  const editAccent = isDark ? accentColor : (
    selectedCategory === 'product' ? staticTheme.colors.primary[500] :
    selectedCategory === 'ingredient' ? staticTheme.colors.success[500] :
    staticTheme.colors.highlight[400]
  );

  // Dynamic styles dependent on theme
  const dynStyles = useMemo(() => StyleSheet.create({
    safe:   { flex: 1, backgroundColor: theme.colors.background },

    // ── Hero card ─────────────────────────────────────────────────────────────
    heroCard: {
      borderRadius: staticTheme.borderRadius['2xl'],
      borderWidth: 1,
      borderLeftWidth: 4,
      borderColor:     isDark ? `${accentColor}28` : `${accentColor}22`,
      borderLeftColor: accentColor,
      backgroundColor: isDark ? '#151A27' : '#FFFFFF',
      padding: staticTheme.spacing.md,
      gap: staticTheme.spacing.md,
      ...(isDark
        ? { shadowColor: accentColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 }
        : staticTheme.shadows.md
      ),
    },
    heroTopRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: staticTheme.spacing.md },
    heroIconCircle: {
      width: 56, height: 56, borderRadius: 16,
      backgroundColor: catConfig.iconBg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      borderWidth: 1.5,
      borderColor: isDark ? `${accentColor}35` : `${accentColor}30`,
    },
    heroNameBlock:  { flex: 1, gap: 6 },
    heroName:       { color: theme.colors.text },
    heroBadgeRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
    heroCatPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: staticTheme.borderRadius.full,
      backgroundColor: catConfig.iconBg,
      borderWidth: 1,
      borderColor: isDark ? `${accentColor}28` : `${accentColor}22`,
    },
    heroCatLabel: { color: accentColor },
    heroHealthPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: staticTheme.borderRadius.full,
      backgroundColor: hPal.bg,
      borderWidth: 1,
      borderColor: hPal.border,
    },
    heroHealthLabel: { color: hPal.text },

    // Quantity block inside hero
    heroQtyCard: {
      borderRadius: staticTheme.borderRadius.lg,
      borderWidth: 1,
      borderColor: hPal.border,
      backgroundColor: hPal.bg,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      alignSelf: 'flex-start' as const,
      minWidth: 80,
    },
    heroQtyNum:  { color: hPal.text, lineHeight: 32 },
    heroQtyUnit: { color: hPal.text },

    // Stock bar row
    stockBarRow: { gap: 6 },
    stockBarLabel: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    stockBarLabelText: { color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500] },
    stockBarValue:     { color: hPal.text },

    // Description card
    descCard: {
      borderRadius: staticTheme.borderRadius.lg,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50],
      borderWidth: 1,
      borderColor:     isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100],
      padding: staticTheme.spacing.sm,
      gap: 4,
    },
    descLabel: { color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[400] },
    descText:  { color: isDark ? 'rgba(255,255,255,0.80)' : staticTheme.colors.gray[700] },

    // Metadata footer
    metaCard: {
      borderRadius: staticTheme.borderRadius.lg,
      backgroundColor: isDark ? '#0F1420' : staticTheme.colors.gray[50],
      borderWidth: 1,
      borderColor:     isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.borderSubtle,
      padding: staticTheme.spacing.sm,
      gap: 4,
    },
    metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400] },

    // Action buttons row
    actionsRow: { flexDirection: 'row', gap: staticTheme.spacing.sm },
    actionFlex: { flex: 1 },
  }), [theme, isDark, accentColor, catConfig, hPal]);

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!item) {
    return (
      <View style={dynStyles.safe}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <EmptyState
          title="Item Not Found"
          description="This inventory item no longer exists or has been deleted."
          action={{ label: 'Go Back', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const iconColor = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[400];

  return (
    <SafeAreaView style={dynStyles.safe} edges={['bottom', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView style={navStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView contentContainerStyle={scrollStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* VIEW ZONE                                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {/* ── Hero card ────────────────────────────────────────────────── */}
          <View style={dynStyles.heroCard}>

            {/* Top row: icon + name/badges + quantity block */}
            <View style={dynStyles.heroTopRow}>
              {/* Category icon */}
              <View style={dynStyles.heroIconCircle}>
                <catConfig.Icon size={26} color={accentColor} />
              </View>

              {/* Name + badges */}
              <View style={dynStyles.heroNameBlock}>
                <Text variant="h5" weight="bold" style={dynStyles.heroName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={dynStyles.heroBadgeRow}>
                  {/* Category pill */}
                  <View style={dynStyles.heroCatPill}>
                    <catConfig.Icon size={11} color={accentColor} />
                    <Text variant="body-xs" weight="semibold" style={dynStyles.heroCatLabel}>{catConfig.label}</Text>
                  </View>
                  {/* Health pill */}
                  <View style={dynStyles.heroHealthPill}>
                    {health !== 'healthy' && <AlertTriangle size={10} color={hPal.text} />}
                    <Text variant="body-xs" weight="semibold" style={dynStyles.heroHealthLabel}>{hPal.label}</Text>
                  </View>
                </View>
              </View>

              {/* Quantity block */}
              <View style={dynStyles.heroQtyCard}>
                <Text variant="h4" weight="bold" style={dynStyles.heroQtyNum}>{item.quantity}</Text>
                <Text variant="body-xs" weight="medium" style={dynStyles.heroQtyUnit}>{item.unit}</Text>
              </View>
            </View>

            {/* Stock progress bar (only when reorderLevel is set) */}
            {item.reorderLevel !== undefined && (
              <View style={dynStyles.stockBarRow}>
                <View style={dynStyles.stockBarLabel}>
                  <Text variant="body-xs" style={dynStyles.stockBarLabelText}>
                    Stock level
                  </Text>
                  <Text variant="body-xs" weight="semibold" style={dynStyles.stockBarValue}>
                    {item.quantity} / {item.reorderLevel * 3} {item.unit}
                  </Text>
                </View>
                <StockBar fill={fillRatio} color={hPal.bar} bgColor={hPal.barBg} height={8} />
                <Text variant="body-xs" style={dynStyles.stockBarLabelText}>
                  Reorder point: {item.reorderLevel} {item.unit}
                </Text>
              </View>
            )}

            {/* Description */}
            {item.description !== undefined && (
              <View style={dynStyles.descCard}>
                <Text variant="body-xs" weight="medium" style={dynStyles.descLabel}>Description</Text>
                <Text variant="body-sm" style={dynStyles.descText}>{item.description}</Text>
              </View>
            )}
          </View>

          {/* ── Pricing section ─────────────────────────────────────────── */}
          {(item.price !== undefined || item.costPrice !== undefined) && (
            <SectionCard accentColor={accentColor} isDark={isDark}>
              <SectionHeader
                icon={<DollarSign size={14} color={accentColor} />}
                title="Pricing"
                accentColor={accentColor}
                isDark={isDark}
              />
              {item.price !== undefined && (
                <>
                  <InfoRow
                    icon={<Tag size={14} color={iconColor} />}
                    label="Selling Price"
                    value={formatCurrency(item.price)}
                    valueColor={accentColor}
                    isDark={isDark}
                  />
                  {item.costPrice !== undefined && <InfoDivider isDark={isDark} />}
                </>
              )}
              {item.costPrice !== undefined && (
                <>
                  <InfoRow
                    icon={<DollarSign size={14} color={iconColor} />}
                    label="Cost Price"
                    value={formatCurrency(item.costPrice)}
                    isDark={isDark}
                  />
                  {item.price !== undefined && item.costPrice !== undefined && (
                    <>
                      <InfoDivider isDark={isDark} />
                      <InfoRow
                        icon={<BarChart2 size={14} color={iconColor} />}
                        label="Gross Margin"
                        value={`${(((item.price - item.costPrice) / item.price) * 100).toFixed(1)}%  (${formatCurrency(item.price - item.costPrice)} / unit)`}
                        valueColor={
                          item.price > item.costPrice
                            ? (isDark ? '#3DD68C' : staticTheme.colors.success[600])
                            : (isDark ? '#FF6B6B' : staticTheme.colors.error[500])
                        }
                        isDark={isDark}
                      />
                    </>
                  )}
                </>
              )}
            </SectionCard>
          )}

          {/* ── Stock info section ──────────────────────────────────────── */}
          <SectionCard accentColor={accentColor} isDark={isDark}>
            <SectionHeader
              icon={<Layers size={14} color={accentColor} />}
              title="Stock Information"
              accentColor={accentColor}
              isDark={isDark}
            />
            <InfoRow
              icon={<Layers size={14} color={iconColor} />}
              label="Quantity"
              value={`${item.quantity} ${item.unit}`}
              valueColor={hPal.text}
              isDark={isDark}
            />
            <InfoDivider isDark={isDark} />
            <InfoRow
              icon={<Tag size={14} color={iconColor} />}
              label="Unit"
              value={unitLabel}
              isDark={isDark}
            />
            {item.reorderLevel !== undefined && (
              <>
                <InfoDivider isDark={isDark} />
                <InfoRow
                  icon={<AlertTriangle size={14} color={iconColor} />}
                  label="Reorder Level"
                  value={`${item.reorderLevel} ${item.unit}`}
                  isDark={isDark}
                />
              </>
            )}
            {item.sku !== undefined && (
              <>
                <InfoDivider isDark={isDark} />
                <InfoRow
                  icon={<Hash size={14} color={iconColor} />}
                  label="SKU / Barcode"
                  value={item.sku}
                  isDark={isDark}
                />
              </>
            )}
          </SectionCard>

          {/* ── Equipment section ───────────────────────────────────────── */}
          {item.category === 'equipment' && (item.serialNumber !== undefined || item.condition !== undefined || item.purchaseDate !== undefined) && (
            <SectionCard accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} isDark={isDark}>
              <SectionHeader
                icon={<ShieldCheck size={14} color={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} />}
                title="Equipment Details"
                accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]}
                isDark={isDark}
              />
              {item.serialNumber !== undefined && (
                <>
                  <InfoRow
                    icon={<Hash size={14} color={iconColor} />}
                    label="Serial / Asset #"
                    value={item.serialNumber}
                    isDark={isDark}
                  />
                  {(item.condition !== undefined || item.purchaseDate !== undefined) && <InfoDivider isDark={isDark} />}
                </>
              )}
              {item.condition !== undefined && (
                <>
                  <InfoRow
                    icon={<ShieldCheck size={14} color={iconColor} />}
                    label="Condition"
                    value={item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                    valueColor={
                      item.condition === 'good'
                        ? (isDark ? '#3DD68C' : staticTheme.colors.success[600])
                        : item.condition === 'fair'
                          ? (isDark ? '#FFB020' : staticTheme.colors.warning[600])
                          : (isDark ? '#FF6B6B' : staticTheme.colors.error[500])
                    }
                    isDark={isDark}
                  />
                  {item.purchaseDate !== undefined && <InfoDivider isDark={isDark} />}
                </>
              )}
              {item.purchaseDate !== undefined && (
                <InfoRow
                  icon={<CalendarDays size={14} color={iconColor} />}
                  label="Purchase Date"
                  value={formatDate(item.purchaseDate)}
                  isDark={isDark}
                />
              )}
            </SectionCard>
          )}

          {/* ── Metadata ────────────────────────────────────────────────── */}
          <View style={dynStyles.metaCard}>
            <View style={dynStyles.metaRow}>
              <Clock size={11} color={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[300]} />
              <Text variant="body-xs" style={dynStyles.metaText}>
                ID: {item.id}
              </Text>
            </View>
            <View style={dynStyles.metaRow}>
              <Clock size={11} color={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[300]} />
              <Text variant="body-xs" style={dynStyles.metaText}>
                Created: {formatDate(item.createdAt)}
              </Text>
            </View>
            <View style={dynStyles.metaRow}>
              <Clock size={11} color={isDark ? 'rgba(255,255,255,0.28)' : staticTheme.colors.gray[300]} />
              <Text variant="body-xs" style={dynStyles.metaText}>
                Last Updated: {formatDate(item.updatedAt)}
              </Text>
            </View>
          </View>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* EDIT ZONE                                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          <CollapsibleEdit
            expanded={editExpanded}
            onToggle={handleToggleEdit}
            accentColor={accentColor}
            isDark={isDark}
          >
            {/* Basic Info */}
            <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} style={editFormStyles.innerCard}>
              <SectionHeader
                icon={<Info size={14} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} />}
                title="Basic Information"
                accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]}
                isDark={isDark}
              />
              <FormField name="name" control={control} label="Item Name *" placeholder="e.g. Arabica Coffee Beans" autoCapitalize="words" autoCorrect={false} />
              <PickerTrigger label="Category *" value={categoryLabel} placeholder="Select category" onPress={() => setCategoryVisible(true)} accentColor={editAccent} isDark={isDark}
                {...(errors.category ? { error: errors.category.message } : {})} />
              <View style={rowStyles.row}>
                <View style={rowStyles.half}>
                  <FormField name="quantity" control={control} label="Quantity *" placeholder="0" keyboardType="decimal-pad" />
                </View>
                <View style={rowStyles.half}>
                  <PickerTrigger label="Unit *" value={unitLabel} placeholder="Select unit" onPress={() => setUnitVisible(true)} accentColor={editAccent} isDark={isDark}
                    {...(errors.unit ? { error: errors.unit.message } : {})} />
                </View>
              </View>
              <FormField name="costPrice" control={control} label="Cost Price (₱)" placeholder="0.00" keyboardType="decimal-pad" helperText="Purchase or production cost" />
              <FormField name="description" control={control} label="Description" placeholder="Optional notes..." multiline numberOfLines={3} autoCapitalize="sentences" />
            </SectionCard>

            {/* Product-specific */}
            {selectedCategory === 'product' && (
              <SectionCard accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} isDark={isDark} style={editFormStyles.innerCard}>
                <SectionHeader
                  icon={<Package size={14} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} />}
                  title="Product Details"
                  accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]}
                  isDark={isDark}
                />
                <FormField name="price" control={control} label="Selling Price (₱)" placeholder="0.00" keyboardType="decimal-pad" />
                <FormField name="sku" control={control} label="SKU / Barcode" placeholder="e.g. SKU-001" autoCapitalize="characters" autoCorrect={false} />
              </SectionCard>
            )}

            {/* Ingredient-specific */}
            {selectedCategory === 'ingredient' && (
              <SectionCard accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]} isDark={isDark} style={editFormStyles.innerCard}>
                <SectionHeader
                  icon={<Wheat size={14} color={isDark ? '#3DD68C' : staticTheme.colors.success[500]} />}
                  title="Ingredient Details"
                  accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]}
                  isDark={isDark}
                />
                <FormField name="reorderLevel" control={control} label="Reorder Level" placeholder="e.g. 10" keyboardType="decimal-pad" helperText="Alert fires when quantity drops to or below this value" />
              </SectionCard>
            )}

            {/* Equipment-specific */}
            {selectedCategory === 'equipment' && (
              <SectionCard accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} isDark={isDark} style={editFormStyles.innerCard}>
                <SectionHeader
                  icon={<Wrench size={14} color={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} />}
                  title="Equipment Details"
                  accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]}
                  isDark={isDark}
                />
                <FormField name="serialNumber" control={control} label="Serial / Asset Number" placeholder="e.g. SN-2024-001" autoCapitalize="characters" autoCorrect={false} />
                <PickerTrigger label="Condition" value={conditionLabel} placeholder="Select condition" onPress={() => setConditionVisible(true)} accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]} isDark={isDark} />
                <FormField name="purchaseDate" control={control} label="Purchase Date" placeholder="YYYY-MM-DD" keyboardType="numeric" helperText="Format: YYYY-MM-DD" />
              </SectionCard>
            )}

            {/* Save button */}
            <Button
              title={isSubmitting ? 'Saving...' : isDirty ? 'Save Changes' : 'No Changes'}
              onPress={handleSubmit(onSubmit)}
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={!isDirty}
              fullWidth
              style={editFormStyles.saveBtn}
            />
          </CollapsibleEdit>

          {/* ── Standalone delete ────────────────────────────────────────── */}
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              deleteStyles.btn,
              {
                backgroundColor: isDark
                  ? (pressed ? 'rgba(255,107,107,0.18)' : 'rgba(255,107,107,0.10)')
                  : (pressed ? staticTheme.colors.error[100] : staticTheme.colors.error[50]),
                borderColor: isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete this item"
          >
            <Trash2 size={16} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
            <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[500] }}>
              Delete Item
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <GenericPickerModal visible={categoryVisible} onClose={() => setCategoryVisible(false)} title="Select Category" options={CATEGORY_OPTIONS} selected={selectedCategory} onSelect={handleCategorySelect} isDark={isDark} />
      <GenericPickerModal visible={unitVisible}     onClose={() => setUnitVisible(false)}     title="Select Unit"     options={UNIT_OPTIONS}     selected={selectedUnit}      onSelect={handleUnitSelect}     isDark={isDark} />
      <GenericPickerModal visible={conditionVisible} onClose={() => setConditionVisible(false)} title="Select Condition" options={CONDITION_OPTIONS} selected={selectedCondition} onSelect={handleConditionSelect} isDark={isDark} />
    </SafeAreaView>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const navStyles = StyleSheet.create({
  flex: { flex: 1 },
});

const scrollStyles = StyleSheet.create({
  content: { padding: staticTheme.spacing.md, gap: staticTheme.spacing.sm, paddingBottom: staticTheme.spacing.xl },
});

const rowStyles = StyleSheet.create({
  row:  { flexDirection: 'row', gap: staticTheme.spacing.sm },
  half: { flex: 1 },
});

const editFormStyles = StyleSheet.create({
  innerCard: { marginBottom: staticTheme.spacing.sm },
  saveBtn:   { marginTop: staticTheme.spacing.xs },
});

const deleteStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: staticTheme.spacing.sm,
    paddingVertical: 14, borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1, marginTop: 4,
  },
});
