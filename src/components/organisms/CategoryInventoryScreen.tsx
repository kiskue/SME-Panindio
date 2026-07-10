/**
 * CategoryInventoryScreen
 *
 * Airy 2026 redesign. Shared screen used by the Products, Ingredients, and
 * Equipment routes.
 *
 * Phone:
 *   Hero → Search → FlatList of InventoryItemCard (single column) → FAB.
 *   Tapping an item navigates to its detail/edit screen.
 *
 * Tablet (width >= 768, works in portrait — no rotation required):
 *   Hero → Search → master-detail row: item list (left) + read-only detail
 *   pane (right). Tapping an item SELECTS it in the pane; the pane's "Edit"
 *   button opens the full edit form.
 *
 * Category accent / icon come from the shared `getInventoryAccent` source of
 * truth; pull-to-refresh re-hydrates from SQLite via `useRefreshControl`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Plus, ArrowUpDown } from 'lucide-react-native';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { CardRowSkeleton } from '@/components/molecules/Skeletons';
import { ProductTypeSelectionSheet } from '@/components/molecules/ProductTypeSelectionSheet';
import { SortSheet } from '@/components/molecules/SortSheet';
import { InventoryActionSheet } from '@/components/molecules/InventoryActionSheet';
import { InventoryStockAddSheet } from '@/components/molecules/InventoryStockAddSheet';
import { Text } from '@/components/atoms/Text';
import { InventoryItemCard } from '@/components/organisms/InventoryItemCard';
import { InventoryItemDetailSummary } from '@/components/organisms/InventoryItemDetailSummary';
import { useInventoryStore, selectAllItems, selectInventoryLoading, selectItemById } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { getInventoryAccent } from '@/core/theme/inventoryAccents';
import { theme as staticTheme } from '@/core/theme';
import { SORT_OPTIONS, applyInventorySort, type SortKey } from '@/core/utils/sort';
import { useResponsive, useRefreshControl, useInventoryItemActions } from '@/hooks';
import type { InventoryItem, InventoryCategory, ProductType } from '@/types';

// ─── Category copy (non-color text only; colors come from getInventoryAccent) ──

interface CategoryText {
  title:            string;
  heroSubtitle:     string;
  emptyTitle:       string;
  emptyDescription: string;
}

const CATEGORY_TEXT: Record<InventoryCategory, CategoryText> = {
  product: {
    title:            'Products',
    heroSubtitle:     'Finished goods for sale',
    emptyTitle:       'No products yet',
    emptyDescription: 'Add your first product to start tracking stock and pricing.',
  },
  ingredient: {
    title:            'Ingredients',
    heroSubtitle:     'Raw materials & consumables',
    emptyTitle:       'No ingredients yet',
    emptyDescription: 'Add ingredients to monitor quantities and reorder levels.',
  },
  equipment: {
    title:            'Equipment',
    heroSubtitle:     'Tools and assets',
    emptyTitle:       'No equipment yet',
    emptyDescription: 'Track your tools and assets with condition monitoring.',
  },
};

const keyExtractor = (item: InventoryItem) => item.id;
const FAB_SIZE = 58;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  category: InventoryCategory;
}

export default function CategoryInventoryScreen({ category }: Props) {
  const navigation = useNavigation();
  const theme      = useAppTheme();
  const isDark     = useThemeMode() === 'dark';
  const { isTablet } = useResponsive();

  const accent = getInventoryAccent(category, isDark);
  const text   = CATEGORY_TEXT[category];

  const allItems  = useInventoryStore(selectAllItems);
  const isLoading = useInventoryStore(selectInventoryLoading);

  const [searchQuery,      setSearchQuery]      = useState('');
  const [sortKey,          setSortKey]          = useState<SortKey>('name-asc');
  const [sortVisible,      setSortVisible]      = useState(false);
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  // Master-detail selection (tablet only).
  const [selectedId,       setSelectedId]       = useState<string | null>(null);

  const items = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = allItems.filter((item) => {
      if (item.category !== category) return false;
      if (q.length === 0) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku?.toLowerCase().includes(q) ?? false) ||
        (item.description?.toLowerCase().includes(q) ?? false)
      );
    });
    return applyInventorySort(filtered, sortKey);
  }, [allItems, category, searchQuery, sortKey]);

  // Live item for the detail pane (reflects store mutations immediately).
  const selectedSelector = useMemo(() => selectItemById(selectedId ?? ''), [selectedId]);
  const selectedItem     = useInventoryStore(selectedSelector);

  // Keep a valid selection on tablet: default to the first item; reset when the
  // current selection drops out of the filtered list (search/sort/delete).
  useEffect(() => {
    if (!isTablet) return;
    if (items.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const stillVisible = selectedId !== null && items.some((i) => i.id === selectedId);
    if (!stillVisible) setSelectedId(items[0]?.id ?? null);
  }, [isTablet, items, selectedId]);

  const navigateToDetail = useCallback(
    (item: InventoryItem) => navigation.dispatch(StackActions.push('[id]', { id: item.id })),
    [navigation],
  );

  // Phone: tapping opens the Add Stock / View Details chooser.
  // Tablet: tapping selects the item in the master-detail pane (unchanged); the
  // pane offers Edit + Add Stock buttons directly.
  const { openActions, openStockSheet, actionSheetProps, stockSheetProps } =
    useInventoryItemActions({ onViewDetails: navigateToDetail });

  const handleItemPress = useCallback(
    (item: InventoryItem) => {
      if (isTablet) setSelectedId(item.id);
      else openActions(item);
    },
    [isTablet, openActions],
  );

  const handleAddPress = useCallback(() => {
    if (category === 'product') {
      setTypeSheetVisible(true);
    } else {
      navigation.dispatch(StackActions.push('add', { category }));
    }
  }, [navigation, category]);

  const handleTypeSheetClose = useCallback(() => setTypeSheetVisible(false), []);

  const handleTypeConfirmed = useCallback((productType: ProductType) => {
    setTypeSheetVisible(false);
    navigation.dispatch(StackActions.push('add', { category: 'product', productType }));
  }, [navigation]);

  const { refreshing, onRefresh } = useRefreshControl(
    () => useInventoryStore.getState().initializeInventory(),
  );

  const handleSortSelect = useCallback((key: SortKey) => { setSortKey(key); setSortVisible(false); }, []);
  const openSort  = useCallback(() => setSortVisible(true),  []);
  const closeSort = useCallback(() => setSortVisible(false), []);

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort',
    [sortKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => (
      <InventoryItemCard
        item={item}
        onPress={handleItemPress}
        selected={isTablet && item.id === selectedId}
      />
    ),
    [handleItemPress, isTablet, selectedId],
  );

  // ── Dynamic styles ───────────────────────────────────────────────────────────

  const dynStyles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: staticTheme.spacing.sm + 2,
      marginHorizontal: staticTheme.spacing.md,
      marginTop: staticTheme.spacing.sm,
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm + 2,
      backgroundColor: accent.heroBg,
      borderRadius: staticTheme.borderRadius['2xl'],
      borderWidth: 1,
      borderColor: accent.glow,
    },
    heroIconCircle: {
      width: 42, height: 42, borderRadius: 14,
      backgroundColor: accent.iconBg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: accent.glow,
      flexShrink: 0,
    },
    heroSub: { color: theme.colors.textSecondary },
    searchWrap: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
    },
    detailPane: {
      flex: 3,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.background,
    },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: staticTheme.borderRadius.md,
      backgroundColor: `${accent.accent}1F`,
      borderWidth: 1, borderColor: `${accent.accent}33`,
    },
    sortBtnText: { color: accent.accent, maxWidth: 130 },
    countText:   { color: theme.colors.textSecondary },
    fab: {
      position: 'absolute',
      bottom: staticTheme.spacing.xl,
      right: staticTheme.spacing.lg,
      width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
      backgroundColor: accent.accent,
      alignItems: 'center', justifyContent: 'center',
      ...(isDark ? {
        shadowColor: accent.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 10,
      } : staticTheme.shadows.lg),
    },
  }), [theme, isDark, accent]);

  const ListHeader = useMemo(() => (
    <View style={controlsStyles.row}>
      <Pressable
        style={({ pressed }) => [dynStyles.sortBtn, pressed && pressedFaint]}
        onPress={openSort}
      >
        <ArrowUpDown size={13} color={accent.accent} />
        <Text variant="body-xs" weight="medium" style={dynStyles.sortBtnText} numberOfLines={1}>
          {sortLabel}
        </Text>
      </Pressable>
      <Text variant="body-xs" style={dynStyles.countText}>
        {items.length} item{items.length !== 1 ? 's' : ''}
      </Text>
    </View>
  ), [sortLabel, items.length, openSort, dynStyles, accent.accent]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={searchQuery.length > 0 ? 'No results found' : text.emptyTitle}
      description={searchQuery.length > 0 ? 'Try adjusting your search.' : text.emptyDescription}
      icon={<accent.Icon size={28} color={accent.accent} />}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [searchQuery, text, accent]);

  const list = (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={isLoading && items.length === 0 ? <CardRowSkeleton count={5} /> : ListEmpty}
      contentContainerStyle={[listStyles.content, items.length === 0 && listStyles.contentEmpty]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent.accent} colors={[accent.accent]} />
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={12}
      windowSize={10}
      initialNumToRender={10}
    />
  );

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {/* Hero */}
      <View style={dynStyles.hero}>
        <View style={dynStyles.heroIconCircle}>
          <accent.Icon size={20} color={accent.accent} />
        </View>
        <View style={heroStyles.text}>
          <Text variant="h6" weight="bold" style={{ color: theme.colors.text }} numberOfLines={1}>
            {text.title}
          </Text>
          <Text variant="body-sm" style={dynStyles.heroSub} numberOfLines={1}>
            {text.heroSubtitle}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={dynStyles.searchWrap}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder={`Search ${category === 'ingredient' ? 'ingredients' : category + 's'}...`}
          variant="outlined"
        />
      </View>

      {/* List (phone) or master-detail (tablet) */}
      {isTablet ? (
        <View style={splitStyles.row}>
          <View style={splitStyles.listPane}>{list}</View>
          <View style={dynStyles.detailPane}>
            {selectedItem ? (
              <InventoryItemDetailSummary item={selectedItem} onEdit={navigateToDetail} onAddStock={openStockSheet} />
            ) : (
              <EmptyState
                title="Select an item"
                description="Choose an item from the list to view its details."
                icon={<accent.Icon size={28} color={accent.accent} />}
              />
            )}
          </View>
        </View>
      ) : (
        list
      )}

      {/* FAB */}
      <Pressable
        onPress={handleAddPress}
        style={({ pressed }) => [dynStyles.fab, pressed && fabPressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`Add ${category}`}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      {/* Sort sheet */}
      <SortSheet
        visible={sortVisible}
        current={sortKey}
        accentColor={accent.accent}
        isDark={isDark}
        onSelect={handleSortSelect}
        onClose={closeSort}
      />

      {/* Product type selection — shown before the add form for product category */}
      {category === 'product' && (
        <ProductTypeSelectionSheet
          visible={typeSheetVisible}
          onClose={handleTypeSheetClose}
          onConfirm={handleTypeConfirmed}
        />
      )}

      {/* Tap-to-choose chooser (phone) + the shared stock-entry sheet */}
      <InventoryActionSheet {...actionSheetProps} />
      <InventoryStockAddSheet {...stockSheetProps} />
    </View>
  );
}

const pressedFaint = { opacity: 0.75 } as const;
const fabPressedStyle = { opacity: 0.85, transform: [{ scale: 0.94 }] } as const;

const heroStyles = StyleSheet.create({
  text: { flex: 1, gap: 1, minWidth: 0 },
});

const splitStyles = StyleSheet.create({
  row:      { flex: 1, flexDirection: 'row' },
  listPane: { flex: 2 },
});

const controlsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 8,
  },
});

const listStyles = StyleSheet.create({
  content:      { paddingBottom: FAB_SIZE + staticTheme.spacing.xl * 2 },
  contentEmpty: { flexGrow: 1, justifyContent: 'center' },
});
