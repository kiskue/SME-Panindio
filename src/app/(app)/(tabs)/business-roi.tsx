import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  Package,
  Building2,
  Zap,
  Activity,
  Clock,
  Flame,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/atoms/Text';
import { AIInsightCard } from '@/components/organisms/AIInsightCard';
import { ROIMetricTile } from '@/components/molecules/ROIMetricTile';
import { BreakevenProgress } from '@/components/molecules/BreakevenProgress';
import { useShallow } from 'zustand/shallow';
import { useBusinessROIStore } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import { formatDateTime } from '@/core/utils/date';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { ProductROIBreakdown } from '@/types/business_roi.types';

// ─── Color tokens ─────────────────────────────────────────────────────────────

const DARK_CARD_BG  = '#151A27';
const DARK_ROOT_BG  = '#0F0F14';
const DARK_SURFACE  = '#1E2435';
const DARK_BORDER   = 'rgba(255,255,255,0.08)';
const DARK_TEXT     = '#F1F5F9';
const DARK_TEXT_SEC = '#94A3B8';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatROI(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatTimestamp(iso: string | null, t: (key: string) => string): string {
  if (iso === null) return t('businessRoi.neverRefreshed');
  return formatDateTime(iso);
}

function roiHealthColor(roiPercent: number, isDark: boolean): string {
  if (roiPercent >= 20) return isDark ? '#3DD68C' : staticTheme.colors.success[500];
  if (roiPercent >= 10) return isDark ? '#FFB020' : staticTheme.colors.warning[500];
  return isDark ? '#FF6B6B' : staticTheme.colors.error[500];
}

function burnRateTrafficLight(burnRate: number, revenue: number, isDark: boolean): string {
  if (revenue === 0) return isDark ? '#94A3B8' : staticTheme.colors.gray[400];
  const ratio = burnRate / revenue;
  if (ratio > 0.8) return isDark ? '#FF6B6B' : staticTheme.colors.error[500];
  if (ratio > 0.5) return isDark ? '#FFB020' : staticTheme.colors.warning[500];
  return isDark ? '#3DD68C' : staticTheme.colors.success[500];
}

// ─── Animated ROI ring ────────────────────────────────────────────────────────

interface ROIRingProps {
  roiPercent: number;
  isDark:     boolean;
  color:      string;
}

const ROIRing: React.FC<ROIRingProps> = ({ roiPercent, isDark, color }) => {
  const { t }     = useTranslation();
  const ringAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ringAnim, { toValue: 1, duration: 900, useNativeDriver: true, delay: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true, delay: 150 }),
    ]).start();
  }, [ringAnim, scaleAnim]);

  const ringBg   = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];
  const labelBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const textMain = isDark ? DARK_TEXT     : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const returnLabel = roiPercent >= 20
    ? t('businessRoi.healthyReturn')
    : roiPercent >= 10
    ? t('businessRoi.moderateReturn')
    : t('businessRoi.needsImprovement');

  return (
    <Animated.View
      style={[
        styles.roiRingOuter,
        { backgroundColor: ringBg, borderColor: color, opacity: ringAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <View style={[styles.roiRingInner, { backgroundColor: labelBg }]}>
        <View style={[styles.roiGlowDot, { backgroundColor: color }]} />
        <Text variant="h2" weight="bold" style={{ color, letterSpacing: -1 }}>
          {formatROI(roiPercent)}
        </Text>
        <Text variant="body-xs" weight="medium" style={{ color: textSec, marginTop: 2 }}>
          {t('businessRoi.title')}
        </Text>
        <Text variant="body-xs" weight="normal" style={{ color: textMain, marginTop: 4 }}>
          {returnLabel}
        </Text>
      </View>
    </Animated.View>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width:   number | `${number}%`;
  height:  number;
  radius?: number;
  isDark:  boolean;
}

const Skeleton = React.memo<SkeletonProps>(({ width, height, radius = 8, isDark: _isDark }) => (
  <SkeletonBox width={width} height={height} borderRadius={radius} />
));

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title:  string;
  icon:   React.ReactNode;
  color:  string;
  isDark: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, color, isDark }) => {
  const textMain = isDark ? DARK_TEXT : staticTheme.colors.text;
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconPill, { backgroundColor: `${color}1A` }]}>{icon}</View>
      <Text variant="h6" weight="semibold" style={{ color: textMain, marginLeft: 8 }}>
        {title}
      </Text>
    </View>
  );
};

// ─── Empty-state step row ─────────────────────────────────────────────────────

interface EmptyStepProps {
  number:      string;
  icon:        React.ReactNode;
  accentColor: string;
  title:       string;
  description: string;
  isDark:      boolean;
}

