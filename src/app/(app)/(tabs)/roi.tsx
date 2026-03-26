/**
 * ROI Calculator Screen — roi.tsx
 *
 * Full-featured return-on-investment calculator for SME Panindio.
 *
 * Sections (in scroll order):
 *   1. Investment Setup      — equipment + setup costs
 *   2. Monthly Costs         — overhead
 *   3. Product Economics     — cost/unit, selling price, monthly volume, target ROI
 *   4. AI Insight Card       — animated natural language insight
 *   5. Breakeven Analysis    — units + period with visual progress bars
 *   6. Scenario Analysis     — Current / Optimistic / Conservative cards
 *   7. ROI Projection        — month-by-month progress bars (1/3/6/12/24 mo)
 *
 * Data layer: useROIStore (roi.store.ts).
 *
 * TypeScript constraints honoured:
 *   - exactOptionalPropertyTypes: no `prop: undefined`, conditional spread
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
  Platform,
  Animated,
  KeyboardAvoidingView,
  TextInput as RNTextInput,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Calculator,
  ChevronRight,
  DollarSign,
  Package,
  BarChart2,
  TrendingUp,
  Zap,
  RefreshCw,
  Info,
} from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { AIInsightCard } from '@/components/organisms/AIInsightCard';
import { ROIScenarioCard } from '@/components/molecules/ROIScenarioCard';
import { useROIStore, selectROIInputs, selectROIResults, selectROIInsight, selectROILoading, selectROIScenarios } from '@/store/roi.store';
import { useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { ROIInputs } from '@/types/roi.types';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';
const DARK_INPUT_BG = '#1E2435';
const DARK_INPUT_BORDER = 'rgba(255,255,255,0.12)';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBreakeven(months: number, days: number): string {
  if (months === 0 && days === 0) return '—';
  if (months >= 999) return 'Never (unprofitable)';
  const mStr = months > 0 ? `${months} month${months !== 1 ? 's' : ''}` : '';
  const dStr = days  > 0 ? `${days} day${days !== 1 ? 's' : ''}`        : '';
  if (mStr && dStr) return `${mStr} ${dStr}`;
  return mStr || dStr;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── Section container ────────────────────────────────────────────────────────

interface SectionCardProps {
  title:     string;
  icon:      React.ReactNode;
  iconColor: string;
  isDark:    boolean;
  children:  React.ReactNode;
  collapsible?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  iconColor,
  isDark,
  children,
  collapsible = false,
}) => {
  const [expanded, setExpanded] = useState(true);
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  const toggle = useCallback(() => {
    if (!collapsible) return;
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotateAnim, {
      toValue:         next ? 1 : 0,
      duration:        200,
      useNativeDriver: true,
    }).start();
  }, [expanded, collapsible, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const cardBg = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border = isDark ? DARK_BORDER  : staticTheme.colors.borderSubtle;

  return (
    <View style={[sStyles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <Pressable
        style={sStyles.header}
        onPress={toggle}
        {...(collapsible ? {} : { disabled: true })}
      >
        <View style={[sStyles.iconPill, { backgroundColor: `${iconColor}1A` }]}>
          {icon}
        </View>
        <Text
          variant="h6"
          weight="semibold"
          style={{ flex: 1, marginLeft: 10, color: isDark ? DARK_TEXT : staticTheme.colors.text }}
        >
          {title}
        </Text>
        {collapsible && (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ChevronRight size={18} color={isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary} />
          </Animated.View>
        )}
      </Pressable>
      {expanded && <View style={sStyles.body}>{children}</View>}
    </View>
  );
};

const sStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth:  1,
    marginBottom: 12,
    overflow:     'hidden',
    shadowColor:  '#1E4D8C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation:    3,
  },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  iconPill: {
    width:        36,
    height:       36,
    borderRadius: 10,
    alignItems:   'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
});

// ─── Currency input field ─────────────────────────────────────────────────────

interface CurrencyFieldProps {
  label:      string;
  value:      number;
  onChange:   (val: number) => void;
  isDark:     boolean;
  helperText?: string;
  icon?:      React.ReactNode;
}

const CurrencyField: React.FC<CurrencyFieldProps> = ({
  label,
  value,
  onChange,
  isDark,
  helperText,
  icon,
}) => {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setRaw(value === 0 ? '' : String(value));
  }, [value]);

  const inputBg     = isDark ? DARK_INPUT_BG     : '#F8F9FC';
  const inputBorder = isDark ? DARK_INPUT_BORDER  : '#E2E8F0';
  const textColor   = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
  const labelColor  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[700];
  const helperColor = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[500];
  const pesoBg      = isDark ? 'rgba(255,255,255,0.06)'  : staticTheme.colors.gray[100];
  const pesoBorder  = isDark ? DARK_INPUT_BORDER          : '#E2E8F0';
  const pesoColor   = isDark ? 'rgba(255,255,255,0.50)'   : staticTheme.colors.gray[500];

  return (
    <View style={cfStyles.wrapper}>
      <View style={cfStyles.labelRow}>
        {icon && <View style={cfStyles.labelIcon}>{icon}</View>}
        <Text variant="body-sm" weight="medium" style={{ color: labelColor }}>
          {label}
        </Text>
      </View>
      <View style={[cfStyles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
        <View style={[cfStyles.peso, { backgroundColor: pesoBg, borderRightColor: pesoBorder }]}>
          <Text variant="body-sm" weight="semibold" style={{ color: pesoColor }}>₱</Text>
        </View>
        <RNTextInput
          style={[cfStyles.input, { color: textColor }]}
          value={raw}
          onChangeText={setRaw}
          onBlur={() => {
            const parsed = parseFloat(raw.replace(/,/g, ''));
            const num    = isNaN(parsed) ? 0 : parsed;
            onChange(num);
            setRaw(num === 0 ? '' : String(num));
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : staticTheme.colors.gray[400]}
        />
      </View>
      {helperText !== undefined && (
        <Text variant="body-xs" style={{ color: helperColor, marginTop: 3 }}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

const cfStyles = StyleSheet.create({
  wrapper:   { marginBottom: 12 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  labelIcon: { marginRight: 5 },
  inputRow:  {
    flexDirection: 'row',
    alignItems:    'center',
    borderRadius:  10,
    borderWidth:   1,
    overflow:      'hidden',
    height:        48,
  },
  peso: {
    paddingHorizontal: 12,
    height:            '100%',
    alignItems:        'center',
    justifyContent:    'center',
    borderRightWidth:  1,
  },
  input: {
    flex:            1,
    paddingHorizontal: 12,
    fontSize:         16,
    height:           '100%',
  },
});

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  fill:    number; // 0–1
  color:   string;
  height?: number;
  isDark:  boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ fill, color, height = 8, isDark }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue:         clamp(fill, 0, 1),
      duration:        600,
      useNativeDriver: false,
    }).start();
  }, [fill, fillAnim]);

  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100];

  return (
    <View style={[pbStyles.track, { height, backgroundColor: trackBg }]}>
      <Animated.View
        style={[
          pbStyles.fill,
          {
            height,
            backgroundColor: color,
            width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
};

const pbStyles = StyleSheet.create({
  track: { borderRadius: 99, overflow: 'hidden', width: '100%' },
  fill:  { borderRadius: 99 },
});

// ─── ROI projection row ────────────────────────────────────────────────────────

interface ProjectionRowProps {
  monthLabel: string;
  roi:        number;
  isDark:     boolean;
}

const ProjectionRow: React.FC<ProjectionRowProps> = ({ monthLabel, roi, isDark }) => {
  const labelColor  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  const valueColor  = roi >= 0
    ? (isDark ? '#3DD68C' : '#27AE60')
    : (isDark ? '#FF6B6B' : '#FF3B30');
  const barColor = valueColor;

  // Normalise to 0–1 against a ±100% range for the bar
  const fill = clamp((roi + 100) / 200, 0, 1);

  return (
    <View style={projStyles.row}>
      <Text variant="body-sm" weight="medium" style={[projStyles.month, { color: labelColor }]}>
        {monthLabel}
      </Text>
      <View style={projStyles.barWrap}>
        <ProgressBar fill={fill} color={barColor} height={8} isDark={isDark} />
      </View>
      <Text
        variant="body-sm"
        weight="semibold"
        style={[projStyles.value, { color: valueColor }]}
      >
        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
      </Text>
    </View>
  );
};

const projStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  month:   { width: 32, marginRight: 10 },
  barWrap: { flex: 1, marginRight: 10 },
  value:   { width: 62, textAlign: 'right' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ROIScreen() {
  const mode     = useThemeStore(selectThemeMode);
  const isDark   = mode === 'dark';
  const appTheme = useAppTheme();
  const insets   = useSafeAreaInsets();

  // Store
  const inputs    = useROIStore(selectROIInputs);
  const results   = useROIStore(selectROIResults);
  const insight   = useROIStore(selectROIInsight);
  const isLoading = useROIStore(selectROILoading);
  const scenarios = useROIStore(selectROIScenarios);
  const { setROIInputs, computeROI } = useROIStore();

  // Compute on first mount if inputs already set
  const hasComputed = useRef(false);
  useEffect(() => {
    if (!hasComputed.current) {
      hasComputed.current = true;
      computeROI();
    }
  }, [computeROI]);

  // Debounced compute — fires 800ms after last input change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInput = useCallback((partial: Partial<ROIInputs>) => {
    setROIInputs(partial);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => computeROI(), 800);
  }, [setROIInputs, computeROI]);

  // Recalculate button
  const handleRecalculate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    computeROI();
  }, [computeROI]);

  // Derived colors
  const rootBg   = isDark ? DARK_ROOT_BG  : appTheme.colors.background;
  const textPri  = isDark ? DARK_TEXT     : appTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : appTheme.colors.textSecondary;
  const accentGreen  = isDark ? '#3DD68C' : appTheme.colors.success[500];
  const accentAmber  = isDark ? '#FFB020' : appTheme.colors.warning[500];
  const accentBlue   = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const accentPurple = isDark ? '#A78BFA' : '#7C3AED';

  // Projection data
  const projection = useMemo(() => {
    if (!results) return [];
    return [
      { key: '1mo',  label: '1mo',  roi: results.projectedROI[1]  ?? 0 },
      { key: '3mo',  label: '3mo',  roi: results.projectedROI[3]  ?? 0 },
      { key: '6mo',  label: '6mo',  roi: results.projectedROI[6]  ?? 0 },
      { key: '12mo', label: '12mo', roi: results.projectedROI[12] ?? 0 },
      { key: '24mo', label: '24mo', roi: results.projectedROI[24] ?? 0 },
    ];
  }, [results]);

  // Breakeven bar fill (cap at 24 months = full bar)
  const breakevenFill = useMemo(() => {
    if (!results) return 0;
    if (results.breakevenMonths >= 999) return 1;
    return clamp(results.breakevenMonths / 24, 0, 1);
  }, [results]);

  const breakevenBarColor = useMemo(() => {
    if (!results) return accentBlue;
    if (results.breakevenMonths > 18) return isDark ? '#FF6B6B' : appTheme.colors.error[500];
    if (results.breakevenMonths > 12) return accentAmber;
    return accentGreen;
  }, [results, isDark, accentGreen, accentAmber, accentBlue, appTheme]);

  const marginFill = results ? clamp(results.grossMargin / 100, 0, 1) : 0;
  const marginBarColor = results && results.grossMargin >= 20 ? accentGreen : accentAmber;

  const riskLevel = results?.riskLevel ?? 'low';

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <View style={styles.pageHeader}>
            <View style={[styles.pageIconPill, { backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : appTheme.colors.primary[50] }]}>
              <Calculator size={22} color={accentBlue} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text variant="h4" weight="bold" style={{ color: textPri }}>
                ROI Calculator
              </Text>
              <Text variant="body-sm" style={{ color: textSec, marginTop: 2 }}>
                Analyse break-even, margin, and projected returns
              </Text>
            </View>
            <Pressable
              style={[styles.recalcBtn, {
                backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : appTheme.colors.primary[50],
                borderColor:     isDark ? 'rgba(79,158,255,0.25)' : appTheme.colors.primary[100],
              }]}
              onPress={handleRecalculate}
            >
              <RefreshCw size={16} color={accentBlue} />
              <Text variant="body-xs" weight="semibold" style={{ color: accentBlue, marginLeft: 4 }}>
                Recalculate
              </Text>
            </Pressable>
          </View>

          {/* ── 1. Investment Setup ──────────────────────────────────────────── */}
          <SectionCard
            title="Investment Setup"
            icon={<DollarSign size={18} color={accentPurple} />}
            iconColor={accentPurple}
            isDark={isDark}
          >
            <CurrencyField
              label="Equipment Cost"
              value={inputs.equipmentCost}
              onChange={v => handleInput({ equipmentCost: v })}
              isDark={isDark}
              helperText="Machinery, tools, hardware"
            />
            <CurrencyField
              label="Setup / Installation Cost"
              value={inputs.setupCost}
              onChange={v => handleInput({ setupCost: v })}
              isDark={isDark}
              helperText="One-time pre-opening expenses"
            />
            {/* Total investment callout */}
            <View style={[styles.summaryChip, {
              backgroundColor: isDark ? 'rgba(167,139,250,0.10)' : '#F0EEFF',
              borderColor:     isDark ? 'rgba(167,139,250,0.20)' : '#D9D7FF',
            }]}>
              <Text variant="body-xs" style={{ color: textSec }}>Total One-Time Investment</Text>
              <Text variant="body-sm" weight="bold" style={{ color: accentPurple }}>
                {formatCurrency(inputs.equipmentCost + inputs.setupCost)}
              </Text>
            </View>
          </SectionCard>

          {/* ── 2. Monthly Costs ─────────────────────────────────────────────── */}
          <SectionCard
            title="Monthly Costs"
            icon={<Zap size={18} color={accentAmber} />}
            iconColor={accentAmber}
            isDark={isDark}
          >
            <CurrencyField
              label="Monthly Overhead"
              value={inputs.monthlyOverhead}
              onChange={v => handleInput({ monthlyOverhead: v })}
              isDark={isDark}
              helperText="Rent, utilities, salaries, insurance"
            />
            <View style={[styles.infoChip, {
              backgroundColor: isDark ? 'rgba(255,176,32,0.08)' : appTheme.colors.warning[50],
              borderColor:     isDark ? 'rgba(255,176,32,0.20)' : appTheme.colors.warning[100],
            }]}>
              <Info size={12} color={accentAmber} />
              <Text variant="body-xs" style={{ color: textSec, marginLeft: 6, flex: 1 }}>
                Monthly overhead is used to calculate the contribution margin break-even units.
              </Text>
            </View>
          </SectionCard>

          {/* ── 3. Product Economics ─────────────────────────────────────────── */}
          <SectionCard
            title="Product Economics"
            icon={<Package size={18} color={accentGreen} />}
            iconColor={accentGreen}
            isDark={isDark}
          >
            <View style={IS_TABLET ? styles.twoCol : undefined}>
              <View style={IS_TABLET ? styles.colHalf : undefined}>
                <CurrencyField
                  label="Cost Per Unit"
                  value={inputs.costPerUnit}
                  onChange={v => handleInput({ costPerUnit: v })}
                  isDark={isDark}
                  helperText="Variable production / COGS"
                />
              </View>
              <View style={IS_TABLET ? styles.colHalf : undefined}>
                <CurrencyField
                  label="Selling Price"
                  value={inputs.sellingPrice}
                  onChange={v => handleInput({ sellingPrice: v })}
                  isDark={isDark}
                  helperText="Price charged to customers"
                />
              </View>
            </View>

            {/* Volume and target ROI as numeric inputs */}
            <View style={[styles.inlineFieldRow]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <NumericField
                  label="Monthly Volume (units)"
                  value={inputs.monthlyVolume}
                  onChange={v => handleInput({ monthlyVolume: v })}
                  isDark={isDark}
                  suffix="units"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <NumericField
                  label="Target ROI (%)"
                  value={inputs.targetROIPercent}
                  onChange={v => handleInput({ targetROIPercent: v })}
                  isDark={isDark}
                  suffix="%"
                />
              </View>
            </View>

            {/* Contribution margin live preview */}
            {inputs.sellingPrice > 0 && inputs.costPerUnit > 0 && (
              <View style={[styles.marginPreview, {
                backgroundColor: isDark ? 'rgba(61,214,140,0.08)' : appTheme.colors.success[50],
                borderColor:     isDark ? 'rgba(61,214,140,0.20)' : appTheme.colors.success[100],
              }]}>
                <View style={styles.marginPreviewRow}>
                  <Text variant="body-xs" style={{ color: textSec }}>Contribution Margin</Text>
                  <Text variant="body-sm" weight="bold" style={{ color: accentGreen }}>
                    {formatCurrency(inputs.sellingPrice - inputs.costPerUnit)} / unit
                  </Text>
                </View>
                <View style={styles.marginPreviewRow}>
                  <Text variant="body-xs" style={{ color: textSec }}>Gross Margin %</Text>
                  <Text variant="body-sm" weight="bold" style={{ color: accentGreen }}>
                    {((inputs.sellingPrice - inputs.costPerUnit) / inputs.sellingPrice * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </SectionCard>

          {/* ── 4. AI Insight Card ───────────────────────────────────────────── */}
          <AIInsightCard
            insight={insight}
            riskLevel={riskLevel}
            isLoading={isLoading}
            style={{ marginBottom: 12 }}
          />

          {/* ── 5. Breakeven Analysis ────────────────────────────────────────── */}
          {results !== null && (
            <SectionCard
              title="Breakeven Analysis"
              icon={<BarChart2 size={18} color={accentBlue} />}
              iconColor={accentBlue}
              isDark={isDark}
            >
              {/* KPI row */}
              <View style={styles.kpiRow}>
                <KPITile
                  label="Break-even Period"
                  value={formatBreakeven(results.breakevenMonths, results.breakevenDays)}
                  accent={breakevenBarColor}
                  isDark={isDark}
                />
                <KPITile
                  label="Break-even Units/mo"
                  value={results.breakevenUnits >= 9999 ? '∞' : results.breakevenUnits.toLocaleString()}
                  accent={accentBlue}
                  isDark={isDark}
                />
              </View>

              {/* Period progress */}
              <View style={styles.barSection}>
                <View style={styles.barLabelRow}>
                  <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                    Payback Period (target: 18 months max)
                  </Text>
                  <Text variant="body-xs" weight="semibold" style={{ color: breakevenBarColor }}>
                    {results.breakevenMonths >= 999 ? '∞' : `${results.breakevenMonths}mo`}
                  </Text>
                </View>
                <ProgressBar fill={breakevenFill} color={breakevenBarColor} height={10} isDark={isDark} />
                <Text variant="body-xs" style={{ color: textSec, marginTop: 4 }}>
                  {results.breakevenMonths >= 18
                    ? 'Warning: payback period exceeds 18 months.'
                    : `You will recover your investment in ${formatBreakeven(results.breakevenMonths, results.breakevenDays)}.`}
                </Text>
              </View>

              {/* Gross margin bar */}
              <View style={[styles.barSection, { marginTop: 12 }]}>
                <View style={styles.barLabelRow}>
                  <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                    Gross Margin % (target: 20% min)
                  </Text>
                  <Text variant="body-xs" weight="semibold" style={{ color: marginBarColor }}>
                    {results.grossMargin.toFixed(1)}%
                  </Text>
                </View>
                <ProgressBar fill={marginFill} color={marginBarColor} height={10} isDark={isDark} />
                {results.grossMargin < 20 && (
                  <Text variant="body-xs" style={{ color: accentAmber, marginTop: 4 }}>
                    Margin below 20% — consider raising price or reducing cost.
                  </Text>
                )}
              </View>
            </SectionCard>
          )}

          {/* ── 6. Scenario Analysis ─────────────────────────────────────────── */}
          {scenarios !== null && (
            <SectionCard
              title="Scenario Analysis"
              icon={<TrendingUp size={18} color={accentPurple} />}
              iconColor={accentPurple}
              isDark={isDark}
            >
              <Text variant="body-xs" style={{ color: textSec, marginBottom: 12 }}>
                Current price vs. +10% optimistic and −10% conservative scenarios.
              </Text>
              <View style={styles.scenarioRow}>
                <ROIScenarioCard
                  label={scenarios.current.label}
                  roi={scenarios.current.roi}
                  breakevenMonths={scenarios.current.breakevenMonths}
                  unitsNeeded={scenarios.current.unitsNeeded}
                  grossMargin={scenarios.current.grossMargin}
                  riskLevel={scenarios.current.riskLevel}
                  isHighlighted
                  style={{ marginRight: 6 }}
                />
                <ROIScenarioCard
                  label={scenarios.optimistic.label}
                  roi={scenarios.optimistic.roi}
                  breakevenMonths={scenarios.optimistic.breakevenMonths}
                  unitsNeeded={scenarios.optimistic.unitsNeeded}
                  grossMargin={scenarios.optimistic.grossMargin}
                  riskLevel={scenarios.optimistic.riskLevel}
                  style={{ marginHorizontal: 3 }}
                />
                <ROIScenarioCard
                  label={scenarios.conservative.label}
                  roi={scenarios.conservative.roi}
                  breakevenMonths={scenarios.conservative.breakevenMonths}
                  unitsNeeded={scenarios.conservative.unitsNeeded}
                  grossMargin={scenarios.conservative.grossMargin}
                  riskLevel={scenarios.conservative.riskLevel}
                  style={{ marginLeft: 6 }}
                />
              </View>
            </SectionCard>
          )}

          {/* ── 7. ROI Projection Timeline ───────────────────────────────────── */}
          {results !== null && projection.length > 0 && (
            <SectionCard
              title="ROI Projection Timeline"
              icon={<TrendingUp size={18} color={accentGreen} />}
              iconColor={accentGreen}
              isDark={isDark}
            >
              <Text variant="body-xs" style={{ color: textSec, marginBottom: 12 }}>
                Cumulative ROI at key milestones based on your current inputs.
              </Text>
              {projection.map(pt => (
                <ProjectionRow
                  key={pt.key}
                  monthLabel={pt.label}
                  roi={pt.roi}
                  isDark={isDark}
                />
              ))}
              <View style={[styles.projectionNote, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : staticTheme.colors.gray[50],
                borderColor:     isDark ? DARK_BORDER : staticTheme.colors.borderSubtle,
              }]}>
                <Info size={12} color={textSec} />
                <Text variant="body-xs" style={{ color: textSec, marginLeft: 6, flex: 1 }}>
                  Assumes constant monthly volume and price. Adjust inputs to model different scenarios.
                </Text>
              </View>
            </SectionCard>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

interface KPITileProps {
  label:  string;
  value:  string;
  accent: string;
  isDark: boolean;
}

const KPITile: React.FC<KPITileProps> = ({ label, value, accent, isDark }) => {
  const bg    = isDark ? DARK_SURFACE : staticTheme.colors.surfaceSubtle;
  const textC = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const secC  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  return (
    <View style={[kpiStyles.tile, { backgroundColor: bg }]}>
      <View style={[kpiStyles.bar, { backgroundColor: accent }]} />
      <Text variant="body-xs" style={{ color: secC, marginBottom: 4 }}>
        {label}
      </Text>
      <Text variant="h5" weight="bold" style={{ color: textC }}>
        {value}
      </Text>
    </View>
  );
};

const kpiStyles = StyleSheet.create({
  tile: {
    flex:          1,
    borderRadius:  12,
    padding:       12,
    marginRight:    6,
    overflow:      'hidden',
  },
  bar: {
    height:        3,
    borderRadius:  2,
    marginBottom:  8,
    width:         32,
  },
});

// ─── Numeric field ────────────────────────────────────────────────────────────

interface NumericFieldProps {
  label:    string;
  value:    number;
  onChange: (val: number) => void;
  isDark:   boolean;
  suffix?:  string;
}

const NumericField: React.FC<NumericFieldProps> = ({ label, value, onChange, isDark, suffix }) => {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    setRaw(value === 0 ? '' : String(value));
  }, [value]);

  const inputBg     = isDark ? DARK_INPUT_BG     : '#F8F9FC';
  const inputBorder = isDark ? DARK_INPUT_BORDER  : '#E2E8F0';
  const textColor   = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.gray[900];
  const labelColor  = isDark ? 'rgba(255,255,255,0.60)' : staticTheme.colors.gray[700];
  const suffixBg    = isDark ? 'rgba(255,255,255,0.06)'  : staticTheme.colors.gray[100];
  const suffixBorder = isDark ? DARK_INPUT_BORDER          : '#E2E8F0';
  const suffixColor  = isDark ? 'rgba(255,255,255,0.50)'   : staticTheme.colors.gray[500];

  return (
    <View style={cfStyles.wrapper}>
      <Text variant="body-sm" weight="medium" style={[{ color: labelColor }, cfStyles.labelRow]}>
        {label}
      </Text>
      <View style={[cfStyles.inputRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
        <RNTextInput
          style={[cfStyles.input, { color: textColor }]}
          value={raw}
          onChangeText={setRaw}
          onBlur={() => {
            const parsed = parseFloat(raw.replace(/,/g, ''));
            const num    = isNaN(parsed) ? 0 : parsed;
            onChange(num);
            setRaw(num === 0 ? '' : String(num));
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : staticTheme.colors.gray[400]}
        />
        {suffix !== undefined && (
          <View style={[cfStyles.peso, { backgroundColor: suffixBg, borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: suffixBorder }]}>
            <Text variant="body-sm" weight="semibold" style={{ color: suffixColor }}>{suffix}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop:        16,
  },
  pageHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    marginBottom:    16,
  },
  pageIconPill: {
    width:           44,
    height:          44,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  recalcBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:   8,
    paddingHorizontal: 12,
    borderRadius:     20,
    borderWidth:       1,
  },
  summaryChip: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:     10,
    borderWidth:       1,
    marginTop:         4,
  },
  infoChip: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:     10,
    borderWidth:       1,
    marginTop:         4,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  twoCol: {
    flexDirection: 'row',
  },
  colHalf: {
    flex: 1,
    marginRight: 8,
  },
  marginPreview: {
    borderRadius:     10,
    borderWidth:       1,
    paddingVertical:   10,
    paddingHorizontal: 12,
    marginTop:         8,
  },
  marginPreviewRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    4,
  },
  kpiRow: {
    flexDirection:  'row',
    marginBottom:   14,
  },
  barSection: {},
  barLabelRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    marginBottom:    6,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems:    'stretch',
  },
  projectionNote: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:     10,
    borderWidth:       1,
    marginTop:        12,
  },
});
