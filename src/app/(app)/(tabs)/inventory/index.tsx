/**
 * Inventory Overview Screen — monitoring only
 *
 * Shows aggregate stats and links to the three category pages
 * (Products, Ingredients, Equipment) where items are managed.
 *
 * Layout:
 *   1. Stats bar       — Total / Low Stock / Out of Stock / Total Value
 *   2. Category cards  — Products | Ingredients | Equipment (navigate to dedicated pages)
 *   3. Search + Sort   — filters the full item list below
 *   4. Low-stock alert — conditional banner
 *   5. FlatList        — read-only overview of all items (tap to view detail)
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
} from '@/store';
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

// ─── Sort options ─────────────────────────────────────────────────────────────

interface SortOption { key: SortKey; label: string }

const SORT_OPTIONS: SortOption[] = [
  { key: 'name-asc',       label: 'Name A \u2192 Z' },
  { key: 'name-desc',      label: 'Name Z \u2192 A' },
  { key: 'qty-asc',        label: 'Qty: Low to High' },
  { key: 'qty-desc',       label: 'Qty: High to Low' },
  { key: 'recently-added', label: 'Recently Added' },
];

// ─── Category navigation config ───────────────────────────────────────────────
// Brand palette colors don't change between modes — safe as module-level constants.

type CategoryScreen = 'products' | 'ingredients' | 'equipment';

const CATEGORY_LINKS: {
  screenName: CategoryScreen;
  label:      string;
  description: string;
  icon:       React.ReactNode;
  color:      string;
  bg:         string;
  border:     string;
}[] = [
  {
    screenName:  'products',
    label:       'Products',
    description: 'Finished goods for sale',
    icon:        <Package size={22} color={staticTheme.colors.primary[500]} />,
    color:       staticTheme.colors.primary[500],
    bg:          staticTheme.colors.primary[50],
    border:      staticTheme.colors.primary[100],
  },
  {
    screenName:  'ingredients',
    label:       'Ingredients',
    description: 'Raw materials & consumables',
    icon:        <Wheat size={22} color={staticTheme.colors.success[500]} />,
    color:       staticTheme.colors.success[500],
    bg:          staticTheme.colors.success[50],
    border:      staticTheme.colors.success[100],
  },
  {
    screenName:  'equipment',
    label:       'Equipment',
    description: 'Tools and assets',
    icon:        <Wrench size={22} color={staticTheme.colors.highlight[400]} />,
    color:       staticTheme.colors.highlight[400],
    bg:          staticTheme.colors.highlight[50],
    border:      staticTheme.colors.highlight[100],
  },
];

// ─── Sorting ──────────────────────────────────────────────────────────────────

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
  return `\u20B1${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const keyExtractor = (item: InventoryItem) => item.id;

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string; value: string; icon: React.ReactNode;
  valueColor: string; bgColor: string; borderColor: string;
}

const StatCard: React.FC<StatCardProps> = React.memo(
  ({ label, value, icon, valueColor, bgColor, borderColor }) => (
    <View style={[statStyles.card, { backgroundColor: bgColor, borderColor }]}>
      <View style={statStyles.iconWrap}>{icon}</View>
      <Text variant="body-xs" style={statStyles.label} numberOfLines={1}>{label}</Text>
      <Text variant="body-sm" weight="bold" style={[statStyles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  ),
);
StatCard.displayName = 'StatCard';

const statStyles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: staticTheme.borderRadius.lg, borderWidth: 1,
    padding: staticTheme.spacing.sm, gap: 3, alignItems: 'flex-start', minWidth: 72,
  },
  iconWrap: { marginBottom: 2 },
  label: { color: staticTheme.colors.gray[500] },
  value: {},
});

// ─── SortModal ────────────────────────────────────────────────────────────────

interface SortModalProps {
  visible: boolean; current: SortKey;
  onSelect: (key: SortKey) => void; onClose: () => void;
}

const SortModal: React.FC<SortModalProps> = React.memo(
  ({ visible, current, onSelect, onClose }) => {
    const theme = useAppTheme();

    const dynSortStyles = useMemo(() => StyleSheet.create({
      sheet: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: staticTheme.borderRadius['2xl'],
        borderTopRightRadius: staticTheme.borderRadius['2xl'],
        paddingHorizontal: staticTheme.spacing.md,
        paddingTop: staticTheme.spacing.md,
        paddingBottom: staticTheme.spacing.xl,
        ...staticTheme.shadows.xl,
      },
      sortText: { color: theme.colors.text },
      optionActive: { backgroundColor: staticTheme.colors.primary[50] },
      optionPressed: { backgroundColor: theme.colors.gray[100] },
    }), [theme]);

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={sortStyles.overlay} onPress={onClose}>
          <View style={dynSortStyles.sheet}>
            <View style={sortStyles.header}>
              <Text variant="body" weight="semibold" style={dynSortStyles.sortText}>Sort by</Text>
              <Pressable onPress={onClose} hitSlop={8}><X size={20} color={theme.colors.gray[500]} /></Pressable>
            </View>
            {SORT_OPTIONS.map((opt) => {
              const isActive = opt.key === current;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    sortStyles.option,
                    isActive && dynSortStyles.optionActive,
                    pressed && dynSortStyles.optionPressed,
                  ]}
                  onPress={() => onSelect(opt.key)}
                  accessibilityRole="menuitem"
                >
                  <Text variant="body" weight={isActive ? 'semibold' : 'normal'}
                    style={{ color: isActive ? staticTheme.colors.primary[500] : theme.colors.text }}>
                    {opt.label}
                  </Text>
                  {isActive && <Check size={16} color={staticTheme.colors.primary[500]} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    );
  },
);
SortModal.displayName = 'SortModal';

const sortStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: staticTheme.spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: staticTheme.spacing.sm, borderRadius: staticTheme.borderRadius.md },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();

  // Push directly onto the inventory Stack — avoids Drawer interception
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

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let outOfStock = 0;
    let totalValue = 0;
    for (const item of allItems) {
      if (item.quantity === 0) outOfStock++;
      totalValue += item.quantity * (item.costPrice ?? item.price ?? 0);
    }
    return { total: allItems.length, lowStock: lowStockCount, outOfStock, totalValue };
  }, [allItems, lowStockCount]);

  // ── Filtered + sorted list (search only — no category filter) ──────────────

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

  const handleItemPress = useCallback(
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

  // ── Dynamic styles ─────────────────────────────────────────────────────────

  const dynStyles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    alertBanner: {
      flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm,
      marginHorizontal: staticTheme.spacing.md,
      backgroundColor: staticTheme.colors.warning[50], borderWidth: 1,
      borderColor: staticTheme.colors.warning[200], borderRadius: staticTheme.borderRadius.lg,
      paddingHorizontal: staticTheme.spacing.md, paddingVertical: staticTheme.spacing.sm,
    },
    categorySectionLabel: {
      color: theme.colors.gray[400],
      letterSpacing: 0.6,
    },
    categoryIconWrap: {
      width: 44,
      height: 44,
      borderRadius: staticTheme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      ...staticTheme.shadows.sm,
    },
    sortButton: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: staticTheme.colors.primary[50], borderRadius: staticTheme.borderRadius.md,
      borderWidth: 1, borderColor: staticTheme.colors.primary[100],
    },
    resultCount: { color: theme.colors.gray[500] },
  }), [theme]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => <InventoryItemCard item={item} onPress={handleItemPress} />,
    [handleItemPress],
  );

  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      {lowStockCount > 0 && (
        <Pressable style={dynStyles.alertBanner} onPress={handleLowStockPress}
          accessibilityRole="button" accessibilityLabel={`${lowStockCount} items below reorder level`}>
          <View style={styles.alertIconWrap}>
            <AlertTriangle size={16} color={staticTheme.colors.warning[600]} />
          </View>
          <View style={styles.alertTextGroup}>
            <Text variant="body-sm" weight="semibold" style={styles.alertTitle}>Low Stock Alert</Text>
            <Text variant="body-xs" style={styles.alertSub}>
              {lowStockCount} item{lowStockCount > 1 ? 's' : ''} at or below reorder level
            </Text>
          </View>
          <Text variant="body-xs" weight="semibold" style={styles.alertCta}>View</Text>
        </Pressable>
      )}

      <View style={styles.controlsRow}>
        <Pressable style={({ pressed }) => [dynStyles.sortButton, pressed && styles.sortButtonPressed]}
          onPress={openSort} accessibilityRole="button">
          <ArrowUpDown size={14} color={staticTheme.colors.primary[500]} />
          <Text variant="body-xs" weight="medium" style={styles.sortLabel} numberOfLines={1}>{sortLabel}</Text>
        </Pressable>
        <Text variant="body-xs" style={dynStyles.resultCount}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [lowStockCount, sortLabel, items.length, handleLowStockPress, openSort, dynStyles]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={filter.searchQuery.length > 0 ? 'No results found' : 'Inventory is empty'}
      description={filter.searchQuery.length > 0
        ? 'Try adjusting your search.'
        : 'Use the category links above to add your first item.'}
      icon={<Package size={28} color={staticTheme.colors.primary[400]} />}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filter.searchQuery]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {/* Stats bar */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <StatCard label="Total Items" value={String(stats.total)}
            icon={<Package size={14} color={staticTheme.colors.primary[500]} />}
            valueColor={staticTheme.colors.primary[500]} bgColor={staticTheme.colors.primary[50]} borderColor={staticTheme.colors.primary[100]} />
          <StatCard label="Low Stock" value={String(stats.lowStock)}
            icon={<TrendingDown size={14} color={staticTheme.colors.warning[600]} />}
            valueColor={stats.lowStock > 0 ? staticTheme.colors.warning[600] : staticTheme.colors.gray[400]}
            bgColor={stats.lowStock > 0 ? staticTheme.colors.warning[50] : staticTheme.colors.gray[50]}
            borderColor={stats.lowStock > 0 ? staticTheme.colors.warning[200] : staticTheme.colors.gray[200]} />
          <StatCard label="Out of Stock" value={String(stats.outOfStock)}
            icon={<AlertTriangle size={14} color={staticTheme.colors.error[500]} />}
            valueColor={stats.outOfStock > 0 ? staticTheme.colors.error[500] : staticTheme.colors.gray[400]}
            bgColor={stats.outOfStock > 0 ? staticTheme.colors.error[50] : staticTheme.colors.gray[50]}
            borderColor={stats.outOfStock > 0 ? staticTheme.colors.error[200] : staticTheme.colors.gray[200]} />
          <StatCard label="Total Value" value={formatCurrency(stats.totalValue)}
            icon={<ShoppingBag size={14} color={staticTheme.colors.success[500]} />}
            valueColor={staticTheme.colors.success[600]} bgColor={staticTheme.colors.success[50]} borderColor={staticTheme.colors.success[100]} />
        </View>
      </View>

      {/* Category navigation links */}
      <View style={styles.categorySection}>
        <Text variant="body-xs" weight="semibold" style={dynStyles.categorySectionLabel}>MANAGE BY CATEGORY</Text>
        <View style={styles.categoryRow}>
          {CATEGORY_LINKS.map((link) => (
            <Pressable
              key={link.screenName}
              style={({ pressed }) => [
                styles.categoryCard,
                { backgroundColor: link.bg, borderColor: link.border },
                pressed && styles.categoryCardPressed,
              ]}
              onPress={() => navigateToCategory(link.screenName)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${link.label}`}
            >
              <View style={dynStyles.categoryIconWrap}>
                {link.icon}
              </View>
              <Text variant="body-xs" weight="semibold" style={{ color: link.color }} numberOfLines={1}>
                {link.label}
              </Text>
              <ChevronRight size={12} color={link.color} style={styles.categoryChevron} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search bar */}
      <View style={dynStyles.searchContainer}>
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
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={staticTheme.colors.primary[500]} colors={[staticTheme.colors.primary[500]]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={10}
      />

      {/* Sort modal */}
      <SortModal visible={sortVisible} current={sortKey} onSelect={handleSortSelect} onClose={closeSort} />
    </View>
  );
}

// ─── Static styles (layout + brand palette only) ──────────────────────────────

const styles = StyleSheet.create({
  // Stats
  statsContainer: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },

  // Category links
  categorySection: {
    paddingHorizontal: staticTheme.spacing.md,
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
    gap: staticTheme.spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
  },
  categoryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: staticTheme.borderRadius.lg,
    padding: staticTheme.spacing.sm,
    alignItems: 'center',
    gap: 6,
    ...staticTheme.shadows.sm,
  },
  categoryCardPressed: {
    opacity: 0.8,
  },
  categoryChevron: {
    alignSelf: 'flex-end',
  },

  // List header
  listHeader: {
    paddingTop: staticTheme.spacing.sm,
    paddingBottom: staticTheme.spacing.xs,
    gap: staticTheme.spacing.xs,
  },
  alertIconWrap: {
    width: 32, height: 32, borderRadius: staticTheme.borderRadius.md,
    backgroundColor: staticTheme.colors.warning[100], alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  alertTextGroup: { flex: 1, gap: 1 },
  alertTitle:     { color: staticTheme.colors.warning[700] },
  alertSub:       { color: staticTheme.colors.warning[600] },
  alertCta:       { color: staticTheme.colors.warning[700], textDecorationLine: 'underline', flexShrink: 0 },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md, paddingVertical: 4,
  },
  sortButtonPressed: { opacity: 0.75 },
  sortLabel:    { color: staticTheme.colors.primary[600], maxWidth: 120 },

  listContent:      { paddingBottom: staticTheme.spacing.xl },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
});
