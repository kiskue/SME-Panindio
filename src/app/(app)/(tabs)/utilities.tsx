/**
 * UtilitiesScreen
 *
 * Utilities Consumption tracking screen for SME Panindio.
 * Tracks monthly utility bills (electricity, water, gas, internet, rent, etc.)
 * with payment status, overdue detection, yearly trend chart, and add/edit
 * bottom-sheet modal.
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, use conditional spread
 *   - noUncheckedIndexedAccess: all array/object access uses `?? fallback`
 *   - noUnusedLocals: unused vars prefixed with `_`
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Easing,
  Animated,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetModalRef,
} from '@gorhom/bottom-sheet';
import {
  Zap,
  Droplets,
  Flame,
  Wifi,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Check,
  Trash2,
  Calendar,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { DatePickerField } from '@/components/molecules/DatePickerField';
import {
  useThemeStore,
  selectThemeMode,
  useUtilitiesStore,
  selectUtilityLogs,
  selectUtilityTypes,
  selectUtilityLoading,
  selectMonthlySummary,
  selectYearlySummary,
} from '@/store';
import type { UtilityType, UtilityLog } from '@/types';
import type { UtilityMonthlySummary, UtilityYearlyPoint } from '@/store/utilities.store';
import type { UpsertUtilityLogInput } from '../../../../database/repositories/utilities.repository';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { useAppDialog } from '@/hooks';

// ─── Types ────────────────────────────────────────────────────────────────────


// ─── Layout constants ─────────────────────────────────────────────────────────

// ─── Color tokens ──────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const FULL_MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatPeriod(year: number, month: number): string {
  return `${FULL_MONTH_LABELS[month - 1] ?? ''} ${year}`;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return `Due ${MONTH_LABELS[d.getMonth()] ?? ''} ${d.getDate()}`;
}

function isOverdue(dueDate: string | undefined, paidAt: string | undefined): boolean {
  if (paidAt !== undefined) return false;
  if (dueDate === undefined) return false;
  return new Date(dueDate) < new Date();
}

// ─── Icon map ──────────────────────────────────────────────────────────────────

function UtilityIcon({
  iconName,
  size,
  color,
}: {
  iconName: string;
  size:     number;
  color:    string;
}) {
  switch (iconName) {
    case 'Zap':      return <Zap      size={size} color={color} />;
    case 'Droplets': return <Droplets size={size} color={color} />;
    case 'Flame':    return <Flame    size={size} color={color} />;
    case 'Wifi':     return <Wifi     size={size} color={color} />;
    case 'Home':     return <Home     size={size} color={color} />;
    default:         return <Zap      size={size} color={color} />;
  }
}

// ─── UtilityCard ──────────────────────────────────────────────────────────────

interface UtilityCardProps {
  log:        UtilityLog;
  isDark:     boolean;
  onPress:    (log: UtilityLog) => void;
  onMarkPaid: (id: string) => void;
  onDelete:   (id: string) => void;
}

const UtilityCard = React.memo<UtilityCardProps>(({ log, isDark, onPress, onMarkPaid, onDelete }) => {
  const overdue  = isOverdue(log.dueDate, log.paidAt);
  const isPaid   = log.paidAt !== undefined;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dialog   = useAppDialog();

  const cardBg    = isDark ? DARK_CARD_BG  : '#FFFFFF';
  const border    = isDark ? DARK_BORDER   : staticTheme.colors.border;
  const textMain  = isDark ? DARK_TEXT     : staticTheme.colors.gray[900];
  const textSec   = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  // Status tint overlay on card
  const tintColor = isPaid
    ? (isDark ? 'rgba(61,214,140,0.04)' : 'rgba(39,174,96,0.04)')
    : overdue
      ? (isDark ? 'rgba(255,107,107,0.06)' : 'rgba(255,59,48,0.05)')
      : 'transparent';

  const accentColor = log.utilityTypeColor;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 70,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 110, useNativeDriver: true }),
    ]).start();
    onPress(log);
  }, [onPress, log, scaleAnim]);

  const handleMarkPaid = useCallback(() => {
    dialog.confirm({
      title:       'Mark as Paid',
      message:     `Mark ${log.utilityTypeName} as paid?`,
      confirmText: 'Mark Paid',
      cancelText:  'Cancel',
      onConfirm:   () => onMarkPaid(log.id),
    });
  }, [log.id, log.utilityTypeName, onMarkPaid, dialog]);

  const handleDelete = useCallback(() => {
    dialog.confirm({
      title:       'Delete Entry',
      message:     `Delete ${log.utilityTypeName} entry? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText:  'Cancel',
      onConfirm:   () => onDelete(log.id),
    });
  }, [log.id, log.utilityTypeName, onDelete, dialog]);

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Animated.View
        style={[
          cardStyles.card,
          {
            backgroundColor: cardBg,
            borderColor:     border,
            transform:       [{ scale: scaleAnim }],
          },
          isDark && cardStyles.cardDarkShadow,
          !isDark && cardStyles.cardLightShadow,
        ]}
      >
        {/* Tint overlay */}
        {tintColor !== 'transparent' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, borderRadius: 16 }]} />
        )}

        {/* Left accent bar */}
        <View style={[cardStyles.accentBar, { backgroundColor: accentColor }]} />

        <View style={cardStyles.body}>
          {/* Row 1: Icon + Name + Status Badge */}
          <View style={cardStyles.row}>
            <View style={[cardStyles.iconWrap, { backgroundColor: `${accentColor}1A` }]}>
              <UtilityIcon iconName={log.utilityTypeIcon} size={20} color={accentColor} />
            </View>
            <View style={cardStyles.nameBlock}>
              <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
                {log.utilityTypeName}
              </Text>
              <Text variant="caption" style={{ color: textSec }}>
                {formatPeriod(log.periodYear, log.periodMonth)}
              </Text>
            </View>
            <StatusBadge isPaid={isPaid} isOverdue={overdue} isDark={isDark} />
          </View>

          {/* Row 2: Amount + Consumption */}
          <View style={[cardStyles.row, { marginTop: 10 }]}>
            <Text variant="h5" weight="bold" style={{ color: textMain }}>
              {formatCurrency(log.amount)}
            </Text>
            {log.consumption !== undefined && (
              <Text variant="caption" weight="medium" style={[cardStyles.consumptionChip, { color: accentColor, borderColor: `${accentColor}33`, backgroundColor: `${accentColor}12` }]}>
                {log.consumption} {log.utilityTypeUnit}
              </Text>
            )}
          </View>

          {/* Row 3: Due date + action buttons */}
          <View style={[cardStyles.row, { marginTop: 8 }]}>
            {log.dueDate !== undefined ? (
              <View style={cardStyles.dueDateRow}>
                <Calendar size={12} color={overdue && !isPaid ? staticTheme.colors.error[500] : textSec} />
                <Text
                  variant="caption"
                  style={{ color: overdue && !isPaid ? staticTheme.colors.error[500] : textSec, marginLeft: 4 }}
                >
                  {formatDueDate(log.dueDate)}
                  {overdue && !isPaid ? ' — Overdue' : ''}
                </Text>
              </View>
            ) : (
              <View style={cardStyles.dueDateRow} />
            )}

            <View style={cardStyles.actionRow}>
              {!isPaid && (
                <Pressable
                  onPress={handleMarkPaid}
                  style={[cardStyles.actionBtn, { backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : staticTheme.colors.success[50] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as paid"
                >
                  <Check size={14} color={isDark ? '#3DD68C' : staticTheme.colors.success[600]} />
                </Pressable>
              )}
              <Pressable
                onPress={handleDelete}
                style={[cardStyles.actionBtn, { backgroundColor: isDark ? 'rgba(255,107,107,0.15)' : staticTheme.colors.error[50] }]}
                accessibilityRole="button"
                accessibilityLabel="Delete entry"
              >
                <Trash2 size={14} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
      {dialog.Dialog}
    </Pressable>
  );
});
UtilityCard.displayName = 'UtilityCard';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const StatusBadge = React.memo<{ isPaid: boolean; isOverdue: boolean; isDark: boolean }>(
  ({ isPaid, isOverdue, isDark }) => {
    if (isPaid) {
      return (
        <View style={[badgeStyles.base, {
          backgroundColor: isDark ? 'rgba(61,214,140,0.18)' : staticTheme.colors.success[50],
          borderColor:     isDark ? 'rgba(61,214,140,0.35)' : staticTheme.colors.success[200],
        }]}>
          <Text variant="caption" weight="semibold" style={{ color: isDark ? '#3DD68C' : staticTheme.colors.success[700] }}>
            Paid
          </Text>
        </View>
      );
    }
    if (isOverdue) {
      return (
        <View style={[badgeStyles.base, {
          backgroundColor: isDark ? 'rgba(255,107,107,0.18)' : staticTheme.colors.error[50],
          borderColor:     isDark ? 'rgba(255,107,107,0.35)' : staticTheme.colors.error[200],
        }]}>
          <AlertCircle size={10} color={isDark ? '#FF6B6B' : staticTheme.colors.error[500]} style={{ marginRight: 3 }} />
          <Text variant="caption" weight="semibold" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[600] }}>
            Overdue
          </Text>
        </View>
      );
    }
    return (
      <View style={[badgeStyles.base, {
        backgroundColor: isDark ? 'rgba(255,176,32,0.18)' : staticTheme.colors.highlight[50],
        borderColor:     isDark ? 'rgba(255,176,32,0.35)' : staticTheme.colors.highlight[200],
      }]}>
        <Text variant="caption" weight="semibold" style={{ color: isDark ? '#FFB020' : staticTheme.colors.highlight[600] }}>
          Unpaid
        </Text>
      </View>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';

// ─── YearlyTrendChart ─────────────────────────────────────────────────────────

const YearlyTrendChart = React.memo<{
  summary:      UtilityYearlyPoint[];
  isDark:       boolean;
  currentMonth: number;
}>(({ summary, isDark, currentMonth }) => {
  const maxAmount = useMemo(
    () => Math.max(...summary.map(p => p.totalAmount), 1),
    [summary],
  );

  const barColor    = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const activeColor = isDark ? '#FFB020' : staticTheme.colors.highlight[400];
  const textSec     = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];

  return (
    <View style={chartStyles.container}>
      {MONTH_LABELS.map((label, idx) => {
        const monthNum = idx + 1;
        const point    = summary.find(p => p.month === monthNum);
        const amount   = point?.totalAmount ?? 0;
        const ratio    = amount / maxAmount;
        const isActive = monthNum === currentMonth;
        const color    = isActive ? activeColor : barColor;

        return (
          <View key={label} style={chartStyles.barCol}>
            <View style={chartStyles.barTrack}>
              <View
                style={[
                  chartStyles.barFill,
                  {
                    height:          `${Math.max(ratio * 100, 2)}%`,
                    backgroundColor: color,
                    opacity:         amount === 0 ? 0.25 : 1,
                    borderRadius:    isActive ? 4 : 3,
                  },
                ]}
              />
            </View>
            <Text
              variant="caption"
              style={{ color: isActive ? color : textSec, fontSize: 9, marginTop: 3 }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});
YearlyTrendChart.displayName = 'YearlyTrendChart';

// ─── TypePickerChip ───────────────────────────────────────────────────────────

const TypePickerChip = React.memo<{
  type:       UtilityType;
  selected:   boolean;
  isDark:     boolean;
  onSelect:   (id: string) => void;
}>(({ type, selected, isDark, onSelect }) => {
  const bgColor   = selected
    ? `${type.color}22`
    : isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[100];
  const borderCol = selected ? type.color : 'transparent';
  const textColor = selected
    ? type.color
    : isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[600];

  return (
    <Pressable
      onPress={() => onSelect(type.id)}
      style={[chipStyles.chip, { backgroundColor: bgColor, borderColor: borderCol }]}
      accessibilityRole="button"
    >
      <UtilityIcon iconName={type.icon} size={14} color={textColor} />
      <Text variant="caption" weight="medium" style={{ color: textColor, marginLeft: 5 }}>
        {type.name}
      </Text>
    </Pressable>
  );
});
TypePickerChip.displayName = 'TypePickerChip';

// ─── AddEditBottomSheet ───────────────────────────────────────────────────────

interface SheetState {
  amountText:      string;
  consumptionText: string;
  dueDate:         string;
  notes:           string;
  selectedTypeId:  string;
  markAsPaid:      boolean;
}

interface AddEditBottomSheetProps {
  visible:      boolean;
  isDark:       boolean;
  types:        UtilityType[];
  editingLog:   UtilityLog | null;
  periodYear:   number;
  periodMonth:  number;
  onClose:      () => void;
  onSave:       (payload: UpsertUtilityLogInput, markPaid: boolean) => Promise<void>;
}

const AddEditBottomSheet = React.memo<AddEditBottomSheetProps>((props) => {
  const { visible, isDark, types, editingLog, periodYear, periodMonth, onClose, onSave } = props;

  const modalRef   = useRef<BottomSheetModalRef>(null);
  const insets     = useSafeAreaInsets();
  const mountedRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const dialog     = useAppDialog();

  // Track mounted state to avoid setState on an unmounted sheet after onClose()
  // triggers its parent to hide the Modal.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [form, setForm] = useState<SheetState>({
    amountText:      '',
    consumptionText: '',
    dueDate:         '',
    notes:           '',
    // types may be empty on first mount (store still hydrating); '' is the
    // safe sentinel — a separate effect below will backfill it once types load.
    selectedTypeId:  types[0]?.id ?? '',
    markAsPaid:      false,
  });

  // Populate / reset form whenever the sheet opens or the editing target changes.
  useEffect(() => {
    if (!visible) return; // only run when the sheet is actually opening
    if (editingLog !== null) {
      setForm({
        amountText:      editingLog.amount.toString(),
        consumptionText: editingLog.consumption !== undefined ? String(editingLog.consumption) : '',
        dueDate:         editingLog.dueDate     ?? '',
        notes:           editingLog.notes       ?? '',
        selectedTypeId:  editingLog.utilityTypeId,
        markAsPaid:      editingLog.paidAt !== undefined,
      });
    } else {
      setForm({
        amountText:      '',
        consumptionText: '',
        dueDate:         '',
        notes:           '',
        // Use the first available type; may still be '' if types are not ready
        // yet — the fallback effect below will correct it once they arrive.
        selectedTypeId:  types[0]?.id ?? '',
        markAsPaid:      false,
      });
    }
  }, [editingLog, types, visible]);

  // Bug fix: if the sheet is open for a NEW entry and selectedTypeId is still
  // '' (store finished hydrating after the sheet opened), auto-select the first
  // available type as soon as types become non-empty.
  useEffect(() => {
    if (visible && editingLog === null && form.selectedTypeId === '' && types.length > 0) {
      setForm(prev => ({ ...prev, selectedTypeId: types[0]?.id ?? '' }));
    }
    // Intentionally only re-runs when types or sheet visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, visible]);

  // Sync visible prop → gorhom imperative API
  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const selectedType = useMemo(
    () => types.find(t => t.id === form.selectedTypeId) ?? types[0],
    [form.selectedTypeId, types],
  );

  const sheetBg  = isDark ? DARK_SURFACE : '#FFFFFF';
  const inputBg  = isDark ? '#242A3A' : staticTheme.colors.gray[50];
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT     : staticTheme.colors.gray[900];
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500];
  const labelCol = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[600];

  const handleSave = useCallback(async () => {
    const amount = parseFloat(form.amountText.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      dialog.show({ variant: 'warning', title: 'Validation', message: 'Please enter a valid amount.' });
      return;
    }
    if (!form.selectedTypeId) {
      dialog.show({ variant: 'warning', title: 'Validation', message: 'Please select a utility type.' });
      return;
    }

    const consumption = form.consumptionText.trim() !== ''
      ? parseFloat(form.consumptionText)
      : undefined;

    const payload: UpsertUtilityLogInput = {
      utilityTypeId: form.selectedTypeId,
      periodYear,
      periodMonth,
      amount,
      ...(consumption !== undefined && !isNaN(consumption) ? { consumption } : {}),
      ...(form.dueDate.trim() !== '' ? { dueDate: form.dueDate.trim() } : {}),
      ...(form.notes.trim()   !== '' ? { notes:   form.notes.trim() }   : {}),
    };

    setSaving(true);
    try {
      await onSave(payload, form.markAsPaid);
      // onClose() is called only on success. On error we stay open so the
      // user can retry without re-entering their data.
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      dialog.show({ variant: 'error', title: 'Error', message: `Failed to save entry: ${msg}` });
      // Keep the sheet open — do NOT call onClose() here.
    } finally {
      // Guard against setState on an unmounted component. onClose() above
      // triggers the parent to hide the Modal; by the time `finally` runs the
      // component may already be gone from the tree.
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [form, periodYear, periodMonth, onSave, onClose]);

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={isDark ? 0.70 : 0.45}
      />
    ),
    [isDark],
  );

  const snapPoints       = useMemo(() => ['85%'], []);
  const backgroundStyle  = useMemo(() => ({ backgroundColor: sheetBg }), [sheetBg]);
  const handleIndicator  = useMemo(
    () => ({ backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : staticTheme.colors.gray[300], width: 36, height: 4 }),
    [isDark],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleIndicator}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {/* Header */}
      <View style={sheetStyles.sheetHeader}>
        <Text variant="h5" weight="bold" style={{ color: textMain }}>
          {editingLog !== null ? 'Edit Utility Entry' : 'Add Utility Entry'}
        </Text>
        <Text variant="caption" style={{ color: textSec }}>
          {formatPeriod(periodYear, periodMonth)}
        </Text>
        <Pressable onPress={onClose} style={sheetStyles.closeBtn} accessibilityRole="button">
          <X size={20} color={textSec} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        style={sheetStyles.formScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
            {/* Type picker */}
            <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelCol }]}>
              Utility Type
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={chipStyles.row}>
                {types.map(type => (
                  <TypePickerChip
                    key={type.id}
                    type={type}
                    selected={form.selectedTypeId === type.id}
                    isDark={isDark}
                    onSelect={(id) => setForm(prev => ({ ...prev, selectedTypeId: id }))}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Amount */}
            <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelCol }]}>
              Amount *
            </Text>
            <View style={[sheetStyles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Text variant="body" weight="bold" style={{ color: selectedType?.color ?? textMain, marginRight: 8 }}>
                ₱
              </Text>
              <TextInput
                style={[sheetStyles.textInput, { color: textMain }]}
                value={form.amountText}
                onChangeText={(v) => setForm(prev => ({ ...prev, amountText: v }))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.placeholder}
                accessibilityLabel="Amount"
              />
            </View>

            {/* Consumption */}
            <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelCol }]}>
              Consumption (optional)
              {selectedType !== undefined ? ` — ${selectedType.unit}` : ''}
            </Text>
            <View style={[sheetStyles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <TextInput
                style={[sheetStyles.textInput, { color: textMain }]}
                value={form.consumptionText}
                onChangeText={(v) => setForm(prev => ({ ...prev, consumptionText: v }))}
                keyboardType="decimal-pad"
                placeholder={`e.g. 245`}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.placeholder}
                accessibilityLabel="Consumption reading"
              />
              {selectedType !== undefined && (
                <Text variant="caption" weight="medium" style={{ color: textSec, marginLeft: 6 }}>
                  {selectedType.unit}
                </Text>
              )}
            </View>

            {/* Due date */}
            <DatePickerField
              label="Due Date (optional)"
              value={form.dueDate}
              onChange={(v) => setForm(prev => ({ ...prev, dueDate: v }))}
              accessibilityLabel="Due date"
            />

            {/* Notes */}
            <Text variant="body-sm" weight="semibold" style={[sheetStyles.fieldLabel, { color: labelCol }]}>
              Notes (optional)
            </Text>
            <View style={[sheetStyles.inputRow, sheetStyles.notesRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <FileText size={16} color={textSec} style={{ marginRight: 8, alignSelf: 'flex-start', marginTop: 2 }} />
              <TextInput
                style={[sheetStyles.textInput, { color: textMain, textAlignVertical: 'top' }]}
                value={form.notes}
                onChangeText={(v) => setForm(prev => ({ ...prev, notes: v }))}
                placeholder="Add a note..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.placeholder}
                multiline
                numberOfLines={3}
                accessibilityLabel="Notes"
              />
            </View>

            {/* Mark as Paid toggle */}
            {editingLog !== null && (
              <Pressable
                onPress={() => setForm(prev => ({ ...prev, markAsPaid: !prev.markAsPaid }))}
                style={[sheetStyles.paidToggle, {
                  backgroundColor: form.markAsPaid
                    ? (isDark ? 'rgba(61,214,140,0.12)' : staticTheme.colors.success[50])
                    : (isDark ? 'rgba(255,255,255,0.05)' : staticTheme.colors.gray[50]),
                  borderColor: form.markAsPaid
                    ? (isDark ? 'rgba(61,214,140,0.35)' : staticTheme.colors.success[200])
                    : inputBorder,
                }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.markAsPaid }}
              >
                <View style={[sheetStyles.checkCircle, {
                  backgroundColor: form.markAsPaid
                    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500])
                    : 'transparent',
                  borderColor: form.markAsPaid
                    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500])
                    : inputBorder,
                }]}>
                  {form.markAsPaid && <Check size={12} color="#FFFFFF" />}
                </View>
                <Text variant="body-sm" weight="medium" style={{ color: form.markAsPaid ? (isDark ? '#3DD68C' : staticTheme.colors.success[700]) : textSec }}>
                  Mark as Paid
                </Text>
              </Pressable>
            )}

            <View style={{ height: 24 }} />
      </BottomSheetScrollView>

      {/* Save button — sticky footer */}
      <View style={[
        sheetStyles.footer,
        {
          borderTopColor: isDark ? DARK_BORDER : staticTheme.colors.border,
          paddingBottom: Math.max(insets.bottom, staticTheme.spacing.md),
        },
      ]}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[
            sheetStyles.saveBtn,
            { backgroundColor: selectedType?.color ?? staticTheme.colors.primary[500] },
            saving && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text variant="body" weight="bold" style={{ color: '#FFFFFF' }}>Save Entry</Text>
          }
        </Pressable>
      </View>
      {dialog.Dialog}
    </BottomSheetModal>
  );
});
AddEditBottomSheet.displayName = 'AddEditBottomSheet';

