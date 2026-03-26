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
  TextInput,
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
  PlusCircle,
  MinusCircle,
} from 'lucide-react-native';
import { FormField } from '@/components/molecules/FormField';
import { DatePickerFormField } from '@/components/molecules/DatePickerField';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { useInventoryStore, selectItemById, useThemeStore, selectThemeMode, initializeInventory, initializeRawMaterials } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryCategory, EquipmentCondition, StockUnit, StockReductionReason } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProductIngredients, consumeIngredients } from '../../../../../database/repositories/product_ingredients.repository';
import { createProductionLog } from '../../../../../database/repositories/production_logs.repository';
import { getRawMaterialsByProduct } from '../../../../../database/repositories/raw_materials.repository';

// ─── Validation schema ────────────────────────────────────────────────────────
// `quantity` is intentionally excluded — stock levels are managed exclusively
// via Add Stock (production) and Reduce Stock actions, never by direct edit.

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

const REDUCTION_REASON_OPTIONS: PickerOption<StockReductionReason>[] = [
  { value: 'correction', label: 'Correction',      description: 'Reversing a previous over-entry — returns ingredients to inventory' },
  { value: 'waste',      label: 'Waste / Spoilage', description: 'Spoiled or disposed product — no return to inventory' },
  { value: 'damage',     label: 'Damage',          description: 'Units physically damaged — no return to inventory' },
  { value: 'expiry',     label: 'Expiry',          description: 'Units passed their expiry date — no return to inventory' },
  { value: 'other',      label: 'Other',           description: 'Add a note to explain — no return to inventory' },
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
  const { updateItem, deleteItem, reduceStock, addIngredientStock, reduceIngredientStock } = useInventoryStore();

  const [editExpanded,     setEditExpanded]     = useState(false);
  const [categoryVisible,  setCategoryVisible]  = useState(false);
  const [unitVisible,      setUnitVisible]      = useState(false);
  const [conditionVisible, setConditionVisible] = useState(false);

  // ── Add Stock modal state ──────────────────────────────────────────────────
  const [addStockVisible, setAddStockVisible] = useState(false);
  const [addStockQty,     setAddStockQty]     = useState('');
  const [addStockLoading, setAddStockLoading] = useState(false);

  // ── Reduce Stock modal state (products) ───────────────────────────────────
  const [reduceStockVisible,       setReduceStockVisible]       = useState(false);
  const [reduceStockQty,           setReduceStockQty]           = useState('');
  const [reduceStockNotes,         setReduceStockNotes]         = useState('');
  const [reduceStockReason,        setReduceStockReason]        = useState<StockReductionReason>('correction');
  const [reduceStockReasonVisible, setReduceStockReasonVisible] = useState(false);
  const [reduceStockLoading,       setReduceStockLoading]       = useState(false);

  // ── Ingredient Add Stock modal state ──────────────────────────────────────
  const [ingAddStockVisible, setIngAddStockVisible] = useState(false);
  const [ingAddStockQty,     setIngAddStockQty]     = useState('');
  const [ingAddStockNotes,   setIngAddStockNotes]   = useState('');
  const [ingAddStockLoading, setIngAddStockLoading] = useState(false);

  // ── Ingredient Reduce Stock modal state ───────────────────────────────────
  const [ingReduceVisible,       setIngReduceVisible]       = useState(false);
  const [ingReduceQty,           setIngReduceQty]           = useState('');
  const [ingReduceNotes,         setIngReduceNotes]         = useState('');
  const [ingReduceReason,        setIngReduceReason]        = useState<StockReductionReason>('correction');
  const [ingReduceReasonVisible, setIngReduceReasonVisible] = useState(false);
  const [ingReduceLoading,       setIngReduceLoading]       = useState(false);

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
          name: item.name, category: item.category, unit: item.unit,
          ...(item.costPrice    !== undefined ? { costPrice:    item.costPrice }    : {}),
          ...(item.description  !== undefined ? { description:  item.description }  : {}),
          ...(item.price        !== undefined ? { price:        item.price }        : {}),
          ...(item.sku          !== undefined ? { sku:          item.sku }          : {}),
          ...(item.reorderLevel !== undefined ? { reorderLevel: item.reorderLevel } : {}),
          ...(item.serialNumber !== undefined ? { serialNumber: item.serialNumber } : {}),
          ...(item.condition    !== undefined ? { condition:    item.condition }    : {}),
          ...(item.purchaseDate !== undefined ? { purchaseDate: item.purchaseDate } : {}),
        }
      : { category: 'product', unit: 'pcs' },
  });

  const selectedCategory  = watch('category');
  const selectedUnit      = watch('unit');
  const selectedCondition = watch('condition');

  const handleCategorySelect  = useCallback((v: InventoryCategory)  => setValue('category',  v, { shouldValidate: true }), [setValue]);
  const handleUnitSelect      = useCallback((v: StockUnit)           => setValue('unit',      v, { shouldValidate: true }), [setValue]);
  const handleConditionSelect = useCallback((v: EquipmentCondition)  => setValue('condition', v, { shouldValidate: true }), [setValue]);

  const onSubmit = useCallback((values: FormValues) => {
    if (!item) return;
    // quantity is intentionally excluded — use Add Stock / Reduce Stock actions
    updateItem(item.id, {
      name: values.name, category: values.category, unit: values.unit,
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

  const handleAddStock = useCallback(async () => {
    const qty = parseInt(addStockQty, 10);
    if (!item || isNaN(qty) || qty <= 0) return;
    setAddStockLoading(true);
    try {
      // Deduct ingredients and get the consumed amounts for the production log
      const consumed = await consumeIngredients(item.id, qty);

      // Build ingredient line items for the production log header
      // We need cost data — fetch the linked ingredient details to get costPrice
      const linkedIngredients = await getProductIngredients(item.id);
      const costMap = new Map<string, number>();
      for (const ing of linkedIngredients) {
        costMap.set(ing.ingredientId, ing.ingredientCostPrice ?? 0);
      }

      const ingredientInputs = consumed.map((c) => {
        const costPrice = costMap.get(c.ingredientId) ?? 0;
        return {
          ingredientId:     c.ingredientId,
          quantityConsumed: c.deducted,
          unit:             linkedIngredients.find((i) => i.ingredientId === c.ingredientId)?.stockUnit ?? '',
          lineCost:         c.deducted * costPrice,
          ...(costPrice > 0 ? { costPrice } : {}),
        };
      });

      const totalCost = ingredientInputs.reduce((sum, i) => sum + i.lineCost, 0);

      // createProductionLog also deducts raw materials atomically inside one transaction
      await createProductionLog(
        item.id,
        qty,
        totalCost,
        ingredientInputs,
        undefined,
        item.name,
      );

      // Increment the product's stock quantity
      await updateItem(item.id, { quantity: item.quantity + qty });

      // Re-hydrate stores so all screens see updated quantities and raw material levels
      await initializeInventory();
      await initializeRawMaterials();

      setAddStockVisible(false);
      setAddStockQty('');
    } catch (err) {
      console.error('[AddStock] failed:', err);
      Alert.alert('Error', 'Failed to add stock. Please try again.');
    } finally {
      setAddStockLoading(false);
    }
  }, [item, addStockQty, updateItem]);

  const handleReduceStock = useCallback(async () => {
    const qty = parseInt(reduceStockQty, 10);
    if (!item || isNaN(qty) || qty <= 0) return;

    if (qty > item.quantity) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot reduce ${qty} ${item.unit} — only ${item.quantity} ${item.unit} available.`,
      );
      return;
    }

    setReduceStockLoading(true);
    try {
      // Fetch linked ingredient links (with stock unit + cost data)
      const linkedIngredients = await getProductIngredients(item.id);
      const ingredientReturns = linkedIngredients.map((ing) => ({
        ingredientId:   ing.ingredientId,
        // Return proportionally: qty × convertedQuantity per unit
        amountToReturn: ing.convertedQuantity * qty,
        stockUnit:      ing.stockUnit,
        costPrice:      ing.ingredientCostPrice ?? 0,
        ingredientName: ing.ingredientName,
      }));

      // Fetch linked raw materials
      const linkedRawMaterials = await getRawMaterialsByProduct(item.id);
      const rawMaterialReturns = linkedRawMaterials.map((rm) => ({
        rawMaterialId:  rm.rawMaterialId,
        amountToReturn: rm.quantityRequired * qty,
        unit:           rm.unit,
        costPerUnit:    rm.rawMaterial?.costPerUnit ?? 0,
      }));

      const notes = reduceStockNotes.trim().length > 0
        ? reduceStockNotes.trim()
        : `Stock reduction: ${qty} ${item.unit} of ${item.name}`;

      await reduceStock(
        item.id,
        item.name,
        qty,
        reduceStockReason,
        ingredientReturns,
        rawMaterialReturns,
        notes,
      );

      // Re-hydrate stores so all screens see updated quantities
      await initializeInventory();
      await initializeRawMaterials();

      setReduceStockVisible(false);
      setReduceStockQty('');
      setReduceStockNotes('');
      setReduceStockReason('correction');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reduce stock. Please try again.';
      console.error('[ReduceStock] failed:', err);
      Alert.alert('Error', message);
    } finally {
      setReduceStockLoading(false);
    }
  }, [item, reduceStockQty, reduceStockNotes, reduceStockReason, reduceStock]);

  const handleIngAddStock = useCallback(async () => {
    const qty = parseFloat(ingAddStockQty);
    if (!item || isNaN(qty) || qty <= 0) return;
    setIngAddStockLoading(true);
    try {
      await addIngredientStock(
        item.id,
        qty,
        ...(ingAddStockNotes.trim().length > 0 ? [ingAddStockNotes.trim()] : []),
      );
      setIngAddStockVisible(false);
      setIngAddStockQty('');
      setIngAddStockNotes('');
    } catch (err) {
      console.error('[IngAddStock] failed:', err);
      Alert.alert('Error', 'Failed to add ingredient stock. Please try again.');
    } finally {
      setIngAddStockLoading(false);
    }
  }, [item, ingAddStockQty, ingAddStockNotes, addIngredientStock]);

  const handleIngReduceStock = useCallback(async () => {
    const qty = parseFloat(ingReduceQty);
    if (!item || isNaN(qty) || qty <= 0) return;

    if (qty > item.quantity) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot reduce ${qty} ${item.unit} — only ${item.quantity} ${item.unit} available.`,
      );
      return;
    }

    setIngReduceLoading(true);
    try {
      await reduceIngredientStock(
        item.id,
        item.name,
        qty,
        ingReduceReason,
        ...(ingReduceNotes.trim().length > 0 ? [ingReduceNotes.trim()] : []),
      );
      setIngReduceVisible(false);
      setIngReduceQty('');
      setIngReduceNotes('');
      setIngReduceReason('correction');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reduce ingredient stock. Please try again.';
      console.error('[IngReduceStock] failed:', err);
      Alert.alert('Error', message);
    } finally {
      setIngReduceLoading(false);
    }
  }, [item, ingReduceQty, ingReduceNotes, ingReduceReason, reduceIngredientStock]);

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

            {/* Stock action buttons — ingredients */}
            {item.category === 'ingredient' && (
              <View style={addStockStyles.btnRow}>
                {/* Add Stock */}
                <Pressable
                  onPress={() => setIngAddStockVisible(true)}
                  style={({ pressed }) => [
                    addStockStyles.btn,
                    addStockStyles.btnFlex,
                    {
                      backgroundColor: pressed
                        ? (isDark ? 'rgba(61,214,140,0.22)' : staticTheme.colors.success[100])
                        : (isDark ? 'rgba(61,214,140,0.12)' : staticTheme.colors.success[50]),
                      borderColor: isDark ? 'rgba(61,214,140,0.35)' : staticTheme.colors.success[200],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add stock to this ingredient"
                >
                  <PlusCircle size={16} color={isDark ? '#3DD68C' : staticTheme.colors.success[600]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#3DD68C' : staticTheme.colors.success[700] }}>
                    Add Stock
                  </Text>
                </Pressable>

                {/* Reduce Stock */}
                <Pressable
                  onPress={() => setIngReduceVisible(true)}
                  style={({ pressed }) => [
                    addStockStyles.btn,
                    addStockStyles.btnFlex,
                    {
                      backgroundColor: pressed
                        ? (isDark ? 'rgba(255,107,107,0.22)' : staticTheme.colors.error[100])
                        : (isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50]),
                      borderColor: isDark ? 'rgba(255,107,107,0.35)' : staticTheme.colors.error[200],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Reduce stock — record wastage, damage, or correction"
                >
                  <MinusCircle size={16} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[600] }}>
                    Reduce Stock
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Stock action buttons — products only */}
            {item.category === 'product' && (
              <View style={addStockStyles.btnRow}>
                {/* Add Stock */}
                <Pressable
                  onPress={() => setAddStockVisible(true)}
                  style={({ pressed }) => [
                    addStockStyles.btn,
                    addStockStyles.btnFlex,
                    {
                      backgroundColor: pressed
                        ? (isDark ? 'rgba(79,158,255,0.22)' : staticTheme.colors.primary[100])
                        : (isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50]),
                      borderColor: isDark ? 'rgba(79,158,255,0.35)' : staticTheme.colors.primary[200],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add stock by producing this product"
                >
                  <PlusCircle size={16} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#4F9EFF' : staticTheme.colors.primary[600] }}>
                    Add Stock
                  </Text>
                </Pressable>

                {/* Reduce Stock */}
                <Pressable
                  onPress={() => setReduceStockVisible(true)}
                  style={({ pressed }) => [
                    addStockStyles.btn,
                    addStockStyles.btnFlex,
                    {
                      backgroundColor: pressed
                        ? (isDark ? 'rgba(255,107,107,0.22)' : staticTheme.colors.error[100])
                        : (isDark ? 'rgba(255,107,107,0.10)' : staticTheme.colors.error[50]),
                      borderColor: isDark ? 'rgba(255,107,107,0.35)' : staticTheme.colors.error[200],
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Reduce stock — returns ingredients and raw materials proportionally"
                >
                  <MinusCircle size={16} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
                  <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[600] }}>
                    Reduce Stock
                  </Text>
                </Pressable>
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
              {/* Quantity — read-only. Use Add Stock / Reduce Stock buttons above. */}
              <View style={rowStyles.row}>
                <View style={rowStyles.half}>
                  <Text variant="body-xs" weight="medium" style={readOnlyQtyStyles.label}>
                    Current Quantity
                  </Text>
                  <View style={[
                    readOnlyQtyStyles.pill,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[100],
                      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
                    },
                  ]}>
                    <BarChart2 size={14} color={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]} />
                    <Text variant="body-sm" weight="semibold" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : staticTheme.colors.gray[700] }}>
                      {item.quantity}
                    </Text>
                    <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[500] }}>
                      (read-only)
                    </Text>
                  </View>
                  <Text variant="body-xs" style={[readOnlyQtyStyles.hint, { color: isDark ? 'rgba(255,255,255,0.32)' : staticTheme.colors.gray[400] }]}>
                    Use Add / Reduce Stock buttons
                  </Text>
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
                <DatePickerFormField name="purchaseDate" control={control} label="Purchase Date" maximumDate={new Date()} accessibilityLabel="Purchase date" />
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

      {/* ── Add Stock Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={addStockVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setAddStockVisible(false); setAddStockQty(''); }}
      >
        <Pressable
          style={addStockModalStyles.overlay}
          onPress={() => { setAddStockVisible(false); setAddStockQty(''); }}
        >
          <Pressable
            style={[
              addStockModalStyles.box,
              {
                backgroundColor: isDark ? '#1A1F2E' : theme.colors.surface,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : theme.colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <View style={addStockModalStyles.headerRow}>
              <View style={[addStockModalStyles.iconPill, { backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : staticTheme.colors.primary[50] }]}>
                <PlusCircle size={18} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]} />
              </View>
              <View style={addStockModalStyles.headerText}>
                <Text variant="body" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                  Add Stock
                </Text>
                <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : theme.colors.textSecondary }}>
                  {item.name}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : theme.colors.textSecondary, marginBottom: 16 }}>
              Enter the quantity to produce. Linked ingredients and raw materials will be deducted automatically.
            </Text>

            {/* Quantity input */}
            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Quantity to Produce
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                },
              ]}
              value={addStockQty}
              onChangeText={setAddStockQty}
              keyboardType="numeric"
              placeholder="e.g. 10"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="done"
              autoFocus
            />

            {/* Action buttons */}
            <View style={addStockModalStyles.btnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => { setAddStockVisible(false); setAddStockQty(''); }}
                style={addStockModalStyles.btnFlex}
              />
              <Button
                title={addStockLoading ? 'Saving...' : 'Confirm'}
                variant="primary"
                onPress={handleAddStock}
                loading={addStockLoading}
                disabled={addStockLoading || addStockQty.trim() === ''}
                style={addStockModalStyles.btnFlex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Reduce Stock Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={reduceStockVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setReduceStockVisible(false); setReduceStockQty(''); setReduceStockNotes(''); setReduceStockReason('correction'); }}
      >
        <Pressable
          style={addStockModalStyles.overlay}
          onPress={() => { setReduceStockVisible(false); setReduceStockQty(''); setReduceStockNotes(''); setReduceStockReason('correction'); }}
        >
          <Pressable
            style={[
              addStockModalStyles.box,
              {
                backgroundColor: isDark ? '#1A1F2E' : theme.colors.surface,
                borderColor: isDark ? 'rgba(255,107,107,0.20)' : staticTheme.colors.error[200],
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <View style={addStockModalStyles.headerRow}>
              <View style={[addStockModalStyles.iconPill, { backgroundColor: isDark ? 'rgba(255,107,107,0.15)' : staticTheme.colors.error[50] }]}>
                <MinusCircle size={18} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
              </View>
              <View style={addStockModalStyles.headerText}>
                <Text variant="body" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                  Reduce Stock
                </Text>
                <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : theme.colors.textSecondary }}>
                  {item.name} — {item.quantity} {item.unit} available
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : theme.colors.textSecondary, marginBottom: 16 }}>
              Select a reason. Correction returns linked ingredients to inventory. Damage, Waste, Expiry, and Other write audit logs only — no stock is returned.
            </Text>

            {/* Quantity input */}
            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Quantity to Remove
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                },
              ]}
              value={reduceStockQty}
              onChangeText={setReduceStockQty}
              keyboardType="numeric"
              placeholder="e.g. 5"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="next"
              autoFocus
            />

            {/* Reason picker */}
            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Reason *
            </Text>
            <Pressable
              onPress={() => setReduceStockReasonVisible(true)}
              style={({ pressed }) => [
                ingReduceStyles.reasonTrigger,
                {
                  borderColor: isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
                  backgroundColor: pressed
                    ? (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[50])
                    : (isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background),
                  marginBottom: 12,
                },
              ]}
            >
              <Text variant="body-sm" style={{ flex: 1, color: isDark ? 'rgba(255,255,255,0.85)' : theme.colors.text, textTransform: 'capitalize' }}>
                {REDUCTION_REASON_OPTIONS.find((o) => o.value === reduceStockReason)?.label ?? reduceStockReason}
              </Text>
              <ChevronDown size={16} color={isDark ? 'rgba(255,255,255,0.35)' : theme.colors.gray[400]} />
            </Pressable>

            {/* Notes input */}
            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                  fontSize: 14,
                  minHeight: 44,
                  fontWeight: 'normal',
                },
              ]}
              value={reduceStockNotes}
              onChangeText={setReduceStockNotes}
              placeholder="e.g. Damaged batch, expired stock..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="done"
              multiline
            />

            {/* Action buttons */}
            <View style={addStockModalStyles.btnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => { setReduceStockVisible(false); setReduceStockQty(''); setReduceStockNotes(''); setReduceStockReason('correction'); }}
                style={addStockModalStyles.btnFlex}
              />
              <Button
                title={reduceStockLoading ? 'Saving...' : 'Confirm'}
                variant="primary"
                onPress={handleReduceStock}
                loading={reduceStockLoading}
                disabled={reduceStockLoading || reduceStockQty.trim() === ''}
                style={addStockModalStyles.btnFlex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ingredient Add Stock Modal ───────────────────────────────────────── */}
      <Modal
        visible={ingAddStockVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setIngAddStockVisible(false); setIngAddStockQty(''); setIngAddStockNotes(''); }}
      >
        <Pressable
          style={addStockModalStyles.overlay}
          onPress={() => { setIngAddStockVisible(false); setIngAddStockQty(''); setIngAddStockNotes(''); }}
        >
          <Pressable
            style={[
              addStockModalStyles.box,
              {
                backgroundColor: isDark ? '#1A1F2E' : theme.colors.surface,
                borderColor: isDark ? 'rgba(61,214,140,0.20)' : staticTheme.colors.success[200],
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <View style={addStockModalStyles.headerRow}>
              <View style={[addStockModalStyles.iconPill, { backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : staticTheme.colors.success[50] }]}>
                <PlusCircle size={18} color={isDark ? '#3DD68C' : staticTheme.colors.success[600]} />
              </View>
              <View style={addStockModalStyles.headerText}>
                <Text variant="body" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                  Add Ingredient Stock
                </Text>
                <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : theme.colors.textSecondary }}>
                  {item?.name}
                </Text>
              </View>
            </View>

            <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : theme.colors.textSecondary, marginBottom: 16 }}>
              Enter the quantity to add back into stock. A RETURN entry will be recorded in the ingredient audit log.
            </Text>

            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Quantity to Add ({item?.unit})
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(61,214,140,0.30)' : staticTheme.colors.success[200],
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                },
              ]}
              value={ingAddStockQty}
              onChangeText={setIngAddStockQty}
              keyboardType="decimal-pad"
              placeholder="e.g. 5.0"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="next"
              autoFocus
            />

            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Notes (optional)
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                  fontSize: 14,
                  minHeight: 44,
                  fontWeight: 'normal',
                },
              ]}
              value={ingAddStockNotes}
              onChangeText={setIngAddStockNotes}
              placeholder="e.g. Restocked from supplier delivery..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="done"
              multiline
            />

            <View style={addStockModalStyles.btnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => { setIngAddStockVisible(false); setIngAddStockQty(''); setIngAddStockNotes(''); }}
                style={addStockModalStyles.btnFlex}
              />
              <Button
                title={ingAddStockLoading ? 'Saving...' : 'Confirm'}
                variant="primary"
                onPress={handleIngAddStock}
                loading={ingAddStockLoading}
                disabled={ingAddStockLoading || ingAddStockQty.trim() === ''}
                style={addStockModalStyles.btnFlex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ingredient Reduce Stock Modal ────────────────────────────────────── */}
      <Modal
        visible={ingReduceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setIngReduceVisible(false); setIngReduceQty(''); setIngReduceNotes(''); setIngReduceReason('correction'); }}
      >
        <Pressable
          style={addStockModalStyles.overlay}
          onPress={() => { setIngReduceVisible(false); setIngReduceQty(''); setIngReduceNotes(''); setIngReduceReason('correction'); }}
        >
          <Pressable
            style={[
              addStockModalStyles.box,
              {
                backgroundColor: isDark ? '#1A1F2E' : theme.colors.surface,
                borderColor: isDark ? 'rgba(255,107,107,0.20)' : staticTheme.colors.error[200],
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <View style={addStockModalStyles.headerRow}>
              <View style={[addStockModalStyles.iconPill, { backgroundColor: isDark ? 'rgba(255,107,107,0.15)' : staticTheme.colors.error[50] }]}>
                <MinusCircle size={18} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
              </View>
              <View style={addStockModalStyles.headerText}>
                <Text variant="body" weight="bold" style={{ color: isDark ? '#FFFFFF' : theme.colors.text }}>
                  Reduce Ingredient Stock
                </Text>
                <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.50)' : theme.colors.textSecondary }}>
                  {item?.name} — {item?.quantity} {item?.unit} available
                </Text>
              </View>
            </View>

            <Text variant="body-sm" style={{ color: isDark ? 'rgba(255,255,255,0.60)' : theme.colors.textSecondary, marginBottom: 16 }}>
              Enter the quantity to remove and select a reason. A MANUAL_ADJUSTMENT entry will be written to the ingredient audit log.
            </Text>

            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Quantity to Remove ({item?.unit})
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                },
              ]}
              value={ingReduceQty}
              onChangeText={setIngReduceQty}
              keyboardType="decimal-pad"
              placeholder="e.g. 2.5"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="next"
              autoFocus
            />

            {/* Reason picker trigger */}
            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Reason *
            </Text>
            <Pressable
              onPress={() => setIngReduceReasonVisible(true)}
              style={({ pressed }) => [
                ingReduceStyles.reasonTrigger,
                {
                  borderColor: isDark ? 'rgba(255,107,107,0.30)' : staticTheme.colors.error[200],
                  backgroundColor: pressed
                    ? (isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[50])
                    : (isDark ? 'rgba(255,255,255,0.04)' : theme.colors.background),
                },
              ]}
            >
              <Text variant="body-sm" style={{ flex: 1, color: isDark ? 'rgba(255,255,255,0.85)' : theme.colors.text, textTransform: 'capitalize' }}>
                {ingReduceReason}
              </Text>
              <ChevronDown size={16} color={isDark ? 'rgba(255,255,255,0.35)' : theme.colors.gray[400]} />
            </Pressable>

            <Text variant="body-sm" weight="medium" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700], marginBottom: 6 }}>
              Notes (optional — required when reason is "other")
            </Text>
            <TextInput
              style={[
                addStockModalStyles.qtyInput,
                {
                  color: isDark ? '#FFFFFF' : theme.colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : theme.colors.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.background,
                  fontSize: 14,
                  minHeight: 44,
                  fontWeight: 'normal',
                },
              ]}
              value={ingReduceNotes}
              onChangeText={setIngReduceNotes}
              placeholder="e.g. Spilled bag, contaminated batch..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : theme.colors.placeholder}
              returnKeyType="done"
              multiline
            />

            <View style={addStockModalStyles.btnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => { setIngReduceVisible(false); setIngReduceQty(''); setIngReduceNotes(''); setIngReduceReason('correction'); }}
                style={addStockModalStyles.btnFlex}
              />
              <Button
                title={ingReduceLoading ? 'Saving...' : 'Confirm'}
                variant="primary"
                onPress={handleIngReduceStock}
                loading={ingReduceLoading}
                disabled={ingReduceLoading || ingReduceQty.trim() === ''}
                style={addStockModalStyles.btnFlex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ingredient Reduce — Reason Picker ───────────────────────────────── */}
      <GenericPickerModal
        visible={ingReduceReasonVisible}
        onClose={() => setIngReduceReasonVisible(false)}
        title="Select Reason"
        options={REDUCTION_REASON_OPTIONS}
        selected={ingReduceReason}
        onSelect={(v) => { setIngReduceReason(v); setIngReduceReasonVisible(false); }}
        isDark={isDark}
      />

      {/* ── Product Reduce Stock — Reason Picker ─────────────────────────────── */}
      <GenericPickerModal
        visible={reduceStockReasonVisible}
        onClose={() => setReduceStockReasonVisible(false)}
        title="Select Reason"
        options={REDUCTION_REASON_OPTIONS}
        selected={reduceStockReason}
        onSelect={(v) => { setReduceStockReason(v); setReduceStockReasonVisible(false); }}
        isDark={isDark}
      />

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

