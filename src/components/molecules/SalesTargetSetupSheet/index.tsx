/**
 * SalesTargetSetupSheet — molecule
 *
 * A bottom sheet that lets the user set their daily net income target and
 * optionally select a product to base the units-needed calculation on.
 *
 * Fields:
 *   - Daily income target (₱) — numeric text input
 *   - Product selector (optional) — list of products from inventory;
 *     selecting "Any / All Products" clears the product filter and uses
 *     the blended contribution margin from the business_roi store.
 *
 * Derived values shown live as the user types:
 *   - Weekly target = daily × 7
 *   - Monthly target = daily × 30
 *   - Units needed per day (with selected product's net income per unit)
 *
 * On "Save":
 *   - Calls `setDailyTarget(amount, productId)` from useSalesTargetStore.
 *   - Closes the sheet.
 *
 * TypeScript strict-mode notes:
 *   - exactOptionalPropertyTypes: conditional spread on optional props.
 *   - noUncheckedIndexedAccess: ?? fallbacks on all array access.
 *   - noUnusedLocals/Parameters: unused vars prefixed with _.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import {
  Target,
  Check,
  ChevronRight,
  Package,
  X,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import {
  useSalesTargetStore,
  selectDailyTarget,
  selectTargetProductId,
  selectNetIncomePerUnit,
  selectSalesTargetSaving,
} from '@/store/sales_target.store';
import { useInventoryStore, selectProducts } from '@/store';
import { useShallow } from 'zustand/react/shallow';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_SURFACE      = '#1E2435';
const DARK_BORDER       = 'rgba(255,255,255,0.10)';
const DARK_TEXT         = '#F1F5F9';
const DARK_TEXT_SEC     = '#94A3B8';
const DARK_INPUT_BG     = '#242D42';
const DARK_INPUT_BORDER = 'rgba(255,255,255,0.12)';

const ACCENT = '#F59E0B'; // amber — matches the Target/Sales motif

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUnits(value: number): string {
  if (value <= 0) return '—';
  return `${Math.ceil(value).toLocaleString()} units/day`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parsed  = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// ─── Derived preview row ──────────────────────────────────────────────────────

interface PreviewRowProps {
  label:    string;
  value:    string;
  isDark:   boolean;
  accent?:  boolean;
}

const PreviewRow: React.FC<PreviewRowProps> = ({ label, value, isDark, accent }) => (
  <View style={previewStyles.row}>
    <Text
      variant="body-sm"
      style={{ color: isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[500] }}
    >
      {label}
    </Text>
    <Text
      variant="body-sm"
      weight="semibold"
      style={{ color: accent === true ? ACCENT : (isDark ? DARK_TEXT : staticTheme.colors.text) }}
    >
      {value}
    </Text>
  </View>
);

const previewStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 5,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalesTargetSetupSheetProps {
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesTargetSetupSheet: React.FC<SalesTargetSetupSheetProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const mode   = useThemeMode();
  const isDark = mode === 'dark';

  // Store — individual selectors to avoid subscribing to the entire store,
  // which would cause tearing loops when loadProgress() runs concurrently.
  const dailyTarget      = useSalesTargetStore(selectDailyTarget);
  const targetProductId  = useSalesTargetStore(selectTargetProductId);
  const netIncomePerUnit = useSalesTargetStore(selectNetIncomePerUnit);
  const isSaving         = useSalesTargetStore(selectSalesTargetSaving);
  const setDailyTarget   = useSalesTargetStore((s) => s.setDailyTarget);
  const products         = useInventoryStore(useShallow(selectProducts));

  // Deserialize persisted product IDs — stored as JSON array string or single ID
  const initialProductIds = useMemo<string[]>(() => {
    if (targetProductId === null) return [];
    try {
      const parsed = JSON.parse(targetProductId) as unknown;
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // not JSON — treat as single ID
    }
    return [targetProductId];
  }, [targetProductId]);

  // Local form state — start from the persisted values so the user sees what
  // they previously set rather than a blank field.
  const [rawAmount, setRawAmount] = useState<string>(
    dailyTarget > 0 ? String(Math.round(dailyTarget)) : '',
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds);
  const [showProductList, setShowProductList] = useState(false);

  // Derive preview values
  const parsedAmount  = parseAmount(rawAmount);
  const weeklyAmount  = parsedAmount * 7;
  const monthlyAmount = parsedAmount * 30;

  // Resolve the average net income per unit across all selected products so
  // preview updates instantly before the user hits Save.
  const previewNetIncomePerUnit = useMemo(() => {
    if (selectedProductIds.length > 0) {
      const margins = selectedProductIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
        .map((p) => {
          const price     = p.price     ?? 0;
          const costPrice = p.costPrice ?? 0;
          return price > 0 && price > costPrice ? price - costPrice : 0;
        })
        .filter((m) => m > 0);
      if (margins.length > 0) {
        return margins.reduce((a, b) => a + b, 0) / margins.length;
      }
    }
    // Blended fallback — same value the store uses
    return netIncomePerUnit;
  }, [selectedProductIds, products, netIncomePerUnit]);

  const previewUnitsPerDay =
    previewNetIncomePerUnit > 0 && parsedAmount > 0
      ? Math.ceil(parsedAmount / previewNetIncomePerUnit)
      : 0;

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds],
  );

  const handleSave = useCallback(async () => {
    if (parsedAmount <= 0) return;
    // Serialize: null if none, single ID if one, JSON array if many
    const productIdPayload: string | null =
      selectedProductIds.length === 0
        ? null
        : selectedProductIds.length === 1
        ? (selectedProductIds[0] ?? null)
        : JSON.stringify(selectedProductIds);
    await setDailyTarget(parsedAmount, productIdPayload);
    onClose();
  }, [parsedAmount, selectedProductIds, setDailyTarget, onClose]);

  const handleRemoveProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => prev.filter((pid) => pid !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedProductIds([]);
    setShowProductList(false);
  }, []);

  const handleSelectProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
    // keep list open so user can select more
  }, []);

  // Sync rawAmount when the sheet is opened with an existing target
  useEffect(() => {
    if (dailyTarget > 0 && rawAmount === '') {
      setRawAmount(String(Math.round(dailyTarget)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const surfaceBg  = isDark ? DARK_SURFACE   : staticTheme.colors.gray[50];
  const border     = isDark ? DARK_BORDER    : staticTheme.colors.border;
  const textMain   = isDark ? DARK_TEXT      : staticTheme.colors.text;
  const textSec    = isDark ? DARK_TEXT_SEC  : staticTheme.colors.gray[500];
  const inputBg    = isDark ? DARK_INPUT_BG  : '#F8F9FC';
  const inputBorder = isDark ? DARK_INPUT_BORDER : staticTheme.colors.border;

  const canSave = parsedAmount > 0 && !isSaving;

  return (
    <View style={styles.content}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={[styles.iconPill, { backgroundColor: `${ACCENT}1A` }]}>
          <Target size={18} color={ACCENT} />
        </View>
        <Text variant="h6" weight="bold" style={{ color: textMain, flex: 1, marginLeft: 10 }}>
          {t('salesTarget.setupTitle')}
        </Text>
      </View>

      <Text variant="body-sm" style={{ color: textSec, marginBottom: 20 }}>
        {t('salesTarget.setupSubtitle')}
      </Text>

      {/* ── Daily target input ── */}
      <Text
        variant="body-xs"
        weight="semibold"
        style={{ color: textSec, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}
      >
        {t('salesTarget.dailyTargetLabel')}
      </Text>
      <View
        style={[
          styles.inputRow,
          { backgroundColor: inputBg, borderColor: inputBorder },
        ]}
      >
        <Text variant="h6" weight="bold" style={{ color: ACCENT, marginRight: 6 }}>
          ₱
        </Text>
        <TextInput
          value={rawAmount}
          onChangeText={setRawAmount}
          placeholder="e.g. 5000"
          placeholderTextColor={isDark ? '#4A5568' : staticTheme.colors.gray[400]}
          keyboardType="decimal-pad"
          style={[
            styles.input,
            { color: textMain },
          ]}
          accessibilityLabel={t('salesTarget.dailyTargetLabel')}
          returnKeyType="done"
        />
      </View>

      {/* ── Derived preview ── */}
      {parsedAmount > 0 && (
        <View style={[styles.previewCard, { backgroundColor: surfaceBg, borderColor: border }]}>
          <PreviewRow label={t('salesTarget.weeklyTarget')}  value={formatCurrency(weeklyAmount, { decimals: 0, dashOnZero: true })}  isDark={isDark} />
          <PreviewRow label={t('salesTarget.monthlyTarget')} value={formatCurrency(monthlyAmount, { decimals: 0, dashOnZero: true })} isDark={isDark} />
          <View style={[styles.previewDivider, { backgroundColor: border }]} />
          <PreviewRow
            label={t('salesTarget.netIncomePerUnit')}
            value={previewNetIncomePerUnit > 0 ? formatCurrency(previewNetIncomePerUnit, { decimals: 0, dashOnZero: true }) : t('salesTarget.setProductBelow')}
            isDark={isDark}
          />
          <PreviewRow
            label={t('salesTarget.unitsNeededPerDay')}
            value={formatUnits(previewUnitsPerDay)}
            isDark={isDark}
            accent
          />
        </View>
      )}

      {/* ── Product selector ── */}
      <Text
        variant="body-xs"
        weight="semibold"
        style={{ color: textSec, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20, marginBottom: 6 }}
      >
        {t('salesTarget.calculateFor')}
      </Text>
      <Text variant="body-xs" style={{ color: textSec, marginBottom: 10 }}>
        {t('salesTarget.calculateForDesc')}
      </Text>

      {/* Selected product chips */}
      {selectedProducts.length > 0 && (
        <View style={styles.chipsWrapper}>
          {selectedProducts.map((product) => {
            const margin = (product.price ?? 0) - (product.costPrice ?? 0);
            return (
              <View
                key={product.id}
                style={[styles.selectedChip, { backgroundColor: `${ACCENT}1A`, borderColor: `${ACCENT}33` }]}
              >
                <Package size={13} color={ACCENT} />
                <Text variant="body-sm" weight="medium" style={{ color: ACCENT, flex: 1, marginLeft: 5 }} numberOfLines={1}>
                  {product.name}
                </Text>
                {margin > 0 && (
                  <Text variant="body-xs" style={{ color: textSec, marginRight: 6 }}>
                    ₱{margin.toLocaleString('en-PH', { maximumFractionDigits: 0 })}/unit
                  </Text>
                )}
                <Pressable onPress={() => handleRemoveProduct(product.id)} hitSlop={8} accessibilityLabel={`Remove ${product.name}`}>
                  <X size={13} color={textSec} />
                </Pressable>
              </View>
            );
          })}
          <Pressable
            onPress={handleClearAll}
            style={[styles.clearAllBtn, { borderColor: border }]}
            accessibilityRole="button"
            accessibilityLabel={t('salesTarget.clearAll')}
          >
            <X size={12} color={textSec} />
            <Text variant="body-xs" style={{ color: textSec, marginLeft: 4 }}>{t('salesTarget.clearAll')}</Text>
          </Pressable>
        </View>
      )}

      {/* Add products button */}
      <Pressable
        onPress={() => setShowProductList((v) => !v)}
        style={({ pressed }) => [
          styles.productPickerBtn,
          { backgroundColor: inputBg, borderColor: inputBorder, opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('salesTarget.selectProducts')}
      >
        <Package size={16} color={textSec} />
        <Text variant="body-sm" style={{ color: textSec, flex: 1, marginLeft: 8 }}>
          {selectedProducts.length === 0 ? t('salesTarget.selectProducts') : t('salesTarget.addRemoveProducts')}
        </Text>
        <ChevronRight
          size={14}
          color={textSec}
          style={{ transform: [{ rotate: showProductList ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {/* Product list — stays open for multi-select */}
      {showProductList && (
        <View style={[styles.productList, { backgroundColor: inputBg, borderColor: inputBorder }]}>
          {products.length === 0 ? (
            <Text variant="body-sm" style={{ color: textSec, textAlign: 'center', padding: 12 }}>
              {t('salesTarget.noProducts')}
            </Text>
          ) : (
            <>
              {products.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                const margin = (product.price ?? 0) - (product.costPrice ?? 0);
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => handleSelectProduct(product.id)}
                    style={({ pressed }) => [
                      styles.productItem,
                      {
                        borderBottomColor: border,
                        backgroundColor: isSelected
                          ? `${ACCENT}12`
                          : pressed
                          ? (isDark ? '#1E2A3A' : staticTheme.colors.gray[50])
                          : 'transparent',
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityLabel={product.name}
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="body-sm" weight="medium" style={{ color: textMain }}>
                        {product.name}
                      </Text>
                      {margin > 0 && (
                        <Text variant="body-xs" style={{ color: textSec, marginTop: 1 }}>
                          ₱{(product.price ?? 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })} selling
                          {' '}·{' '}
                          ₱{margin.toLocaleString('en-PH', { maximumFractionDigits: 0 })} margin/unit
                        </Text>
                      )}
                    </View>
                    {isSelected && <Check size={14} color={ACCENT} />}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setShowProductList(false)}
                style={[styles.doneBtn, { borderTopColor: border }]}
                accessibilityRole="button"
                accessibilityLabel={t('salesTarget.doneSelected', { count: selectedProducts.length })}
              >
                <Text variant="body-sm" weight="semibold" style={{ color: ACCENT }}>
                  {t('salesTarget.doneSelected', { count: selectedProducts.length })}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* ── Save button ── */}
      <Pressable
        onPress={canSave ? handleSave : undefined}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            backgroundColor: canSave
              ? ACCENT
              : (isDark ? DARK_SURFACE : staticTheme.colors.gray[200]),
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('salesTarget.saveTarget')}
        {...(!canSave ? { accessibilityState: { disabled: true } } : {})}
      >
        <Text
          variant="body"
          weight="semibold"
          style={{ color: canSave ? '#FFFFFF' : textSec, textAlign: 'center' }}
        >
          {isSaving ? t('salesTarget.saving') : t('salesTarget.saveTarget')}
        </Text>
      </Pressable>

      {/* Bottom padding for sheet safe area */}
      <View style={{ height: Platform.OS === 'ios' ? 24 : 20 }} />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   10,
  },
  iconPill: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   10,
    borderWidth:    1,
    paddingHorizontal: 14,
    paddingVertical:   Platform.OS === 'ios' ? 14 : 10,
    marginBottom:   12,
  },
  input: {
    flex:     1,
    fontSize: 22,
    fontWeight: '700',
    padding:  0, // remove default Android padding
  },
  previewCard: {
    borderRadius: 10,
    borderWidth:  1,
    paddingHorizontal: 14,
    paddingVertical:    10,
    marginBottom: 4,
  },
  previewDivider: {
    height: 1,
    marginVertical: 8,
  },
  chipsWrapper: {
    gap:         6,
    marginBottom: 8,
  },
  selectedChip: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   8,
    borderWidth:    1,
    paddingHorizontal: 10,
    paddingVertical:    8,
  },
  clearAllBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    borderRadius:   6,
    borderWidth:    1,
    paddingHorizontal: 10,
    paddingVertical:    6,
    marginTop:      2,
  },
  productPickerBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   10,
    borderWidth:    1,
    paddingHorizontal: 14,
    paddingVertical:    12,
    marginBottom:   4,
  },
  productList: {
    borderRadius: 10,
    borderWidth:  1,
    marginBottom: 4,
    overflow:     'hidden',
  },
  productItem: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    paddingVertical:    11,
    borderBottomWidth: 1,
  },
  doneBtn: {
    alignItems:     'center',
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius:   12,
    paddingVertical: 16,
    marginTop:      24,
    alignItems:     'center',
  },
});