const EmptyStep = React.memo<EmptyStepProps>(({ number, icon, accentColor, title, description, isDark }) => {
  const textMain = isDark ? DARK_TEXT     : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  const border   = isDark ? DARK_BORDER   : staticTheme.colors.border;
  return (
    <View style={[styles.emptyStep, { borderColor: border }]}>
      <View style={[styles.emptyStepIcon, { backgroundColor: `${accentColor}1A` }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body-sm" weight="semibold" style={{ color: textMain }}>
          {title}
        </Text>
        <Text variant="body-xs" style={{ color: textSec, marginTop: 2, lineHeight: 17 }}>
          {description}
        </Text>
      </View>
      <View style={[styles.emptyStepBadge, { backgroundColor: `${accentColor}1A` }]}>
        <Text variant="body-xs" weight="bold" style={{ color: accentColor }}>
          {number}
        </Text>
      </View>
    </View>
  );
});

// ─── Product row ──────────────────────────────────────────────────────────────

interface ProductRowProps {
  rank:       number;
  product:    ProductROIBreakdown;
  maxRevenue: number;
  isDark:     boolean;
}

const ProductRow = React.memo<ProductRowProps>(({ rank, product, maxRevenue, isDark }) => {
  const { t }   = useTranslation();
  const cardBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border  = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const rankColors = ['#FFB020', '#94A3B8', '#CD7F32'] as const;
  const rankColor  = rankColors[(rank - 1) % 3] ?? rankColors[0];
  const barRatio   = maxRevenue > 0 ? product.revenue / maxRevenue : 0;
  const fillColor  = rank === 1
    ? (isDark ? '#4F9EFF' : staticTheme.colors.primary[500])
    : (isDark ? '#3DD68C' : staticTheme.colors.success[500]);
  const marginPct = product.revenue > 0
    ? ((product.contributionMargin / product.revenue) * 100).toFixed(1)
    : '0.0';

  return (
    <View style={[styles.productRow, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[styles.rankBadge, { backgroundColor: `${rankColor}1A` }]}>
        <Text variant="body-xs" weight="bold" style={{ color: rankColor }}>#{rank}</Text>
      </View>
      <View style={styles.productInfo}>
        <View style={styles.productNameRow}>
          <Text variant="body-sm" weight="semibold" style={{ color: textMain, flex: 1 }} numberOfLines={1}>
            {product.name}
          </Text>
          <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
            {t('businessRoi.productUnits', { count: product.unitsSold.toLocaleString('en-PH') })}
          </Text>
        </View>
        <ProgressBar
          fraction={barRatio}
          color={fillColor}
          trackColor={isDark ? DARK_SURFACE : staticTheme.colors.gray[100]}
          height={5}
          radius={3}
          style={{ marginBottom: 4 }}
        />
        <View style={styles.productMetaRow}>
          <Text variant="body-xs" style={{ color: fillColor, fontWeight: '600' }}>
            {formatCurrency(product.revenue, { abs: true, decimals: 0 })}
          </Text>
          <Text variant="body-xs" style={{ color: textSec }}>
            {t('businessRoi.productMargin', { pct: marginPct })}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── Payback Timeline ─────────────────────────────────────────────────────────

interface PaybackTimelineProps {
  paybackPeriodMonths:     number;
  estimatedMonthsToTarget: number;
  isDark:                  boolean;
}

const PaybackTimeline = React.memo<PaybackTimelineProps>(({
  paybackPeriodMonths,
  estimatedMonthsToTarget,
  isDark,
}) => {
  const { t }   = useTranslation();
  const cardBg  = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border  = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT   : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;
  const trackBg  = isDark ? DARK_SURFACE : staticTheme.colors.gray[100];

  const currentMonth = 1;
  const maxMonths    = paybackPeriodMonths >= 999 ? 36 : Math.max(paybackPeriodMonths, 12);
  const currentRatio = Math.min(1, currentMonth / maxMonths);
  const paybackRatio = paybackPeriodMonths >= 999 ? 1 : Math.min(1, paybackPeriodMonths / maxMonths);

  const paybackColor = paybackPeriodMonths <= 12
    ? (isDark ? '#3DD68C' : staticTheme.colors.success[500])
    : paybackPeriodMonths <= 24
    ? (isDark ? '#FFB020' : staticTheme.colors.warning[500])
    : (isDark ? '#FF6B6B' : staticTheme.colors.error[500]);

  const paybackLabel = paybackPeriodMonths >= 999
    ? t('businessRoi.notProjectable')
    : t('businessRoi.paybackMonths', { months: paybackPeriodMonths.toFixed(0) });

  const targetLabel = estimatedMonthsToTarget >= 999
    ? t('businessRoi.notProjectable')
    : t('businessRoi.monthsToROI', { months: estimatedMonthsToTarget });

  return (
    <View style={[styles.timelineCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.timelineHeaderRow}>
        <Clock size={14} color={paybackColor} />
        <Text variant="body-sm" weight="semibold" style={{ color: textMain, marginLeft: 6, flex: 1 }}>
          {t('businessRoi.paybackTimeline')}
        </Text>
        <View style={[styles.paybackBadge, { backgroundColor: `${paybackColor}1A` }]}>
          <Text variant="body-xs" weight="bold" style={{ color: paybackColor }}>{paybackLabel}</Text>
        </View>
      </View>

      <View style={[styles.timelineTrack, { backgroundColor: trackBg }]}>
        <View style={[styles.timelineCurrentMarker, { left: `${Math.round(currentRatio * 100)}%` as `${number}%`, backgroundColor: isDark ? '#4F9EFF' : staticTheme.colors.primary[500] }]} />
        {paybackPeriodMonths < 999 && (
          <View style={[styles.timelineTargetMarker, { left: `${Math.round(paybackRatio * 100)}%` as `${number}%`, backgroundColor: paybackColor }]} />
        )}
        <View style={[styles.timelineFill, { width: `${Math.round(currentRatio * 100)}%` as `${number}%`, backgroundColor: isDark ? '#4F9EFF' : staticTheme.colors.primary[500] }]} />
      </View>

      <View style={styles.timelineLabelRow}>
        <Text variant="body-xs" style={{ color: textSec }}>{t('businessRoi.monthLabel', { n: 1 })}</Text>
        <Text variant="body-xs" style={{ color: textSec }}>{t('businessRoi.monthLabel', { n: Math.round(maxMonths) })}</Text>
      </View>
      <Text variant="body-xs" style={{ color: textSec, marginTop: 6, lineHeight: 17 }}>
        {targetLabel}
      </Text>
    </View>
  );
});

// ─── Monthly Burn Card ────────────────────────────────────────────────────────

interface BurnRateCardProps {
  monthlyBurnRate:     number;
  monthlyOverheadAvg:  number;
  monthlyUtilitiesAvg: number;
  totalRevenue:        number;
  elapsedMonths:       number;
  isDark:              boolean;
}

const BurnRateCard = React.memo<BurnRateCardProps>(({
  monthlyBurnRate,
  monthlyOverheadAvg,
  monthlyUtilitiesAvg,
  totalRevenue,
  elapsedMonths,
  isDark,
}) => {
  const { t }      = useTranslation();
  const cardBg     = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border     = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain   = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec    = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  const monthlyRevenue      = elapsedMonths > 0 ? totalRevenue / elapsedMonths : 0;
  const lightColor          = burnRateTrafficLight(monthlyBurnRate, monthlyRevenue, isDark);
  const monthlyCOGSEstimate = monthlyBurnRate - monthlyOverheadAvg - monthlyUtilitiesAvg;

  const burnRows = [
    { label: t('businessRoi.overheadAvg'),  value: monthlyOverheadAvg,               icon: <Building2 size={13} color={lightColor} /> },
    { label: t('businessRoi.utilitiesAvg'), value: monthlyUtilitiesAvg,              icon: <Zap       size={13} color={lightColor} /> },
    { label: t('businessRoi.cogsEstimate'), value: Math.max(0, monthlyCOGSEstimate), icon: <Package   size={13} color={lightColor} /> },
  ];

  return (
    <View style={[styles.burnCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[styles.burnTopBar, { backgroundColor: lightColor }]} />
      <View style={styles.burnInner}>
        <View style={styles.burnHeaderRow}>
          <View style={[styles.burnIconPill, { backgroundColor: `${lightColor}1A` }]}>
            <Flame size={14} color={lightColor} />
          </View>
          <Text variant="h6" weight="semibold" style={{ color: textMain, marginLeft: 8, flex: 1 }}>
            {t('businessRoi.monthlyBurnRate')}
          </Text>
          <Text variant="h5" weight="bold" style={{ color: lightColor }}>
            {formatCurrency(monthlyBurnRate, { abs: true, decimals: 0 })}
          </Text>
        </View>

        {burnRows.map((row) => (
          <View key={row.label} style={styles.burnRow}>
            {row.icon}
            <Text variant="body-xs" style={{ color: textSec, flex: 1, marginLeft: 6 }}>{row.label}</Text>
            <Text variant="body-xs" weight="semibold" style={{ color: textMain }}>
              {formatCurrency(row.value, { abs: true, decimals: 0 })}
            </Text>
          </View>
        ))}

        {monthlyRevenue > 0 && (
          <Text variant="body-xs" style={{ color: textSec, marginTop: 8, lineHeight: 17 }}>
            {t('businessRoi.monthlyRevenueLabel', {
              amount: formatCurrency(monthlyRevenue, { abs: true, decimals: 0 }),
              status: monthlyBurnRate > monthlyRevenue
                ? t('businessRoi.burnExceeds')
                : t('businessRoi.marginRemaining', { pct: ((1 - monthlyBurnRate / monthlyRevenue) * 100).toFixed(0) }),
            })}
          </Text>
        )}
      </View>
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BusinessROIScreen() {
  const { t }    = useTranslation();
  const mode     = useThemeMode();
  const isDark   = mode === 'dark';
  const appTheme = useAppTheme();
  const insets   = useSafeAreaInsets();

  // Single subscription — one re-render per store update instead of 7.
  // useShallow does element-wise equality so primitives and stable action refs
  // don't cause phantom re-renders when unrelated slices change.
  const {
    isLoading,
    roiPercent,
    aiInsight,
    riskLevel,
    lastRefreshed,
    error,
    totalInventoryValue,
    totalEquipmentCost,
    totalOverheadAllTime,
    totalUtilitiesAllTime,
    totalInvestment,
    totalRevenue,
    totalCOGS,
    netProfit,
    grossMarginPercent,
    breakevenUnits,
    unitsSoldToDate,
    unitsStillNeeded,
    paybackPeriodMonths,
    estimatedMonthsToTarget,
    monthlyBurnRate,
    monthlyOverheadAvg,
    monthlyUtilitiesAvg,
    productBreakdown,
    forceRefreshBusinessROI,
  } = useBusinessROIStore(
    useShallow((s) => ({
      isLoading:                s.isLoading,
      roiPercent:               s.roiPercent,
      aiInsight:                s.aiInsight,
      riskLevel:                s.riskLevel,
      lastRefreshed:            s.lastRefreshed,
      error:                    s.error,
      totalInventoryValue:      s.totalInventoryValue,
      totalEquipmentCost:       s.totalEquipmentCost,
      totalOverheadAllTime:     s.totalOverheadAllTime,
      totalUtilitiesAllTime:    s.totalUtilitiesAllTime,
      totalInvestment:          s.totalInvestment,
      totalRevenue:             s.totalRevenue,
      totalCOGS:                s.totalCOGS,
      netProfit:                s.netProfit,
      grossMarginPercent:       s.grossMarginPercent,
      breakevenUnits:           s.breakevenUnits,
      unitsSoldToDate:          s.unitsSoldToDate,
      unitsStillNeeded:         s.unitsStillNeeded,
      paybackPeriodMonths:      s.paybackPeriodMonths,
      estimatedMonthsToTarget:  s.estimatedMonthsToTarget,
      monthlyBurnRate:          s.monthlyBurnRate,
      monthlyOverheadAvg:       s.monthlyOverheadAvg,
      monthlyUtilitiesAvg:      s.monthlyUtilitiesAvg,
      productBreakdown:         s.productBreakdown,
      forceRefreshBusinessROI:  s.forceRefreshBusinessROI,
    })),
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const healthColor   = roiHealthColor(roiPercent, isDark);
  const elapsedMonths = useMemo(() => Math.max(1, new Date().getMonth() + 1), []);
  const maxProductRev = productBreakdown[0]?.revenue ?? 1;

  const hasData = useMemo(
    () => totalRevenue > 0 || totalInvestment > 0 || unitsSoldToDate > 0,
    [totalRevenue, totalInvestment, unitsSoldToDate],
  );

  // neverComputed: first frame before useFocusEffect fires — show skeletons
  // immediately so the screen never flashes the empty state on mount.
  // An error clears the flag so we don't skeleton-lock after a failed attempt.
  const neverComputed  = lastRefreshed === null && !isLoading && error === null;
  const showSkeletons  = isLoading || neverComputed;
  // Only show the "no data" empty state after a successful computation with no data.
  // When there is an error, the error banner in the header card handles feedback.
  const showEmptyState = !showSkeletons && !hasData && error === null;
  const showSections   = showSkeletons || hasData;

  // ── Entrance animation ────────────────────────────────────────────────────
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const hasAnimated  = useRef(false);

  useEffect(() => {
    if (!showSkeletons && !hasAnimated.current) {
      hasAnimated.current = true;
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }
  }, [showSkeletons, fadeAnim]);

  // ── Focus refresh ─────────────────────────────────────────────────────────
  // Keep the latest lastRefreshed in a ref so the focus callback can read it
  // without being listed as a dep (which would recreate the callback and
  // re-trigger the useFocusEffect on every refresh completion).
  const lastRefreshedRef = useRef(lastRefreshed);
  useEffect(() => {
    lastRefreshedRef.current = lastRefreshed;
  }, [lastRefreshed]);

  // Use forceRefreshBusinessROI (no isLoading guard) so the very first open
  // is never silently dropped.
  // The 5-minute stale window prevents redundant re-computation on tab switches.
  useFocusEffect(
    useCallback(() => {
      const now    = Date.now();
      const lastMs = lastRefreshedRef.current !== null
        ? new Date(lastRefreshedRef.current).getTime()
        : 0;
      if (now - lastMs > 5 * 60 * 1000) {
        forceRefreshBusinessROI();
      }
    }, [forceRefreshBusinessROI]),
  );

  const mappedRiskLevel: 'low' | 'medium' | 'high' =
    riskLevel === 'low' ? 'low' : riskLevel === 'medium' ? 'medium' : 'high';

  // ── Theme ─────────────────────────────────────────────────────────────────
  const rootBg   = isDark ? DARK_ROOT_BG : staticTheme.colors.background;
  const cardBg   = isDark ? DARK_CARD_BG : '#FFFFFF';
  const border   = isDark ? DARK_BORDER  : staticTheme.colors.border;
  const textMain = isDark ? DARK_TEXT    : staticTheme.colors.text;
  const textSec  = isDark ? DARK_TEXT_SEC : staticTheme.colors.textSecondary;

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={forceRefreshBusinessROI}
            tintColor={healthColor}
            colors={[healthColor]}
          />
        }
      >
        {/* ── 1. Header card ──────────────────────────────────────────────── */}
        <View style={[styles.headerCard, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={[styles.headerAccentBar, { backgroundColor: healthColor }]} />
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconPill, { backgroundColor: `${healthColor}1A` }]}>
                <Activity size={16} color={healthColor} />
              </View>
              <Text variant="h5" weight="bold" style={{ color: textMain, marginLeft: 10 }}>
                {t('businessRoi.title')}
              </Text>
            </View>

            <Pressable
              onPress={forceRefreshBusinessROI}
              style={({ pressed }) => [
                styles.refreshBtn,
                { backgroundColor: `${healthColor}1A`, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityLabel={t('businessRoi.refresh')}
              accessibilityRole="button"
            >
              <RefreshCw size={14} color={healthColor} />
              <Text variant="body-xs" weight="semibold" style={{ color: healthColor, marginLeft: 4 }}>
                {t('businessRoi.refresh')}
              </Text>
            </Pressable>
          </View>

          <Text variant="body-xs" style={{ color: textSec, paddingHorizontal: 14, paddingBottom: 12 }}>
            {t('businessRoi.lastUpdated', { time: formatTimestamp(lastRefreshed, t) })}
          </Text>

          {error !== null && (
            <View style={[styles.errorBanner, { backgroundColor: `${staticTheme.colors.error[500]}1A` }]}>
              <Text variant="body-xs" style={{ color: isDark ? '#FF6B6B' : staticTheme.colors.error[600] }}>
                {error}
              </Text>
            </View>
          )}
        </View>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {showEmptyState && (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: border }]}>
            {/* Icon */}
            <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[50] }]}>
              <TrendingUp size={32} color={isDark ? DARK_TEXT_SEC : staticTheme.colors.gray[300]} />
            </View>

            <Text variant="h6" weight="bold" style={{ color: textMain, marginTop: 16, textAlign: 'center' }}>
              {t('businessRoi.noDataTitle')}
            </Text>
            <Text variant="body-sm" style={{ color: textSec, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
              {t('businessRoi.noDataSubtitle')}
            </Text>

            {/* Step guide */}
            <View style={styles.emptyStepList}>
              <EmptyStep
                number="1"
                icon={<Package size={16} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />}
                accentColor={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
                title={t('businessRoi.step1Title')}
                description={t('businessRoi.step1Desc')}
                isDark={isDark}
              />
              <EmptyStep
                number="2"
                icon={<Building2 size={16} color={isDark ? '#A78BFA' : '#7C3AED'} />}
                accentColor={isDark ? '#A78BFA' : '#7C3AED'}
                title={t('businessRoi.step2Title')}
                description={t('businessRoi.step2Desc')}
                isDark={isDark}
              />
              <EmptyStep
                number="3"
                icon={<DollarSign size={16} color={isDark ? '#3DD68C' : appTheme.colors.success[500]} />}
                accentColor={isDark ? '#3DD68C' : appTheme.colors.success[500]}
                title={t('businessRoi.step3Title')}
                description={t('businessRoi.step3Desc')}
                isDark={isDark}
              />
            </View>

            {/* Pull-to-refresh hint */}
            <View style={[styles.emptyRefreshHint, { borderColor: isDark ? DARK_BORDER : staticTheme.colors.border }]}>
              <RefreshCw size={12} color={textSec} />
              <Text variant="body-xs" style={{ color: textSec, marginLeft: 6 }}>
                {t('businessRoi.pullToRefresh')}
              </Text>
            </View>
          </View>
        )}

        {/* ── Sections 2–9: skeletons while loading, full UI once data exists ── */}
        {showSections && (
          <>
            {/* ── 2. ROI Hero ───────────────────────────────────────────── */}
            <View style={styles.heroSection}>
              {showSkeletons ? (
                <View style={styles.heroSkeleton}>
                  <Skeleton width={160} height={160} radius={80} isDark={isDark} />
                </View>
              ) : (
                <ROIRing roiPercent={roiPercent} isDark={isDark} color={healthColor} />
              )}

              {!showSkeletons && (
                <View style={styles.heroPillRow}>
                  <View style={[styles.heroPill, { backgroundColor: `${healthColor}1A` }]}>
                    {roiPercent >= 20
                      ? <TrendingUp  size={12} color={healthColor} />
                      : <TrendingDown size={12} color={healthColor} />
                    }
                    <Text variant="body-xs" weight="semibold" style={{ color: healthColor, marginLeft: 4 }}>
                      {riskLevel === 'low'
                        ? t('businessRoi.riskLow')
                        : riskLevel === 'medium'
                        ? t('businessRoi.riskMedium')
                        : t('businessRoi.riskHigh')}
                    </Text>
                  </View>
                  <View style={[styles.heroPill, { backgroundColor: isDark ? DARK_SURFACE : staticTheme.colors.gray[100] }]}>
                    <Text variant="body-xs" weight="medium" style={{ color: textSec }}>
                      {t('businessRoi.grossMarginLabel', { pct: grossMarginPercent.toFixed(1) })}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── 3. Investment Breakdown ───────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.investmentBreakdown')}
              icon={<Package size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />}
              color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
              isDark={isDark}
            />

            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={[styles.twoByTwo, { gap: IS_TABLET ? 12 : 10 }]}>
                <View style={[styles.tileHalf, { gap: IS_TABLET ? 12 : 10 }]}>
                  {showSkeletons
                    ? <Skeleton width="100%" height={90} isDark={isDark} />
                    : <ROIMetricTile label={t('businessRoi.inventoryValue')} value={formatCurrency(totalInventoryValue, { abs: true, decimals: 0 })} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />
                  }
                  {showSkeletons
                    ? <Skeleton width="100%" height={90} isDark={isDark} />
                    : <ROIMetricTile label={t('businessRoi.totalOverhead')} value={formatCurrency(totalOverheadAllTime, { abs: true, decimals: 0 })} color={isDark ? '#A78BFA' : '#7C3AED'} />
                  }
                </View>
                <View style={[styles.tileHalf, { gap: IS_TABLET ? 12 : 10 }]}>
                  {showSkeletons
                    ? <Skeleton width="100%" height={90} isDark={isDark} />
                    : <ROIMetricTile label={t('businessRoi.equipmentCostLabel')} value={formatCurrency(totalEquipmentCost, { abs: true, decimals: 0 })} color={isDark ? '#FFB020' : appTheme.colors.highlight[400]} />
                  }
                  {showSkeletons
                    ? <Skeleton width="100%" height={90} isDark={isDark} />
                    : <ROIMetricTile label={t('businessRoi.totalUtilities')} value={formatCurrency(totalUtilitiesAllTime, { abs: true, decimals: 0 })} color={isDark ? '#FB923C' : '#EA580C'} />
                  }
                </View>
              </View>

              <View style={{ marginTop: IS_TABLET ? 12 : 10 }}>
                {showSkeletons
                  ? <Skeleton width="100%" height={80} isDark={isDark} />
                  : (
                    <ROIMetricTile
                      label={t('businessRoi.totalInvestment')}
                      value={formatCurrency(totalInvestment, { abs: true, decimals: 0 })}
                      subValue={t('businessRoi.investmentSubValue')}
                      highlight
                      color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
                    />
                  )
                }
              </View>
            </Animated.View>

            {/* ── 4. Revenue & Profit ───────────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.revenueProfit')}
              icon={<DollarSign size={15} color={isDark ? '#3DD68C' : appTheme.colors.success[500]} />}
              color={isDark ? '#3DD68C' : appTheme.colors.success[500]}
              isDark={isDark}
            />

            <Animated.View style={[styles.threeRow, { opacity: fadeAnim, gap: IS_TABLET ? 12 : 10 }]}>
              {showSkeletons ? (
                <>
                  <Skeleton width="31%" height={90} isDark={isDark} />
                  <Skeleton width="31%" height={90} isDark={isDark} />
                  <Skeleton width="31%" height={90} isDark={isDark} />
                </>
              ) : (
                <>
                  <View style={styles.tileTertiary}>
                    <ROIMetricTile
                      label={t('businessRoi.totalRevenue')}
                      value={formatCurrency(totalRevenue, { abs: true, decimals: 0 })}
                      trend={totalRevenue > 0 ? 'up' : 'neutral'}
                      color={isDark ? '#3DD68C' : appTheme.colors.success[500]}
                    />
                  </View>
                  <View style={styles.tileTertiary}>
                    <ROIMetricTile
                      label={t('businessRoi.totalCOGS')}
                      value={formatCurrency(totalCOGS, { abs: true, decimals: 0 })}
                      trend="down"
                      color={isDark ? '#FF6B6B' : appTheme.colors.error[500]}
                    />
                  </View>
                  <View style={styles.tileTertiary}>
                    <ROIMetricTile
                      label={t('businessRoi.netProfit')}
                      value={`${netProfit < 0 ? '-' : ''}${formatCurrency(netProfit, { abs: true, decimals: 0 })}`}
                      {...(netProfit >= 0
                        ? { trend: 'up',   color: isDark ? '#3DD68C' : appTheme.colors.success[500] }
                        : { trend: 'down', color: isDark ? '#FF6B6B' : appTheme.colors.error[500]   }
                      )}
                      highlight
                    />
                  </View>
                </>
              )}
            </Animated.View>

            {/* ── 5. AI Insight ─────────────────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.aiInsightSection')}
              icon={<Activity size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[400]} />}
              color={isDark ? '#4F9EFF' : appTheme.colors.primary[400]}
              isDark={isDark}
            />
            <AIInsightCard
              insight={aiInsight}
              riskLevel={mappedRiskLevel}
              isLoading={showSkeletons}
              style={{ marginBottom: 20 }}
            />

            {/* ── 6. Breakeven Progress ─────────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.breakevenProgress')}
              icon={<TrendingUp size={15} color={healthColor} />}
              color={healthColor}
              isDark={isDark}
            />
            {showSkeletons ? (
              <Skeleton width="100%" height={110} isDark={isDark} />
            ) : (
              <BreakevenProgress
                unitsSold={unitsSoldToDate}
                breakevenUnits={breakevenUnits}
                style={{ marginBottom: 20 }}
              />
            )}
            {!showSkeletons && unitsStillNeeded > 0 && (
              <View style={[styles.calloutBanner, { backgroundColor: `${healthColor}0D`, borderColor: `${healthColor}33` }]}>
                <TrendingUp size={14} color={healthColor} />
                <Text variant="body-xs" weight="medium" style={{ color: healthColor, marginLeft: 8, flex: 1 }}>
                  {t('businessRoi.sellMoreUnits', { units: unitsStillNeeded.toLocaleString('en-PH') })}
                </Text>
              </View>
            )}

            {/* ── 7. Product ROI Breakdown ──────────────────────────────── */}
            {productBreakdown.length > 0 && (
              <>
                <SectionHeader
                  title={t('businessRoi.topProducts')}
                  icon={<Package size={15} color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]} />}
                  color={isDark ? '#4F9EFF' : appTheme.colors.primary[500]}
                  isDark={isDark}
                />
                <View style={styles.productList}>
                  {productBreakdown.map((product, i) => (
                    <ProductRow
                      key={product.name}
                      rank={i + 1}
                      product={product}
                      maxRevenue={maxProductRev}
                      isDark={isDark}
                    />
                  ))}
                </View>
              </>
            )}

            {/* ── 8. Payback Timeline ───────────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.paybackTimeline')}
              icon={<Clock size={15} color={isDark ? '#A78BFA' : '#7C3AED'} />}
              color={isDark ? '#A78BFA' : '#7C3AED'}
              isDark={isDark}
            />
            {showSkeletons ? (
              <Skeleton width="100%" height={100} isDark={isDark} />
            ) : (
              <PaybackTimeline
                paybackPeriodMonths={paybackPeriodMonths}
                estimatedMonthsToTarget={estimatedMonthsToTarget}
                isDark={isDark}
              />
            )}

            {/* ── 9. Monthly Burn Rate ──────────────────────────────────── */}
            <SectionHeader
              title={t('businessRoi.monthlyBurnRate')}
              icon={<Flame size={15} color={isDark ? '#FB923C' : '#EA580C'} />}
              color={isDark ? '#FB923C' : '#EA580C'}
              isDark={isDark}
            />
            {showSkeletons ? (
              <Skeleton width="100%" height={130} isDark={isDark} />
            ) : (
              <BurnRateCard
                monthlyBurnRate={monthlyBurnRate}
                monthlyOverheadAvg={monthlyOverheadAvg}
                monthlyUtilitiesAvg={monthlyUtilitiesAvg}
                totalRevenue={totalRevenue}
                elapsedMonths={elapsedMonths}
                isDark={isDark}
              />
            )}

            <View style={{ height: 8 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },

  // ── Header card ─────────────────────────────────────────────────────────────
  headerCard: {
    borderRadius: 12,
    borderWidth:  1,
    overflow:     'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  headerAccentBar: { height: 3 },
  headerInner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:         14,
    paddingBottom:    8,
  },
  headerLeft:     { flexDirection: 'row', alignItems: 'center' },
  headerIconPill: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  refreshBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    6,
    paddingHorizontal: 12,
    borderRadius:      20,
  },
  errorBanner: { marginHorizontal: 14, marginBottom: 10, padding: 10, borderRadius: 8 },

  // ── Empty state ──────────────────────────────────────────────────────────────
  emptyCard: {
    borderRadius:      16,
    borderWidth:        1,
    alignItems:        'center',
    paddingVertical:    36,
    paddingHorizontal:  20,
    marginBottom:       24,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  emptyIconWrap: {
    width:          72,
    height:         72,
    borderRadius:   36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyStepList: { width: '100%', marginTop: 20, gap: 10 },
  emptyStep: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   12,
    paddingHorizontal: 14,
    borderRadius:      12,
    borderWidth:        1,
  },
  emptyStepIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emptyStepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyRefreshHint: {
    flexDirection:     'row',
    alignItems:        'center',
    marginTop:         16,
    paddingVertical:    8,
    paddingHorizontal: 14,
    borderRadius:      20,
    borderWidth:        1,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────────
  heroSection:  { alignItems: 'center', marginBottom: 24 },
  heroSkeleton: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  heroPillRow:  { flexDirection: 'row', gap: 8, marginTop: 14 },
  heroPill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:    5,
    paddingHorizontal: 12,
    borderRadius:      20,
  },

  // ── ROI ring ─────────────────────────────────────────────────────────────────
  roiRingOuter: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', marginVertical: 8,
  },
  roiRingInner: {
    width: 136, height: 136, borderRadius: 68,
    alignItems: 'center', justifyContent: 'center',
  },
  roiGlowDot: { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4 },

  // ── Section header ────────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 20 },
  sectionIconPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // ── 2×2 grid ─────────────────────────────────────────────────────────────────
  twoByTwo: { flexDirection: 'row' },
  tileHalf: { flex: 1 },

  // ── 3-column row ─────────────────────────────────────────────────────────────
  threeRow:    { flexDirection: 'row', marginBottom: 20 },
  tileTertiary: { flex: 1 },

  // ── Product list ──────────────────────────────────────────────────────────────
  productList: { gap: 8, marginBottom: 20 },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, padding: 12, gap: 10,
  },
  rankBadge:   { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  miniTrack:   { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  miniFill:    { height: 5, borderRadius: 3 },
  productMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // ── Payback timeline ──────────────────────────────────────────────────────────
  timelineCard:      { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  paybackBadge:      { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  timelineTrack:     { height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  timelineFill:      { height: 8, borderRadius: 4, position: 'absolute', left: 0, top: 0, bottom: 0 },
  timelineCurrentMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, zIndex: 2 },
  timelineTargetMarker:  { position: 'absolute', top: -2, bottom: -2, width: 2, zIndex: 3, borderRadius: 1 },
  timelineLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },

  // ── Burn rate card ────────────────────────────────────────────────────────────
  burnCard:      { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  burnTopBar:    { height: 3 },
  burnInner:     { padding: 14 },
  burnHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  burnIconPill:  { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  burnRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },

  // ── Callout banner ────────────────────────────────────────────────────────────
  calloutBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 12,
    marginBottom: 16, marginTop: -10,
  },
});