const addStockStyles = StyleSheet.create({
  btnRow: {
    flexDirection: 'row',
    gap: staticTheme.spacing.xs,
  },
  btnFlex: { flex: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: staticTheme.spacing.xs,
    paddingVertical: 10, paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.lg,
    borderWidth: 1,
  },
});

const readOnlyQtyStyles = StyleSheet.create({
  label: {
    marginBottom: 5,
    color: '#888',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: staticTheme.spacing.sm,
    paddingVertical: 10,
    borderRadius: staticTheme.borderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  hint: {
    marginTop: 4,
    fontSize: 10,
  },
});

const ingReduceStyles = StyleSheet.create({
  reasonTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.md,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.sm,
    minHeight: 48,
    marginBottom: staticTheme.spacing.md,
  },
});

const addStockModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: staticTheme.spacing.md,
  },
  box: {
    width: '100%',
    maxWidth: 400,
    borderRadius: staticTheme.borderRadius['2xl'],
    borderWidth: 1,
    padding: staticTheme.spacing.lg,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
    marginBottom: staticTheme.spacing.sm,
  },
  iconPill: {
    width: 36, height: 36,
    borderRadius: staticTheme.borderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  qtyInput: {
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.md,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.sm,
    fontSize: 18,
    fontWeight: '600' as const,
    minHeight: 52,
    marginBottom: staticTheme.spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
  },
  btnFlex: { flex: 1 },
});
