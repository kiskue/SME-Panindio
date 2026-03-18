/**
 * Raw Materials List Screen — Premium Redesign
 *
 * Layout:
 *   1. Header — "Raw Materials" + item count subtitle + "+ New Material" button
 *   2. Low-stock alert banner (dismissible, amber) — conditional
 *   3. Hero stats row — Total Items | Low Stock | Stock Value
 *   4. Search bar (always visible)
 *   5. Category filter chips (horizontal scroll)
 *   6. FlatList of RawMaterialCard
 *
 * Full dark mode via useAppTheme() + useThemeStore(selectThemeMode).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Plus,
  Package,
  AlertTriangle,
  TrendingDown,
  PhilippinePeso,
  X,
  Search,
  ClipboardList,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { Text } from '@/components/atoms/Text';
import { RawMaterialCard } from '@/components/molecules/RawMaterialCard';
import { StockAdjustModal } from '@/components/molecules/StockAdjustModal';
import { theme as staticTheme } from '@/core/theme';
import { useAppTheme } from '@/core/theme';
import { useThemeStore, selectThemeMode } from '@/store';
import {
  useRawMaterialsStore,
  selectRawMaterials,
  selectRawMaterialsLoading,
  selectRawMaterialsSaving,
  selectRawMaterialsError,
  selectRawMaterialsSearch,
  selectRawMaterialsCategory,
  selectRawMaterialsLowStockCount,
} from '@/store';
import type { RawMaterial, RawMaterialCategory, RawMaterialReason } from '@/types';

// ─── Category filter config ───────────────────────────────────────────────────

const CATEGORIES: Array<{
  key:   RawMaterialCategory | 'all';
  label: string;
  emoji: string;
  color: string;
}> = [
  { key: 'all',       label: 'All',       emoji: '🔍', color: staticTheme.colors.primary[500] },
  { key: 'packaging', label: 'Packaging', emoji: '📦', color: '#6366F1' },
  { key: 'cleaning',  label: 'Cleaning',  emoji: '🧹', color: '#0EA5E9' },
  { key: 'utensils',  label: 'Utensils',  emoji: '🍴', color: '#F59E0B' },
  { key: 'office',    label: 'Office',    emoji: '📎', color: '#8B5CF6' },
  { key: 'other',     label: 'Other',     emoji: '📋', color: '#64748B' },
];

const keyExtractor = (item: RawMaterial) => item.id;

function formatValue(value: number): string {
  if (value >= 1000) {
    return `₱${(value / 1000).toFixed(1)}k`;
  }
  return `₱${value.toFixed(0)}`;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

const SkeletonCard: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <View style={[
    skeletonStyles.card,
    { backgroundColor: isDark ? '#1E2435' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] },
  ]}>
    <View style={[skeletonStyles.accentBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[200] }]} />
    <View style={skeletonStyles.inner}>
      <View style={skeletonStyles.headerRow}>
        <View style={[skeletonStyles.iconPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100] }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[skeletonStyles.line, skeletonStyles.lineTitle, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200] }]} />
          <View style={[skeletonStyles.line, skeletonStyles.lineSubtitle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]} />
        </View>
        <View style={[skeletonStyles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : staticTheme.colors.gray[100] }]} />
      </View>
      <View style={[skeletonStyles.bar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100] }]} />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card:      { flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden', height: 120 },
  accentBar: { width: 4, alignSelf: 'stretch' },
  inner:     { flex: 1, padding: 14, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconPill:  { width: 40, height: 40, borderRadius: 12 },
  line:      { borderRadius: 4 },
  lineTitle: { height: 14, width: '60%' },
  lineSubtitle: { height: 11, width: '40%' },
  chip:      { width: 56, height: 22, borderRadius: 11 },
  bar:       { height: 8, borderRadius: 4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RawMaterialsScreen() {
  const router  = useRouter();
  useSafeAreaInsets();
  const theme   = useAppTheme();
  const mode    = useThemeStore(selectThemeMode);
  const isDark  = mode === 'dark';

  // Stable store refs — filter logic runs in useMemo, not here,
  // to avoid Zustand's infinite-loop from inline .filter() selectors.
  const rawMaterials  = useRawMaterialsStore(selectRawMaterials);
  const isLoading     = useRawMaterialsStore(selectRawMaterialsLoading);
  const isSaving      = useRawMaterialsStore(selectRawMaterialsSaving);
  const error         = useRawMaterialsStore(selectRawMaterialsError);
  const searchQuery   = useRawMaterialsStore(selectRawMaterialsSearch);
  const selectedCat   = useRawMaterialsStore(selectRawMaterialsCategory);
  const lowStockCount = useRawMaterialsStore(selectRawMaterialsLowStockCount);

  const { fetchRawMaterials, setSearchQuery, setSelectedCategory, adjustStock, clearError } =
    useRawMaterialsStore(
      useShallow((s) => ({
        fetchRawMaterials:   s.fetchRawMaterials,
        setSearchQuery:      s.setSearchQuery,
        setSelectedCategory: s.setSelectedCategory,
        adjustStock:         s.adjustStock,
        clearError:          s.clearError,
      })),
    );

  const filtered = useMemo(() => {
    if (!searchQuery && selectedCat === 'all') return rawMaterials;
    const q = searchQuery.toLowerCase();
    return rawMaterials.filter((m) => {
      const matchesSearch   = !q || m.name.toLowerCase().includes(q) ||
        (m.description?.toLowerCase().includes(q) ?? false);
      const matchesCategory = selectedCat === 'all' || m.category === selectedCat;
      return matchesSearch && matchesCategory;
    });
  }, [rawMaterials, searchQuery, selectedCat]);

  const [adjustTarget,       setAdjustTarget]       = useState<RawMaterial | null>(null);
  const [lowStockDismissed,  setLowStockDismissed]  = useState(false);

  useEffect(() => { fetchRawMaterials(); }, [fetchRawMaterials]);

  const handleRefresh = useCallback(() => fetchRawMaterials(), [fetchRawMaterials]);

  const handleEdit = useCallback(
    (m: RawMaterial) => router.push(`/(app)/(tabs)/inventory/raw-materials/${m.id}`),
    [router],
  );

  const handleAdjustConfirm = useCallback(
    async (quantity: number, reason: RawMaterialReason, notes?: string) => {
      if (!adjustTarget) return;
      try {
        await adjustStock(adjustTarget.id, quantity, reason, ...(notes !== undefined ? [notes] : []));
      } catch (err) {
        // error is set in the store — the banner below will display it
        console.error('[adjustStock] failed:', err);
      } finally {
        // Always close the modal so the error banner on this screen is visible
        setAdjustTarget(null);
      }
    },
    [adjustTarget, adjustStock],
  );

  const totalValue = useMemo(
    () => filtered.reduce((sum, m) => sum + m.quantityInStock * m.costPerUnit, 0),
    [filtered],
  );

  // ── Accent colors ────────────────────────────────────────────────────────────
  const accent      = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const warnAccent  = isDark ? '#FFB020' : '#D97706';
  const greenAccent = isDark ? '#3DD68C' : '#16A34A';

  // ── Dynamic styles ───────────────────────────────────────────────────────────
  const dynStyles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      flex: 1
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : staticTheme.colors.gray[100],
    },
    headerTitle: { color: theme.colors.text },
    headerSubtitle: { color: theme.colors.textSecondary },
    addBtn: {
      backgroundColor: staticTheme.colors.primary[500],
    },
    errorBanner: {
      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2',
      borderColor:     isDark ? 'rgba(239,68,68,0.35)' : '#FECDD3',
    },
    errorText: {
      color: isDark ? '#FF6B6B' : '#EF4444',
    },
    lowBanner: {
      backgroundColor: isDark ? 'rgba(255,176,32,0.10)' : '#FFFBEB',
      borderColor:     isDark ? 'rgba(255,176,32,0.30)' : '#FDE68A',
    },
    lowBannerIconWrap: {
      backgroundColor: isDark ? 'rgba(255,176,32,0.18)' : '#FEF3C7',
    },
    statCard: {
      backgroundColor: theme.colors.surface,
      borderColor:     isDark ? 'rgba(255,255,255,0.08)' : staticTheme.colors.gray[100],
    },
    statLabel: { color: theme.colors.textSecondary },
    searchBox: {
      backgroundColor: theme.colors.surface,
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    searchInput: { color: theme.colors.text },
    chipBase: {
      backgroundColor: theme.colors.surface,
      borderColor:     isDark ? 'rgba(255,255,255,0.10)' : staticTheme.colors.gray[200],
    },
    emptyTitle: {
      color: isDark ? 'rgba(255,255,255,0.70)' : staticTheme.colors.gray[700],
    },
    emptyBody: {
      color: theme.colors.textSecondary,
    },
    emptyAddBtn: {
      backgroundColor: staticTheme.colors.primary[500],
    },
  }), [theme, isDark]);

  // Show skeleton cards while first load is in progress and list is empty
  const showSkeleton = isLoading && rawMaterials.length === 0;

  const renderItem = useCallback(
    ({ item }: { item: RawMaterial }) => (
      <RawMaterialCard
        rawMaterial={item}
        onEdit={handleEdit}
        onAdjustStock={setAdjustTarget}
      />
    ),
    [handleEdit],
  );

  return (
    <View style={dynStyles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={[staticStyles.header, dynStyles.header, { paddingTop: staticTheme.spacing.md }]}>
        <View style={staticStyles.headerTextCol}>
          <Text variant="h4" weight="bold" style={dynStyles.headerTitle}>Raw Materials</Text>
          <Text variant="body-xs" style={dynStyles.headerSubtitle}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            {selectedCat !== 'all' ? ` in ${selectedCat}` : ''}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            staticStyles.logsBtn,
            { backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50], borderColor: isDark ? 'rgba(79,158,255,0.28)' : staticTheme.colors.primary[200] },
            pressed && staticStyles.pressed,
          ]}
          onPress={() => router.push('/(app)/(tabs)/inventory/raw-materials/logs')}
          accessibilityLabel="View usage logs"
        >
          <ClipboardList size={15} color={accent} />
          <Text variant="body-xs" weight="semibold" style={{ color: accent }}>Logs</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [staticStyles.addBtn, dynStyles.addBtn, pressed && staticStyles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/inventory/raw-materials/add')}
        >
          <Plus size={17} color="#fff" strokeWidth={2.5} />
          <Text variant="body-sm" weight="semibold" style={{ color: '#fff' }}>New Material</Text>
        </Pressable>
      </View>

      {/* ── Error banner ── */}
      {error ? (
        <Pressable
          style={[staticStyles.errorBanner, dynStyles.errorBanner]}
          onPress={clearError}
        >
          <Text variant="body-xs" weight="semibold" style={dynStyles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <X size={14} color={isDark ? '#FF6B6B' : '#EF4444'} />
        </Pressable>
      ) : null}

      {/* ── Low-stock alert banner ── */}
      {lowStockCount > 0 && !lowStockDismissed ? (
        <View style={[staticStyles.lowBanner, dynStyles.lowBanner]}>
          <View style={[staticStyles.lowBannerIconWrap, dynStyles.lowBannerIconWrap]}>
            <AlertTriangle size={15} color={warnAccent} />
          </View>
          <View style={staticStyles.lowBannerText}>
            <Text variant="body-sm" weight="semibold" style={{ color: warnAccent }}>
              Low Stock Alert
            </Text>
            <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,176,32,0.80)' : '#92400E' }}>
              {lowStockCount} material{lowStockCount !== 1 ? 's' : ''} below minimum stock level
            </Text>
          </View>
          <Pressable
            style={staticStyles.lowBannerDismiss}
            onPress={() => setLowStockDismissed(true)}
            hitSlop={8}
          >
            <X size={16} color={warnAccent} />
          </Pressable>
        </View>
      ) : null}

      {/* ── Hero stats row ── */}
      <View style={staticStyles.statsRow}>
        {/* Total Items */}
        <View style={[staticStyles.statCard, dynStyles.statCard]}>
          <View style={[staticStyles.statIconWrap, { backgroundColor: isDark ? 'rgba(79,158,255,0.15)' : staticTheme.colors.primary[50] }]}>
            <Package size={16} color={accent} />
          </View>
          <Text variant="body-xs" style={dynStyles.statLabel} numberOfLines={1}>Total Items</Text>
          <Text variant="h5" weight="bold" style={{ color: accent }}>
            {filtered.length}
          </Text>
        </View>

        {/* Low Stock */}
        <View style={[staticStyles.statCard, dynStyles.statCard]}>
          <View style={[
            staticStyles.statIconWrap,
            { backgroundColor: lowStockCount > 0
              ? (isDark ? 'rgba(255,176,32,0.15)' : '#FEF3C7')
              : (isDark ? 'rgba(61,214,140,0.15)' : '#DCFCE7') },
          ]}>
            <TrendingDown size={16} color={lowStockCount > 0 ? warnAccent : greenAccent} />
          </View>
          <Text variant="body-xs" style={dynStyles.statLabel} numberOfLines={1}>Low Stock</Text>
          <Text
            variant="h5"
            weight="bold"
            style={{ color: lowStockCount > 0 ? warnAccent : greenAccent }}
          >
            {lowStockCount}
          </Text>
        </View>

        {/* Stock Value */}
        <View style={[staticStyles.statCard, dynStyles.statCard]}>
          <View style={[staticStyles.statIconWrap, { backgroundColor: isDark ? 'rgba(61,214,140,0.15)' : '#DCFCE7' }]}>
            <PhilippinePeso size={16} color={greenAccent} />
          </View>
          <Text variant="body-xs" style={dynStyles.statLabel} numberOfLines={1}>Stock Value</Text>
          <Text variant="h5" weight="bold" style={{ color: greenAccent }} numberOfLines={1}>
            {formatValue(totalValue)}
          </Text>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={[staticStyles.searchBox, dynStyles.searchBox]}>
        <Search size={16} color={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]} />
        <TextInput
          style={[staticStyles.searchInput, dynStyles.searchInput]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search raw materials…"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <X size={15} color={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.gray[400]} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Category chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={staticStyles.chipsRow}
        style={staticStyles.chipsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {CATEGORIES.map((c) => {
          const active = selectedCat === c.key;
          return (
            <Pressable
              key={c.key}
              style={[
                staticStyles.chip,
                dynStyles.chipBase,
                active && { backgroundColor: c.color, borderColor: c.color },
              ]}
              onPress={() => setSelectedCategory(c.key)}
            >
              <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
              <Text
                variant="body-xs"
                weight="semibold"
                style={{ color: active ? '#fff' : theme.colors.textSecondary }}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {showSkeleton ? (
        <View style={staticStyles.skeletonList}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} isDark={isDark} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={staticStyles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && rawMaterials.length > 0}
              onRefresh={handleRefresh}
              tintColor={accent}
              colors={[accent]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={staticStyles.emptyWrap}>
              <View style={[staticStyles.emptyIconWrap, { backgroundColor: isDark ? 'rgba(79,158,255,0.10)' : staticTheme.colors.primary[50] }]}>
                <Package size={40} color={accent} />
              </View>
              <Text variant="h5" weight="bold" style={dynStyles.emptyTitle}>
                {searchQuery ? 'No results found' : 'No raw materials yet'}
              </Text>
              <Text variant="body-sm" style={dynStyles.emptyBody} numberOfLines={2}>
                {searchQuery
                  ? `No materials match "${searchQuery}". Try a different term.`
                  : 'Add packaging, cleaning supplies, utensils, and other materials used in your business.'}
              </Text>
              {!searchQuery ? (
                <Pressable
                  style={[staticStyles.emptyAddBtn, dynStyles.emptyAddBtn]}
                  onPress={() => router.push('/(app)/(tabs)/inventory/raw-materials/add')}
                >
                  <Plus size={16} color="#fff" strokeWidth={2.5} />
                  <Text variant="body-sm" weight="bold" style={{ color: '#fff' }}>
                    Add First Material
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={10}
          initialNumToRender={8}
        />
      )}

      {/* ── Adjust modal ── */}
      <StockAdjustModal
        visible={adjustTarget !== null}
        material={adjustTarget}
        isSaving={isSaving}
        onConfirm={handleAdjustConfirm}
        onClose={() => setAdjustTarget(null)}
      />
    </View>
  );
}

// ─── Static styles (layout only — no colors) ──────────────────────────────────

const staticStyles = StyleSheet.create({
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:   staticTheme.spacing.md,
    borderBottomWidth: 1,
    gap:             staticTheme.spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap:  3,
  },
  logsBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   11,
    borderRadius:      staticTheme.borderRadius.xl,
    borderWidth:       1,
    minHeight:         44,
    flexShrink:        0,
  },
  addBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical:   11,
    borderRadius:   staticTheme.borderRadius.xl,
    minHeight:      44,
    flexShrink:     0,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  errorBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginHorizontal: staticTheme.spacing.md,
    marginBottom:   staticTheme.spacing.sm,
    borderRadius:   staticTheme.borderRadius.lg,
    borderWidth:    1,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 2,
    gap:            staticTheme.spacing.sm,
  },
  lowBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginHorizontal: staticTheme.spacing.md,
    marginBottom:   staticTheme.spacing.md - 4,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    paddingHorizontal: staticTheme.spacing.md - 2,
    paddingVertical:   staticTheme.spacing.sm + 2,
  },
  lowBannerIconWrap: {
    width:          34,
    height:         34,
    borderRadius:   17,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  lowBannerText: {
    flex: 1,
    gap:  2,
  },
  lowBannerDismiss: {
    padding:    staticTheme.spacing.xs,
    minWidth:   40,
    minHeight:  40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection:   'row',
    gap:             staticTheme.spacing.sm,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: staticTheme.spacing.md - 2,
  },
  statCard: {
    flex:         1,
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth:  1,
    padding:      staticTheme.spacing.sm + 2,
    gap:          staticTheme.spacing.xs,
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation:    1,
  },
  statIconWrap: {
    width:          34,
    height:         34,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm,
    marginHorizontal: staticTheme.spacing.md,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   11,
    borderRadius:   staticTheme.borderRadius.xl,
    borderWidth:    1,
    marginBottom:   staticTheme.spacing.sm + 2,
    minHeight:      46,
  },
  searchInput: {
    flex:     1,
    fontSize: 14,
    padding:  0,
  },
  chipsScroll: { flexShrink: 0, alignSelf: 'stretch', maxHeight: 52 },
  chipsRow: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingBottom:     staticTheme.spacing.md - 2,
    gap:               staticTheme.spacing.sm,
  },
  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingHorizontal: staticTheme.spacing.sm + 4,
    paddingVertical:   staticTheme.spacing.xs + 2,
    borderRadius:   staticTheme.borderRadius.full,
    borderWidth:    1,
    minHeight:      34,
  },
  listContent: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.xs,
    paddingBottom:     120,
  },
  skeletonList: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop:        staticTheme.spacing.xs,
    gap:               10,
  },
  emptyWrap: {
    alignItems:    'center',
    paddingTop:    48,
    paddingHorizontal: staticTheme.spacing.xl,
    gap:           staticTheme.spacing.sm + 4,
  },
  emptyIconWrap: {
    width:          88,
    height:         88,
    borderRadius:   28,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   staticTheme.spacing.xs,
  },
  emptyAddBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            staticTheme.spacing.sm - 2,
    paddingHorizontal: staticTheme.spacing.lg,
    paddingVertical:   staticTheme.spacing.sm + 4,
    borderRadius:   staticTheme.borderRadius.xl,
    marginTop:      staticTheme.spacing.sm,
    minHeight:      50,
  },
});