// ─── SummaryPill ──────────────────────────────────────────────────────────────

const SummaryPill = React.memo<{
  label:   string;
  value:   string;
  color:   string;
  isDark:  boolean;
}>(({ label, value, color, isDark }) => (
  <View style={[pillStyles.pill, {
    backgroundColor: isDark ? `${color}18` : `${color}14`,
    borderColor:     isDark ? `${color}30` : `${color}22`,
  }]}>
    <Text variant="caption" style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500] }}>
      {label}
    </Text>
    <Text variant="body-sm" weight="bold" style={{ color, marginTop: 1 }}>
      {value}
    </Text>
  </View>
));
SummaryPill.displayName = 'SummaryPill';

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function UtilitiesScreen() {
  const appTheme = useAppTheme();
  const mode     = useThemeStore(selectThemeMode);
  const isDark   = mode === 'dark';
  const dialog   = useAppDialog();

  const logs           = useUtilitiesStore(useShallow(selectUtilityLogs));
  const types          = useUtilitiesStore(useShallow(selectUtilityTypes));
  const loading        = useUtilitiesStore(selectUtilityLoading);
  const monthlySummary = useUtilitiesStore(selectMonthlySummary);
  const yearlySummary  = useUtilitiesStore(useShallow(selectYearlySummary));

  // Extract stable action references individually. Grouping them into a plain
  // object literal (const store = { ... }) created a new object reference on
  // every render, causing every useCallback that listed `store` as a dependency
  // to be recreated unnecessarily and defeating memoisation.
  const loadLogsForMonth   = useUtilitiesStore((s) => s.loadLogsForMonth);
  const loadMonthlySummary = useUtilitiesStore((s) => s.loadMonthlySummary);
  const loadYearlySummary  = useUtilitiesStore((s) => s.loadYearlySummary);
  const upsertLog          = useUtilitiesStore((s) => s.upsertLog);
  const markPaid           = useUtilitiesStore((s) => s.markPaid);
  const deleteLog          = useUtilitiesStore((s) => s.deleteLog);

  // Month navigation state
  const now          = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  // Sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingLog,   setEditingLog]   = useState<UtilityLog | null>(null);

  // Trend section collapse
  const [trendExpanded, setTrendExpanded] = useState(false);
  const trendAnim = useRef(new Animated.Value(0)).current;

  // Color tokens
  const rootBg   = isDark ? DARK_ROOT_BG : appTheme.colors.background;
  const textMain = isDark ? DARK_TEXT     : appTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : appTheme.colors.textSecondary;
  const cardBg   = isDark ? DARK_CARD_BG  : appTheme.colors.surface;
  const border   = isDark ? DARK_BORDER   : appTheme.colors.border;

  // Load data when month/year changes
  useEffect(() => {
    void loadLogsForMonth(year, month);
    void loadMonthlySummary(year, month);
  }, [year, month, loadLogsForMonth, loadMonthlySummary]);

  useEffect(() => {
    void loadYearlySummary(year);
  }, [year, loadYearlySummary]);

  // Month navigation
  const goToPrevMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 1) { setYear(y => y - 1); return 12; }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 12) { setYear(y => y + 1); return 1; }
      return prev + 1;
    });
  }, []);

  // Sheet handlers
  const openAddSheet = useCallback(() => {
    setEditingLog(null);
    setSheetVisible(true);
  }, []);

  const openEditSheet = useCallback((log: UtilityLog) => {
    setEditingLog(log);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setEditingLog(null);
  }, []);

  const handleSave = useCallback(async (payload: UpsertUtilityLogInput, markAsPaid: boolean) => {
    // upsertLog returns the saved row (new or updated) including its id.
    // We use that id for markPaid so it works for both new entries AND edits.
    // Previously this used `editingLog.id` which was null for new entries,
    // causing the paid flag to be silently skipped on every "Add" flow.
    //
    // This function must re-throw on failure so the sheet's catch block can
    // surface the error to the user via Alert. Without re-throw, onClose() runs
    // even on failure and the user loses their unsaved form data.
    const saved = await upsertLog(payload); // throws on DB failure; propagates to sheet

    // markPaid and loadMonthlySummary are post-save side effects. A failure here
    // must NOT appear as "failed to save entry" — the entry was already saved.
    // Wrap these independently and report a more specific error if they fail.
    if (markAsPaid) {
      try {
        await markPaid(saved.id);
      } catch (err) {
        // Entry saved successfully — only the paid flag failed. Log and continue
        // so the sheet still closes. The log list will still show the entry.
        const msg = err instanceof Error ? err.message : 'Unknown error';
        dialog.show({ variant: 'warning', title: 'Warning', message: `Entry saved but could not mark as paid: ${msg}` });
      }
    }

    try {
      await loadMonthlySummary(year, month);
    } catch {
      // Summary refresh is non-critical — stale data is acceptable here.
      // The list was already refreshed inside upsertLog.
    }
  }, [upsertLog, markPaid, loadMonthlySummary, year, month]);

  const handleMarkPaid = useCallback(async (id: string) => {
    // markPaid refreshes the log list internally; reload summary separately
    await markPaid(id);
    await loadMonthlySummary(year, month);
  }, [markPaid, loadMonthlySummary, year, month]);

  const handleDelete = useCallback(async (id: string) => {
    // deleteLog does an optimistic splice; reload summary to keep pills in sync
    await deleteLog(id);
    await loadMonthlySummary(year, month);
  }, [deleteLog, loadMonthlySummary, year, month]);

  // Trend toggle
  const toggleTrend = useCallback(() => {
    const toValue = trendExpanded ? 0 : 1;
    setTrendExpanded(!trendExpanded);
    // Animated.spring with low friction overshoots below 0 on collapse, causing
    // a visible flicker on layout-driven properties (useNativeDriver: false).
    // Animated.timing with Easing.out(Easing.cubic) gives a smooth curve with
    // zero overshoot regardless of direction.
    Animated.timing(trendAnim, {
      toValue,
      duration:        260,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [trendExpanded, trendAnim]);

  const trendHeight = trendAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 190],
  });

  // Filter logs for current month
  const monthLogs = useMemo(
    () => logs.filter(l => l.periodYear === year && l.periodMonth === month),
    [logs, year, month],
  );

  // Summary values
  const totalAmount  = monthlySummary?.totalAmount  ?? monthLogs.reduce((s, l) => s + l.amount, 0);
  const paidAmount   = monthlySummary?.paidAmount   ?? monthLogs.filter(l => l.paidAt !== undefined).reduce((s, l) => s + l.amount, 0);
  const unpaidAmount = monthlySummary?.unpaidAmount ?? totalAmount - paidAmount;

  const renderLog = useCallback(({ item }: { item: UtilityLog }) => (
    <UtilityCard
      log={item}
      isDark={isDark}
      onPress={openEditSheet}
      onMarkPaid={handleMarkPaid}
      onDelete={handleDelete}
    />
  ), [isDark, openEditSheet, handleMarkPaid, handleDelete]);

  const keyExtractor = useCallback((item: UtilityLog) => item.id, []);

  const ListEmpty = useMemo(() => (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, {
        backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50],
      }]}>
        <Zap size={40} color={isDark ? '#4F9EFF' : staticTheme.colors.primary[400]} />
      </View>
      <Text variant="h5" weight="semibold" style={{ color: textMain, marginTop: 16 }}>
        No Utilities Logged
      </Text>
      <Text variant="body-sm" style={{ color: textSec, marginTop: 6, textAlign: 'center' }}>
        Tap the + button to add your first utility bill for {formatPeriod(year, month)}.
      </Text>
    </View>
  ), [isDark, textMain, textSec, year, month]);

  return (
    <View style={[screenStyles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Month selector header ── */}
      <View style={[screenStyles.monthHeader, {
        backgroundColor: cardBg,
        borderBottomColor: border,
      }]}>
        <Pressable
          onPress={goToPrevMonth}
          style={[screenStyles.chevronBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100] }]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={20} color={textMain} />
        </Pressable>

        <View style={screenStyles.monthCenter}>
          <Text variant="h5" weight="bold" style={{ color: textMain }}>
            {formatPeriod(year, month)}
          </Text>
          {loading && <ActivityIndicator size="small" color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} style={{ marginTop: 2 }} />}
        </View>

        <Pressable
          onPress={goToNextMonth}
          style={[screenStyles.chevronBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100] }]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <ChevronRight size={20} color={textMain} />
        </Pressable>
      </View>

      {/* ── Summary pills ── */}
      <View style={[screenStyles.pillsRow, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <SummaryPill
          label="Total"
          value={formatCurrency(totalAmount)}
          color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
          isDark={isDark}
        />
        <SummaryPill
          label="Paid"
          value={formatCurrency(paidAmount)}
          color={isDark ? '#3DD68C' : staticTheme.colors.success[500]}
          isDark={isDark}
        />
        <SummaryPill
          label="Unpaid"
          value={formatCurrency(unpaidAmount)}
          color={isDark ? '#FFB020' : staticTheme.colors.highlight[500]}
          isDark={isDark}
        />
      </View>

      {/* ── Log list ── */}
      <FlatList<UtilityLog>
        data={monthLogs}
        renderItem={renderLog}
        keyExtractor={keyExtractor}
        contentContainerStyle={screenStyles.listContent}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={[screenStyles.trendSection, {
            backgroundColor: cardBg,
            borderColor:     border,
          }]}>
            {/* Collapsible trend header */}
            <Pressable
              onPress={toggleTrend}
              style={screenStyles.trendHeader}
              accessibilityRole="button"
              accessibilityLabel={trendExpanded ? 'Collapse yearly trend' : 'Expand yearly trend'}
            >
              <View style={screenStyles.trendTitleRow}>
                <TrendingUp size={16} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />
                <Text variant="body-sm" weight="semibold" style={{ color: textMain, marginLeft: 8 }}>
                  {year} Yearly Overview
                </Text>
              </View>
              {trendExpanded
                ? <ChevronUp   size={16} color={textSec} />
                : <ChevronDown size={16} color={textSec} />
              }
            </Pressable>

            {/* Collapsible chart */}
            <Animated.View style={{ height: trendHeight, overflow: 'hidden' }}>
              <YearlyTrendChart
                summary={yearlySummary}
                isDark={isDark}
                currentMonth={month}
              />
            </Animated.View>
          </View>
        }
      />

      {/* ── FAB ── */}
      <Pressable
        onPress={openAddSheet}
        style={[
          fabStyles.fab,
          {
            backgroundColor: isDark ? '#4F9EFF' : appTheme.colors.primary[500],
          },
          isDark ? fabStyles.fabDarkShadow : fabStyles.fabLightShadow,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add utility entry"
      >
        <Plus size={28} color="#FFFFFF" />
      </Pressable>

      {/* ── Add/Edit Bottom Sheet ── */}
      <AddEditBottomSheet
        visible={sheetVisible}
        isDark={isDark}
        types={types}
        editingLog={editingLog}
        periodYear={year}
        periodMonth={month}
        onClose={closeSheet}
        onSave={handleSave}
      />
      {dialog.Dialog}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const screenStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  monthHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
  },
  monthCenter: {
    flex:          1,
    alignItems:    'center',
    justifyContent: 'center',
    gap: 2,
  },
  chevronBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pillsRow: {
    flexDirection:     'row',
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               8,
    borderBottomWidth: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     100,
    gap:               12,
  },
  trendSection: {
    borderRadius: 16,
    borderWidth:  1,
    marginTop:    8,
    overflow:     'hidden',
  },
  trendHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  trendTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius:  16,
    borderWidth:   1,
    flexDirection: 'row',
    overflow:      'hidden',
  },
  cardLightShadow: {
    shadowColor:   '#1E4D8C',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     3,
  },
  cardDarkShadow: {
    shadowColor:  '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius:  8,
    elevation:     5,
  },
  accentBar: {
    width:        4,
    borderRadius: 0,
  },
  body: {
    flex:    1,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  iconWrap: {
    width:          38,
    height:         38,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    10,
  },
  nameBlock: {
    flex: 1,
    gap:  2,
  },
  consumptionChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      20,
    borderWidth:       1,
    marginLeft:        'auto',
    fontSize:          11,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
  },
  actionRow: {
    flexDirection: 'row',
    gap:           6,
  },
  actionBtn: {
    width:          32,
    height:         32,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

const badgeStyles = StyleSheet.create({
  base: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      20,
    borderWidth:       1,
    marginLeft:        8,
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    flex:             1,
    alignItems:       'center',
    paddingVertical:  8,
    paddingHorizontal: 4,
    borderRadius:     12,
    borderWidth:      1,
    gap:              2,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems:     'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width:          88,
    height:         88,
    borderRadius:   44,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

const chartStyles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 16,
    paddingBottom:     16,
    paddingTop:        8,
    height:            190,
    gap:               4,
  },
  barCol: {
    flex:           1,
    alignItems:     'center',
    height:         '100%',
  },
  barTrack: {
    flex:            1,
    width:           '100%',
    justifyContent:  'flex-end',
  },
  barFill: {
    width: '100%',
  },
});

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           8,
    paddingRight:  4,
  },
  chip: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      20,
    borderWidth:       1.5,
  },
});

