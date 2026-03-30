/**
 * Inventory Overview Screen — dark-mode-first redesign
 *
 * Layout:
 *   1. Stats bar       — 4 glassy stat tiles (total / low / out / value)
 *   2. Category nav    — 3 hero cards (Products / Ingredients / Equipment)
 *   3. Low-stock alert — conditional neon warning banner
 *   4. Search + Sort   — filters the all-items list
 *   5. FlatList        — read-only overview, tap to view detail
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  Package,
  AlertTriangle,
  ArrowUpDown,
  TrendingDown,
  ShoppingBag,
  Check,
  X,
  Wheat,
  Wrench,
  ChevronRight,
  Layers,
  Factory,
  ClipboardList,
} from 'lucide-react-native';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Text } from '@/components/atoms/Text';
import { InventoryItemCard } from '@/components/organisms/InventoryItemCard';
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
  useThemeStore,
  selectThemeMode,
  useRawMaterialsStore,
  selectRawMaterials,
  useAuthStore,
  selectCurrentUser,
} from '@/store';
import { isProductionBusiness } from '@/types';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'qty-asc'
  | 'qty-desc'
  | 'recently-added';

interface SortOption { key: SortKey; label: string }

const SORT_OPTIONS: SortOption[] = [
  { key: 'name-asc',       label: 'Name A \u2192 Z' },
  { key: 'name-desc',      label: 'Name Z \u2192 A' },
  { key: 'qty-asc',        label: 'Qty: Low to High' },
  { key: 'qty-desc',       label: 'Qty: High to Low' },
  { key: 'recently-added', label: 'Recently Added' },
];

type CategoryScreen = 'products' | 'ingredients' | 'equipment' | 'production' | 'ingredient-logs' | 'raw-materials/index';

// ─── Sort ─────────────────────────────────────────────────────────────────────

function applySortOrder(items: InventoryItem[], sort: SortKey): InventoryItem[] {
  const copy = [...items];
  switch (sort) {
    case 'name-asc':       return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'qty-asc':        return copy.sort((a, b) => a.quantity - b.quantity);
    case 'qty-desc':       return copy.sort((a, b) => b.quantity - a.quantity);
    case 'recently-added': return copy.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}

function formatCurrency(value: number): string {
  return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const keyExtractor = (item: InventoryItem) => item.id;

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:      string;
  value:      string;
  icon:       React.ReactNode;
  accentColor: string;
  isDark:     boolean;
}

const StatCard: React.FC<StatCardProps> = React.memo(
  ({ label, value, icon, accentColor, isDark }) => (
    <View style={[
      statCardStyles.card,
      {
        backgroundColor: isDark ? `${accentColor}0D` : `${accentColor}0F`,
        borderColor: isDark ? `${accentColor}28` : `${accentColor}30`,
      },
    ]}>
      <View style={[statCardStyles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
        {icon}
      </View>
      <Text variant="body-xs" style={[statCardStyles.label, { color: isDark ? 'rgba(255,255,255,0.50)' : staticTheme.colors.gray[500] }]} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="body-sm" weight="bold" style={[statCardStyles.value, { color: accentColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  ),
);
StatCard.displayName = 'StatCard';

const statCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    padding: staticTheme.spacing.sm,
    gap: 4,
    alignItems: 'flex-start',
    minWidth: 72,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {},
  value: {},
});

// ─── CategoryNavCard ──────────────────────────────────────────────────────────

interface CategoryNavCardProps {
  screenName:  CategoryScreen;
  label:       string;
  subtitle:    string;
  count:       number;
  accentColor: string;
  iconBg:      string;
  Icon:        React.ComponentType<{ size: number; color: string }>;
  isDark:      boolean;
  onPress:     (screen: CategoryScreen) => void;
}

const CategoryNavCard: React.FC<CategoryNavCardProps> = React.memo(
  ({ screenName, label, subtitle, count, accentColor, iconBg, Icon, isDark, onPress }) => (
    <Pressable
      style={({ pressed }) => [
        catNavStyles.card,
        {
          backgroundColor: isDark ? `${accentColor}09` : `${accentColor}0C`,
          borderColor: isDark ? `${accentColor}28` : `${accentColor}30`,
        },
        pressed && catNavStyles.pressed,
      ]}
      onPress={() => onPress(screenName)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
    >
      <View style={[catNavStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon size={20} color={accentColor} />
      </View>
      <View style={catNavStyles.textGroup}>
        <Text variant="body-sm" weight="semibold" style={{ color: isDark ? '#FFFFFF' : staticTheme.colors.gray[800] }} numberOfLines={1}>
          {label}
        </Text>
        <Text variant="body-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.gray[500] }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={[catNavStyles.countBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}28` }]}>
        <Text variant="body-xs" weight="bold" style={{ color: accentColor }}>{count}</Text>
      </View>
      <ChevronRight size={14} color={isDark ? 'rgba(255,255,255,0.28)' : accentColor} />
    </Pressable>
  ),
);
CategoryNavCard.displayName = 'CategoryNavCard';

const catNavStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: staticTheme.borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 12,
    gap: staticTheme.spacing.sm,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textGroup: { flex: 1, gap: 2, minWidth: 0 },
  countBadge: {
    borderRadius: staticTheme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
    minWidth: 26,
    alignItems: 'center',
  },
});

// ─── SortModal ────────────────────────────────────────────────────────────────

interface SortModalProps {
  visible: boolean;
  current: SortKey;
  isDark:  boolean;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

const SortModal: React.FC<SortModalProps> = React.memo(
  ({ visible, current, isDark, onSelect, onClose }) => {
    const theme     = useAppTheme();
    const accent    = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
    const sheetBg   = isDark ? '#1A1F2E' : theme.colors.surface;

    const dynStyles = useMemo(() => StyleSheet.create({
      sheet: {
        backgroundColor: sheetBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: staticTheme.spacing.md,
        paddingTop: 0,
        paddingBottom: staticTheme.spacing.xl,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
      },
      handle: { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300] },
      title:  { color: theme.colors.text },
      optionActive:  { backgroundColor: `${accent}15` },
      optionPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.gray[100] },
    }), [theme, sheetBg, isDark, accent]);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={sortStyles.overlay} onPress={onClose}>
          <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={[sortStyles.handle, dynStyles.handle]} />
            <View style={sortStyles.header}>
              <Text variant="body" weight="semibold" style={dynStyles.title}>Sort by</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={isDark ? 'rgba(255,255,255,0.45)' : theme.colors.gray[500]} />
              </Pressable>
            </View>
            {SORT_OPTIONS.map((opt) => {
              const isActive = opt.key === current;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    sortStyles.option,
                    isActive && dynStyles.optionActive,
                    pressed && dynStyles.optionPressed,
                  ]}
                  onPress={() => onSelect(opt.key)}
                  accessibilityRole="menuitem"
                >
                  <Text variant="body" weight={isActive ? 'semibold' : 'normal'}
                    style={{ color: isActive ? accent : theme.colors.text }}>
                    {opt.label}
                  </Text>
                  {isActive && <Check size={16} color={accent} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
SortModal.displayName = 'SortModal';

const sortStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginVertical: staticTheme.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: staticTheme.spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: staticTheme.spacing.sm, borderRadius: staticTheme.borderRadius.md },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const navigation = useNavigation();
  const theme      = useAppTheme();
  const mode       = useThemeStore(selectThemeMode);
  const isDark     = mode === 'dark';

  const navigateToCategory = useCallback(
    (screen: CategoryScreen) => navigation.dispatch(StackActions.push(screen)),
    [navigation],
  );

  const [refreshing,  setRefreshing]  = useState(false);
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

  // Feature gate: production-only category nav cards are hidden for resellers.
  // Default to true so existing users without the mode field see all features.
  const currentUser    = useAuthStore(selectCurrentUser);
  const operationMode  = currentUser?.businessOperationMode ?? 'production';
  const showProduction = isProductionBusiness(operationMode);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let outOfStock = 0;
    let totalValue = 0;
    let products   = 0;
    let ingredients = 0;
    let equipment  = 0;
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
    return applySortOrder(filtered, sortKey);
  }, [allItems, filter.searchQuery, sortKey]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => setFilter({ searchQuery: text }), [setFilter]);
  const handleSearchClear  = useCallback(() => setFilter({ searchQuery: '' }), [setFilter]);
  const handleItemPress    = useCallback(
    (item: InventoryItem) => navigation.dispatch(StackActions.push('[id]', { id: item.id })),
    [navigation],
  );
  const handleLowStockPress = useCallback(
    () => navigation.dispatch(StackActions.push('ingredients')),
    [navigation],
  );
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);
  const handleSortSelect = useCallback((key: SortKey) => { setSortKey(key); setSortVisible(false); }, []);
  const openSort  = useCallback(() => setSortVisible(true),  []);
  const closeSort = useCallback(() => setSortVisible(false), []);
  const sortLabel = useMemo(() => SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort', [sortKey]);

  // ── Accent colors ──────────────────────────────────────────────────────────

  const accent      = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];
  const warnAccent  = isDark ? '#FFB020' : staticTheme.colors.warning[600];
  const errAccent   = isDark ? '#FF6B6B' : staticTheme.colors.error[500];
  const greenAccent = isDark ? '#3DD68C' : staticTheme.colors.success[500];

  // ── Dynamic styles ─────────────────────────────────────────────────────────

  const dynStyles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    searchWrap: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
    },
    alertBanner: {
      flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm,
      marginHorizontal: staticTheme.spacing.md,
      backgroundColor: isDark ? 'rgba(255,176,32,0.10)' : staticTheme.colors.warning[50],
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,176,32,0.30)' : staticTheme.colors.warning[200],
      borderRadius: staticTheme.borderRadius.xl,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
    },
    alertIconCircle: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,176,32,0.18)' : staticTheme.colors.warning[100],
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    sectionLabel: {
      color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.gray[400],
      letterSpacing: 0.8,
    },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: isDark ? 'rgba(79,158,255,0.12)' : staticTheme.colors.primary[50],
      borderRadius: staticTheme.borderRadius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(79,158,255,0.28)' : staticTheme.colors.primary[100],
    },
    sortBtnText: { color: accent, maxWidth: 120 },
    countText: { color: isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[500] },
  }), [theme, isDark, accent]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => <InventoryItemCard item={item} onPress={handleItemPress} />,
    [handleItemPress],
  );

  const ListHeader = useMemo(() => (
    <View style={listHeaderStyles.wrapper}>
      {lowStockCount > 0 && (
        <Pressable style={dynStyles.alertBanner} onPress={handleLowStockPress}
          accessibilityRole="button" accessibilityLabel={`${lowStockCount} items below reorder level`}>
          <View style={dynStyles.alertIconCircle}>
            <AlertTriangle size={15} color={warnAccent} />
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

      <View style={listHeaderStyles.controls}>
        <Pressable style={({ pressed }) => [dynStyles.sortBtn, pressed && { opacity: 0.75 }]}
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
  ), [lowStockCount, sortLabel, items.length, handleLowStockPress, openSort, dynStyles, warnAccent, accent, isDark]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={filter.searchQuery.length > 0 ? 'No results found' : 'Inventory is empty'}
      description={filter.searchQuery.length > 0
        ? 'Try adjusting your search.'
        : 'Use the category links above to add your first item.'}
      icon={<Package size={28} color={isDark ? 'rgba(79,158,255,0.60)' : staticTheme.colors.primary[400]} />}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filter.searchQuery, isDark]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {/* Stats tiles */}
      <View style={statsStyles.container}>
        <View style={statsStyles.row}>
          <StatCard label="Total Items" value={String(stats.total)}
            icon={<Layers size={13} color={accent} />}
            accentColor={accent} isDark={isDark} />
          <StatCard label="Low Stock" value={String(stats.lowStock)}
            icon={<TrendingDown size={13} color={stats.lowStock > 0 ? warnAccent : isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]} />}
            accentColor={stats.lowStock > 0 ? warnAccent : (isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400])}
            isDark={isDark} />
          <StatCard label="Out of Stock" value={String(stats.outOfStock)}
            icon={<AlertTriangle size={13} color={stats.outOfStock > 0 ? errAccent : isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400]} />}
            accentColor={stats.outOfStock > 0 ? errAccent : (isDark ? 'rgba(255,255,255,0.30)' : staticTheme.colors.gray[400])}
            isDark={isDark} />
          <StatCard label="Total Value" value={formatCurrency(stats.totalValue)}
            icon={<ShoppingBag size={13} color={greenAccent} />}
            accentColor={greenAccent} isDark={isDark} />
        </View>
      </View>

      {/* Category nav */}
      <View style={catNavContainerStyles.section}>
        <Text variant="body-xs" weight="semibold" style={dynStyles.sectionLabel}>
          MANAGE BY CATEGORY
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={catNavContainerStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <CategoryNavCard
            screenName="products" label="Products" subtitle="Finished goods"
            count={stats.products}
            accentColor={isDark ? '#4F9EFF' : staticTheme.colors.primary[500]}
            iconBg={isDark ? 'rgba(79,158,255,0.15)' : staticTheme.colors.primary[100]}
            Icon={Package} isDark={isDark} onPress={navigateToCategory}
          />
          {/* Ingredients — production businesses only */}
          {showProduction && (
            <CategoryNavCard
              screenName="ingredients" label="Ingredients" subtitle="Recipe components"
              count={stats.ingredients}
              accentColor={isDark ? '#3DD68C' : staticTheme.colors.success[500]}
              iconBg={isDark ? 'rgba(61,214,140,0.15)' : staticTheme.colors.success[100]}
              Icon={Wheat} isDark={isDark} onPress={navigateToCategory}
            />
          )}
          <CategoryNavCard
            screenName="equipment" label="Equipment" subtitle="Tools & assets"
            count={stats.equipment}
            accentColor={isDark ? '#FFB020' : staticTheme.colors.highlight[400]}
            iconBg={isDark ? 'rgba(255,176,32,0.15)' : staticTheme.colors.highlight[100]}
            Icon={Wrench} isDark={isDark} onPress={navigateToCategory}
          />
          {/* Production & consumption tracking — production businesses only */}
          {showProduction && (
            <>
              <CategoryNavCard
                screenName="production" label="Production Log" subtitle="Daily run history"
                count={todayRunsCount}
                accentColor={isDark ? '#C084FC' : staticTheme.colors.secondary[500]}
                iconBg={isDark ? 'rgba(192,132,252,0.15)' : staticTheme.colors.secondary[100]}
                Icon={Factory} isDark={isDark} onPress={navigateToCategory}
              />
              <CategoryNavCard
                screenName="ingredient-logs" label="Consumption Logs" subtitle="Ingredient usage audit"
                count={consumptionTotalCount}
                accentColor={isDark ? '#FB923C' : staticTheme.colors.warning[500]}
                iconBg={isDark ? 'rgba(251,146,60,0.15)' : staticTheme.colors.warning[100]}
                Icon={ClipboardList} isDark={isDark} onPress={navigateToCategory}
              />
              <CategoryNavCard
                screenName="raw-materials/index" label="Raw Materials" subtitle="Containers, packaging & supplies"
                count={rawMaterialsCount}
                accentColor={isDark ? '#38BDF8' : '#0EA5E9'}
                iconBg={isDark ? 'rgba(56,189,248,0.15)' : '#E0F2FE'}
                Icon={Layers} isDark={isDark} onPress={navigateToCategory}
              />
            </>
          )}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={dynStyles.searchWrap}>
        <SearchBar
          value={filter.searchQuery}
          onChangeText={handleSearchChange}
          onClear={handleSearchClear}
          placeholder="Search all inventory..."
          variant="outlined"
        />
      </View>

      {/* Item list */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={isLoading ? null : ListEmpty}
        contentContainerStyle={[listStyles.content, items.length === 0 && listStyles.contentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={accent} colors={[accent]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={10}
      />

      {/* Sort modal */}
      <SortModal visible={sortVisible} current={sortKey} isDark={isDark} onSelect={handleSortSelect} onClose={closeSort} />
    </View>
  );
}

// ─── Static styles ────────────────────────────────────────────────────────────

const statsStyles = StyleSheet.create({
  container: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
  },
  row: { flexDirection: 'row', gap: 6 },
});

const catNavContainerStyles = StyleSheet.create({
  section: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
    gap: staticTheme.spacing.xs,
  },
  scrollContent: {
    gap: staticTheme.spacing.sm,
    paddingRight: staticTheme.spacing.md,
  },
});

const listHeaderStyles = StyleSheet.create({
  wrapper: {
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: 4,
    gap: staticTheme.spacing.xs,
  },
  alertText: { flex: 1, gap: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 4,
  },
});

const listStyles = StyleSheet.create({
  content:      { paddingBottom: staticTheme.spacing.xl },
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
});
