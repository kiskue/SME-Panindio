/**
 * CategoryInventoryScreen
 *
 * Shared screen used by Products, Ingredients, and Equipment routes.
 * Renders a filtered FlatList for one category + a FAB to add a new item.
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
import { Plus, Package, Wheat, Wrench, ArrowUpDown, Check, X } from 'lucide-react-native';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { Text } from '@/components/atoms/Text';
import { InventoryItemCard } from '@/components/organisms/InventoryItemCard';
import { useInventoryStore, selectAllItems } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem, InventoryCategory } from '@/types';

// ─── Config ───────────────────────────────────────────────────────────────────
// Brand palette colors (primary/success/highlight) are stable across modes.

const CATEGORY_CONFIG = {
  product: {
    emptyTitle:       'No products yet',
    emptyDescription: 'Add your first product to start tracking stock and pricing.',
    icon:             <Package size={28} color={staticTheme.colors.primary[400]} />,
    fabColor:         staticTheme.colors.primary[500],
    accentColor:      staticTheme.colors.primary[500],
  },
  ingredient: {
    emptyTitle:       'No ingredients yet',
    emptyDescription: 'Add ingredients to monitor quantities and reorder levels.',
    icon:             <Wheat size={28} color={staticTheme.colors.success[500]} />,
    fabColor:         staticTheme.colors.success[500],
    accentColor:      staticTheme.colors.success[500],
  },
  equipment: {
    emptyTitle:       'No equipment yet',
    emptyDescription: 'Track your tools and assets with condition monitoring.',
    icon:             <Wrench size={28} color={staticTheme.colors.highlight[400]} />,
    fabColor:         staticTheme.colors.highlight[400],
    accentColor:      staticTheme.colors.highlight[400],
  },
} as const;

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'name-asc' | 'name-desc' | 'qty-asc' | 'qty-desc' | 'recently-added';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name-asc',       label: 'Name A \u2192 Z' },
  { key: 'name-desc',      label: 'Name Z \u2192 A' },
  { key: 'qty-asc',        label: 'Qty: Low to High' },
  { key: 'qty-desc',       label: 'Qty: High to Low' },
  { key: 'recently-added', label: 'Recently Added' },
];

function applySort(items: InventoryItem[], sort: SortKey): InventoryItem[] {
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

const keyExtractor = (item: InventoryItem) => item.id;

const FAB_SIZE = 56;

// ─── SortModal ────────────────────────────────────────────────────────────────

interface SortModalProps {
  visible: boolean; current: SortKey; accentColor: string;
  onSelect: (key: SortKey) => void; onClose: () => void;
}

const SortModal: React.FC<SortModalProps> = React.memo(
  ({ visible, current, accentColor, onSelect, onClose }) => {
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
                    isActive && { backgroundColor: `${accentColor}15` },
                    pressed && dynSortStyles.optionPressed,
                  ]}
                  onPress={() => onSelect(opt.key)}
                  accessibilityRole="menuitem"
                >
                  <Text variant="body" weight={isActive ? 'semibold' : 'normal'}
                    style={{ color: isActive ? accentColor : theme.colors.text }}>
                    {opt.label}
                  </Text>
                  {isActive && <Check size={16} color={accentColor} />}
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: staticTheme.spacing.sm,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: staticTheme.spacing.sm, borderRadius: staticTheme.borderRadius.md,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  category: InventoryCategory;
}

export default function CategoryInventoryScreen({ category }: Props) {
  const navigation = useNavigation();
  const theme      = useAppTheme();
  const config     = CATEGORY_CONFIG[category];
  const allItems   = useInventoryStore(selectAllItems);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing,  setRefreshing]  = useState(false);
  const [sortKey,     setSortKey]     = useState<SortKey>('name-asc');
  const [sortVisible, setSortVisible] = useState(false);

  // Filtered + sorted
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
    return applySort(filtered, sortKey);
  }, [allItems, category, searchQuery, sortKey]);

  const handleItemPress = useCallback(
    (item: InventoryItem) =>
      navigation.dispatch(StackActions.push('[id]', { id: item.id })),
    [navigation],
  );

  const handleAddPress = useCallback(
    () => navigation.dispatch(StackActions.push('add', { category })),
    [navigation, category],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleSortSelect = useCallback((key: SortKey) => { setSortKey(key); setSortVisible(false); }, []);
  const openSort  = useCallback(() => setSortVisible(true),  []);
  const closeSort = useCallback(() => setSortVisible(false), []);

  const sortLabel = useMemo(() => SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort', [sortKey]);

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => <InventoryItemCard item={item} onPress={handleItemPress} />,
    [handleItemPress],
  );

  const dynStyles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    searchContainer: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
      backgroundColor: theme.colors.background,
    },
    sortButton: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: staticTheme.borderRadius.md, borderWidth: 1,
    },
    resultCount: { color: theme.colors.gray[500] },
  }), [theme]);

  const ListHeader = useMemo(() => (
    <View style={styles.listHeader}>
      <View style={styles.controlsRow}>
        <Pressable
          style={({ pressed }) => [dynStyles.sortButton, { borderColor: `${config.accentColor}30` }, pressed && styles.sortButtonPressed]}
          onPress={openSort}
        >
          <ArrowUpDown size={14} color={config.accentColor} />
          <Text variant="body-xs" weight="medium" style={[styles.sortLabel, { color: config.accentColor }]} numberOfLines={1}>
            {sortLabel}
          </Text>
        </Pressable>
        <Text variant="body-xs" style={dynStyles.resultCount}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sortLabel, items.length, openSort, config.accentColor, dynStyles]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={searchQuery.length > 0 ? 'No results found' : config.emptyTitle}
      description={searchQuery.length > 0 ? 'Try adjusting your search.' : config.emptyDescription}
      icon={config.icon}
      {...(searchQuery.length === 0
        ? { action: { label: 'Add Item', onPress: handleAddPress, variant: 'primary' as const } }
        : {})}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [searchQuery, handleAddPress]);

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {/* Search */}
      <View style={dynStyles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder={`Search ${category === 'ingredient' ? 'ingredients' : category + 's'}...`}
          variant="outlined"
        />
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
            tintColor={config.accentColor} colors={[config.accentColor]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={10}
      />

      {/* FAB */}
      <Pressable
        onPress={handleAddPress}
        style={({ pressed }) => [styles.fab, { backgroundColor: config.fabColor }, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Add ${category}`}
      >
        <Plus size={26} color={staticTheme.colors.white} strokeWidth={2.5} />
      </Pressable>

      {/* Sort modal */}
      <SortModal
        visible={sortVisible}
        current={sortKey}
        accentColor={config.accentColor}
        onSelect={handleSortSelect}
        onClose={closeSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingTop: staticTheme.spacing.xs,
    paddingBottom: staticTheme.spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: staticTheme.spacing.md, paddingVertical: 4,
  },
  sortButtonPressed: { opacity: 0.75 },
  sortLabel:   { maxWidth: 130 },
  listContent:      { paddingBottom: FAB_SIZE + staticTheme.spacing.xl * 2 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  fab: {
    position: 'absolute',
    bottom: staticTheme.spacing.xl,
    right: staticTheme.spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...staticTheme.shadows.lg,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