const sheetStyles = StyleSheet.create({
  sheetHeader: {
    paddingHorizontal: 20,
    paddingVertical:   14,
    gap:               2,
  },
  closeBtn: {
    position: 'absolute',
    right:    20,
    top:      14,
    padding:  4,
  },
  formScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      10,
    borderWidth:       1,
    paddingHorizontal: 12,
    paddingVertical:   10,
    marginBottom:      16,
  },
  notesRow: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  textInput: {
    flex:     1,
    fontSize: 16,
    padding:  0,
  },
  paidToggle: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingHorizontal: 14,
    paddingVertical:   12,
    borderRadius:      10,
    borderWidth:       1,
    marginBottom:      12,
  },
  checkCircle: {
    width:          22,
    height:         22,
    borderRadius:   11,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical:   16,
    borderTopWidth:    1,
  },
  saveBtn: {
    borderRadius:   12,
    paddingVertical: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

const fabStyles = StyleSheet.create({
  fab: {
    position:       'absolute',
    bottom:         28,
    right:          24,
    width:          60,
    height:         60,
    borderRadius:   30,
    alignItems:     'center',
    justifyContent: 'center',
  },
  fabLightShadow: {
    shadowColor:   '#1E4D8C',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  10,
    elevation:     8,
  },
  fabDarkShadow: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.50,
    shadowRadius:  12,
    elevation:     12,
  },
});
