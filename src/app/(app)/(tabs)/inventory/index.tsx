/**
 * Inventory Overview Screen — 2026 bento + airy redesign
 *
 * Layout:
 *   1. Hero stat tile   — headline "Stock value" (StatTile, hero variant)
 *   2. Compact bento     — Total / Low / Out (StatTile, compact)
 *   3. Low-stock alert   — conditional soft warning card
 *   4. Category grid     — responsive CategoryTile grid (2 cols phone / 3 tablet)
 *   5. Search + Sort      — filters the all-items list
 *   6. List / grid        — single column on phone, 2-col grid on tablet
 *
 * Responsive: columns come from useResponsive(); the dashboard lives in the
 * FlatList header so the item list can virtualize. Master-detail does NOT apply
 * to this hub — tapping an item navigates to its detail screen.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  TrendingDown,
  Wallet,
  Layers,
} from 'lucide-react-native';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { InventoryListSkeleton } from '@/components/molecules/Skeletons';
import { SortSheet } from '@/components/molecules/SortSheet';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { StatTile } from '@/components/molecules/StatTile';
import { CategoryTile } from '@/components/molecules/CategoryTile';
import { Text } from '@/components/atoms/Text';
import { InventoryItemCard } from '@/components/organisms/InventoryItemCard';
import { InventoryActionSheet } from '@/components/molecules/InventoryActionSheet';
import { InventoryStockAddSheet } from '@/components/molecules/InventoryStockAddSheet';
import {
  useInventoryStore,
  selectAllItems,
  selectLowStockCount,
  selectInventoryFilter,
  selectInventoryLoading,
  useProductionStore,
  selectTodaySummary,
  useIngredientConsumptionStore,
  selectConsumptionTotalCount,
  useRawMaterialsStore,
  selectRawMaterials,
  useAuthStore,
  selectCurrentUser,
} from '@/store';
import { isProductionBusiness } from '@/types';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { getInventoryAccent, type InventoryAccentKey } from '@/core/theme/inventoryAccents';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import { SORT_OPTIONS, applyInventorySort, type SortKey } from '@/core/utils/sort';
import { useResponsive, useRefreshControl, useInventoryItemActions } from '@/hooks';
import { padToColumns } from '@/core/utils/grid';
import type { InventoryItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryScreen =
  | 'products' | 'ingredients' | 'equipment'
  | 'production' | 'ingredient-logs' | 'raw-materials/index';

interface CatNav {
  key:      InventoryAccentKey;
  screen:   CategoryScreen;
  label:    string;
  subtitle: string;
  count:    number;
}

const keyExtractor = (item: InventoryItem | null, index: number): string =>
  item ? item.id : `empty-${index}`;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const navigation = useNavigation();
  const theme      = useAppTheme();
  const isDark     = useThemeMode() === 'dark';
  const { isTablet, columns } = useResponsive();

  // Overview list caps at 2 columns for readability; category grid is denser.
  const listColumns = Math.min(columns, 2);
  const catColumns  = isTablet ? 3 : 2;

  const navigateToCategory = useCallback(
    (screen: CategoryScreen) => navigation.dispatch(StackActions.push(screen)),
    [navigation],
  );

  const [sortKey,     setSortKey]     = useState<SortKey>('name-asc');
  const [sortVisible, setSortVisible] = useState(false);

  const allItems      = useInventoryStore(selectAllItems);
  const filter        = useInventoryStore(selectInventoryFilter);
  const lowStockCount = useInventoryStore(selectLowStockCount);
  const isLoading     = useInventoryStore(selectInventoryLoading);
  const { setFilter } = useInventoryStore();

  const todaySummary          = useProductionStore(selectTodaySummary);
  const todayRunsCount        = todaySummary.productionRuns;
  const consumptionTotalCount = useIngredientConsumptionStore(selectConsumptionTotalCount);
  const rawMaterials          = useRawMaterialsStore(selectRawMaterials);
  const rawMaterialsCount     = rawMaterials.length;

  // Feature gate: production-only category tiles are hidden for resellers.
  const currentUser    = useAuthStore(selectCurrentUser);
  const operationMode  = currentUser?.businessOperationMode ?? 'production';
  const showProduction = isProductionBusiness(operationMode);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let outOfStock  = 0;
    let totalValue  = 0;
    let products    = 0;
    let ingredients = 0;
    let equipment   = 0;
    for (const item of allItems) {
      if (item.quantity === 0) outOfStock++;
      totalValue += item.quantity * (item.costPrice ?? item.price ?? 0);
      if (item.category === 'product')    products++;
      if (item.category === 'ingredient') ingredients++;
      if (item.category === 'equipment')  equipment++;
    }
    return { total: allItems.length, lowStock: lowStockCount, outOfStock, totalValue, products, ingredients, equipment };
  }, [allItems, lowStockCount]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────

  const items = useMemo(() => {
    const q = filter.searchQuery.toLowerCase().trim();
    const filtered = q.length === 0 ? allItems : allItems.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (item.sku?.toLowerCase().includes(q) ?? false) ||
      (item.description?.toLowerCase().includes(q) ?? false),
    );
    return applyInventorySort(filtered, sortKey);
  }, [allItems, filter.searchQuery, sortKey]);

  const listData = useMemo(() => padToColumns(items, listColumns), [items, listColumns]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => setFilter({ searchQuery: text }), [setFilter]);
  const handleSearchClear  = useCallback(() => setFilter({ searchQuery: '' }), [setFilter]);
  const navigateToDetail   = useCallback(
    (item: InventoryItem) => navigation.dispatch(StackActions.push('[id]', { id: item.id })),
    [navigation],
  );
  // Tapping an item opens a chooser (Add Stock / View Details) rather than
  // navigating straight to the detail screen.
  const { openActions, actionSheetProps, stockSheetProps } =
    useInventoryItemActions({ onViewDetails: navigateToDetail });
  const handleLowStockPress = useCallback(
    () => navigation.dispatch(StackActions.push('ingredients')),
    [navigation],
  );
  const { refreshing, onRefresh } = useRefreshControl(
    () => useInventoryStore.getState().initializeInventory(),
  );
  const handleSortSelect = useCallback((key: SortKey) => { setSortKey(key); setSortVisible(false); }, []);
  const openSort  = useCallback(() => setSortVisible(true),  []);
  const closeSort = useCallback(() => setSortVisible(false), []);
  const sortLabel = useMemo(() => SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort', [sortKey]);

  // ── Accent colors ──────────────────────────────────────────────────────────

  const accent       = theme.colors.tintPrimary;
  const greenAccent  = isDark ? '#3DD68C' : theme.colors.success[600];
  const warnAccent   = isDark ? '#FFB020' : theme.colors.warning[600];
  const errAccent    = isDark ? '#FF6B6B' : theme.colors.error[500];
  const mutedAccent  = theme.colors.textSecondary;
  const lowAccent    = stats.lowStock   > 0 ? warnAccent : mutedAccent;
  const outAccent    = stats.outOfStock > 0 ? errAccent  : mutedAccent;

  // ── Category nav model (feature-gated) ───────────────────────────────────────

  const categories = useMemo<CatNav[]>(() => {
    const list: CatNav[] = [];
    list.push({ key: 'product', screen: 'products', label: 'Products', subtitle: 'Finished goods', count: stats.products });
    if (showProduction) list.push({ key: 'ingredient', screen: 'ingredients', label: 'Ingredients', subtitle: 'Recipe components', count: stats.ingredients });
    list.push({ key: 'equipment', screen: 'equipment', label: 'Equipment', subtitle: 'Tools & assets', count: stats.equipment });
    if (showProduction) {
      list.push({ key: 'production',   screen: 'production',          label: 'Production',    subtitle: 'Run history',          count: todayRunsCount });
      list.push({ key: 'consumption',  screen: 'ingredient-logs',     label: 'Consumption',   subtitle: 'Usage audit',          count: consumptionTotalCount });
      list.push({ key: 'rawMaterials', screen: 'raw-materials/index', label: 'Raw Materials', subtitle: 'Packaging & supplies', count: rawMaterialsCount });
    }
    return list;
  }, [showProduction, stats.products, stats.ingredients, stats.equipment, todayRunsCount, consumptionTotalCount, rawMaterialsCount]);

  const catRows = useMemo(() => {
    const rows: CatNav[][] = [];
    for (let i = 0; i < categories.length; i += catColumns) rows.push(categories.slice(i, i + catColumns));
    return rows;
  }, [categories, catColumns]);

  // ── Dynamic styles ─────────────────────────────────────────────────────────

  const dynStyles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    alertCard: {
      flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm,
      backgroundColor: isDark ? 'rgba(255,176,32,0.10)' : staticTheme.colors.warning[50],
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,176,32,0.30)' : staticTheme.colors.warning[200],
      borderRadius: staticTheme.borderRadius['2xl'],
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm + 2,
    },
    alertIconCircle: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,176,32,0.18)' : staticTheme.colors.warning[100],
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50],
      borderRadius: staticTheme.borderRadius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(79,158,255,0.28)' : staticTheme.colors.primary[100],
    },
    sortBtnText: { color: accent, maxWidth: 140 },
    countText: { color: theme.colors.textSecondary },
  }), [theme, isDark, accent]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem | null }) => {
      if (item === null) return <View style={listStyles.spacer} />;
      return (
        <InventoryItemCard
          item={item}
          onPress={openActions}
          layout={listColumns > 1 ? 'grid' : 'row'}
          {...(listColumns > 1 ? { style: listStyles.gridCell } : {})}
        />
      );
    },
    [openActions, listColumns],
  );

  const ListHeader = useMemo(() => (
    <View style={listHeaderStyles.wrapper}>
      {/* Hero stat */}
      <StatTile
        variant="hero"
        highlight
        label="Stock value"
        value={formatCurrency(stats.totalValue)}
        subValue={`${stats.total} item${stats.total !== 1 ? 's' : ''} · ${stats.lowStock} low`}
        accentColor={greenAccent}
        icon={<Wallet size={20} color={greenAccent} />}
      />

      {/* Compact bento */}
      <View style={listHeaderStyles.statRow}>
        <StatTile label="Total Items" value={String(stats.total)}
          accentColor={accent} icon={<Layers size={16} color={accent} />} />
        <StatTile label="Low Stock" value={String(stats.lowStock)}
          accentColor={lowAccent} icon={<TrendingDown size={16} color={lowAccent} />} />
        <StatTile label="Out of Stock" value={String(stats.outOfStock)}
          accentColor={outAccent} icon={<AlertTriangle size={16} color={outAccent} />} />
      </View>

      {/* Low-stock alert */}
      {lowStockCount > 0 && (
        <Pressable style={dynStyles.alertCard} onPress={handleLowStockPress}
          accessibilityRole="button" accessibilityLabel={`${lowStockCount} items below reorder level`}>
          <View style={dynStyles.alertIconCircle}>
            <AlertTriangle size={16} color={warnAccent} />
          </View>
          <View style={listHeaderStyles.alertText}>
            <Text variant="body-sm" weight="semibold" style={{ color: warnAccent }}>Low Stock Alert</Text>
            <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,176,32,0.75)' : staticTheme.colors.warning[600] }}>
              {lowStockCount} item{lowStockCount > 1 ? 's' : ''} at or below reorder level
            </Text>
          </View>
          <Text variant="body-xs" weight="semibold" style={{ color: warnAccent, textDecorationLine: 'underline', flexShrink: 0 }}>
            View
          </Text>
        </Pressable>
      )}

      {/* Category grid */}
      <View style={listHeaderStyles.section}>
        <SectionHeader title="Manage by category" />
        <View style={listHeaderStyles.catGrid}>
          {catRows.map((row, ri) => (
            <View key={`row-${ri}`} style={listHeaderStyles.catRow}>
              {row.map((c) => {
                const a = getInventoryAccent(c.key, isDark);
                return (
                  <CategoryTile
                    key={c.key}
                    label={c.label}
                    subtitle={c.subtitle}
                    count={c.count}
                    accentColor={a.accent}
                    iconBg={a.iconBg}
                    Icon={a.Icon}
                    variant="grid"
                    onPress={() => navigateToCategory(c.screen)}
                  />
                );
              })}
              {row.length < catColumns &&
                Array.from({ length: catColumns - row.length }).map((_, i) => (
                  <View key={`pad-${ri}-${i}`} style={listStyles.spacer} />
                ))}
            </View>
          ))}
        </View>
      </View>

      {/* Search */}
      <SearchBar
        value={filter.searchQuery}
        onChangeText={handleSearchChange}
        onClear={handleSearchClear}
        placeholder="Search all inventory..."
        variant="outlined"
      />

      {/* Sort + count */}
      <View style={listHeaderStyles.controls}>
        <Pressable style={({ pressed }) => [dynStyles.sortBtn, pressed && pressedFaint]}
          onPress={openSort} accessibilityRole="button">
          <ArrowUpDown size={13} color={accent} />
          <Text variant="body-xs" weight="medium" style={dynStyles.sortBtnText} numberOfLines={1}>{sortLabel}</Text>
        </Pressable>
        <Text variant="body-xs" style={dynStyles.countText}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [stats, lowStockCount, sortLabel, items.length, catRows, catColumns, dynStyles,
      accent, greenAccent, lowAccent, outAccent, warnAccent, isDark, filter.searchQuery,
      handleSearchChange, handleSearchClear, handleLowStockPress, openSort, navigateToCategory]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={filter.searchQuery.length > 0 ? 'No results found' : 'Inventory is empty'}
      description={filter.searchQuery.length > 0
        ? 'Try adjusting your search.'
        : 'Use the category tiles above to add your first item.'}
      icon={<Package size={28} color={isDark ? 'rgba(79,158,255,0.60)' : staticTheme.colors.primary[400]} />}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filter.searchQuery, isDark]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const showSkeleton = isLoading && allItems.length === 0;

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {showSkeleton && (
        <View style={StyleSheet.absoluteFill}>
          <InventoryListSkeleton />
        </View>
      )}

      <FlatList
        key={`cols-${listColumns}`}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={listColumns}
        {...(listColumns > 1 ? { columnWrapperStyle: listStyles.columnWrapper } : {})}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={isLoading ? null : ListEmpty}
        contentContainerStyle={[listStyles.content, items.length === 0 && listStyles.contentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={accent} colors={[accent]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={10}
      />

      <SortSheet visible={sortVisible} current={sortKey} accentColor={accent} isDark={isDark} onSelect={handleSortSelect} onClose={closeSort} />

      <InventoryActionSheet {...actionSheetProps} />
      <InventoryStockAddSheet {...stockSheetProps} />
    </View>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const pressedFaint = { opacity: 0.75 } as const;

const listHeaderStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
    gap: staticTheme.spacing.md,
  },
  statRow: { flexDirection: 'row', gap: staticTheme.spacing.sm },
  alertText: { flex: 1, gap: 1 },
  section: { gap: staticTheme.spacing.sm },
  catGrid: { gap: staticTheme.spacing.sm },
  catRow:  { flexDirection: 'row', gap: staticTheme.spacing.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

const listStyles = StyleSheet.create({
  content:       { paddingBottom: staticTheme.spacing.xl },
  contentEmpty:  { flexGrow: 1, justifyContent: 'center' },
  columnWrapper: { gap: staticTheme.spacing.sm, paddingHorizontal: staticTheme.spacing.md },
  gridCell:      { marginBottom: staticTheme.spacing.sm },
  spacer:        { flex: 1 },
});
