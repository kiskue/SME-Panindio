/**
 * CategoryInventoryScreen
 *
 * Dark-mode-first redesign.
 * Shared screen used by Products, Ingredients, and Equipment routes.
 *
 * Layout:
 *   1. Category hero header  — icon, title, item count, accent glow
 *   2. Search bar            — glassmorphism pill style
 *   3. Sort + count controls
 *   4. FlatList              — InventoryItemCard items
 *   5. FAB                   — add new item, accent-colored with glow
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
import { CardRowSkeleton } from '@/components/molecules/Skeletons';
import { Text } from '@/components/atoms/Text';
import { InventoryItemCard } from '@/components/organisms/InventoryItemCard';
import { useInventoryStore, selectAllItems, selectInventoryLoading, useThemeStore, selectThemeMode } from '@/store';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem, InventoryCategory } from '@/types';

// ─── Category config ───────────────────────────────────────────────────────────

interface CategoryMeta {
  emptyTitle:       string;
  emptyDescription: string;
  emptyIcon:        React.ReactNode;
  heroTitle:        string;
  heroSubtitle:     string;
  // Dark-mode neon accents
  darkAccent:       string;
  darkGlow:         string;
  darkHeroBg:       string;
  darkIconBg:       string;
  // Light-mode brand tones
  lightAccent:      string;
  lightHeroBg:      string;
  lightIconBg:      string;
  fabColor:         string;
  darkFabColor:     string;
  Icon:             React.ComponentType<{ size: number; color: string }>;
}

const CATEGORY_CONFIG: Record<InventoryCategory, CategoryMeta> = {
  product: {
    emptyTitle:       'No products yet',
    emptyDescription: 'Add your first product to start tracking stock and pricing.',
    emptyIcon:        <Package size={28} color={staticTheme.colors.primary[400]} />,
    heroTitle:        'Products',
    heroSubtitle:     'Finished goods for sale',
    darkAccent:       '#4F9EFF',
    darkGlow:         'rgba(79,158,255,0.20)',
    darkHeroBg:       'rgba(79,158,255,0.08)',
    darkIconBg:       'rgba(79,158,255,0.18)',
    lightAccent:      staticTheme.colors.primary[500],
    lightHeroBg:      staticTheme.colors.primary[50],
    lightIconBg:      staticTheme.colors.primary[100],
    fabColor:         staticTheme.colors.primary[500],
    darkFabColor:     '#4F9EFF',
    Icon:             Package,
  },
  ingredient: {
    emptyTitle:       'No ingredients yet',
    emptyDescription: 'Add ingredients to monitor quantities and reorder levels.',
    emptyIcon:        <Wheat size={28} color={staticTheme.colors.success[500]} />,
    heroTitle:        'Ingredients',
    heroSubtitle:     'Raw materials & consumables',
    darkAccent:       '#3DD68C',
    darkGlow:         'rgba(61,214,140,0.18)',
    darkHeroBg:       'rgba(61,214,140,0.07)',
    darkIconBg:       'rgba(61,214,140,0.18)',
    lightAccent:      staticTheme.colors.success[500],
    lightHeroBg:      staticTheme.colors.success[50],
    lightIconBg:      staticTheme.colors.success[100],
    fabColor:         staticTheme.colors.success[500],
    darkFabColor:     '#3DD68C',
    Icon:             Wheat,
  },
  equipment: {
    emptyTitle:       'No equipment yet',
    emptyDescription: 'Track your tools and assets with condition monitoring.',
    emptyIcon:        <Wrench size={28} color={staticTheme.colors.highlight[400]} />,
    heroTitle:        'Equipment',
    heroSubtitle:     'Tools and assets',
    darkAccent:       '#FFB020',
    darkGlow:         'rgba(255,176,32,0.18)',
    darkHeroBg:       'rgba(255,176,32,0.07)',
    darkIconBg:       'rgba(255,176,32,0.18)',
    lightAccent:      staticTheme.colors.highlight[400],
    lightHeroBg:      staticTheme.colors.highlight[50],
    lightIconBg:      staticTheme.colors.highlight[100],
    fabColor:         staticTheme.colors.highlight[400],
    darkFabColor:     '#FFB020',
    Icon:             Wrench,
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
const FAB_SIZE = 58;

// ─── SortModal ────────────────────────────────────────────────────────────────

interface SortModalProps {
  visible: boolean;
  current: SortKey;
  accentColor: string;
  isDark: boolean;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

const SortModal: React.FC<SortModalProps> = React.memo(
  ({ visible, current, accentColor, isDark, onSelect, onClose }) => {
    const theme = useAppTheme();
    const sheetBg = isDark ? '#1A1F2E' : theme.colors.surface;

    const dynStyles = useMemo(() => StyleSheet.create({
      sheet: {
        backgroundColor: sheetBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: staticTheme.spacing.md,
        paddingTop: staticTheme.spacing.md,
        paddingBottom: staticTheme.spacing.xl,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
        ...(isDark ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 20,
        } : staticTheme.shadows.xl),
      },
      title:         { color: theme.colors.text },
      optionActive:  { backgroundColor: `${accentColor}15` },
      optionPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.colors.gray[100] },
      handle:        { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300] },
    }), [theme, sheetBg, isDark, accentColor]);

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
                  <Text
                    variant="body"
                    weight={isActive ? 'semibold' : 'normal'}
                    style={{ color: isActive ? accentColor : theme.colors.text }}
                  >
                    {opt.label}
                  </Text>
                  {isActive && <Check size={16} color={accentColor} />}
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
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: staticTheme.spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: staticTheme.spacing.sm,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.md,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  category: InventoryCategory;
}

export default function CategoryInventoryScreen({ category }: Props) {
  const navigation = useNavigation();
  const theme      = useAppTheme();
  const mode       = useThemeStore(selectThemeMode);
  const isDark     = mode === 'dark';
  const config     = CATEGORY_CONFIG[category];
  const allItems   = useInventoryStore(selectAllItems);
  const isLoading  = useInventoryStore(selectInventoryLoading);

  const accentColor = isDark ? config.darkAccent : config.lightAccent;
  const heroBg      = isDark ? config.darkHeroBg : config.lightHeroBg;
  const iconBg      = isDark ? config.darkIconBg : config.lightIconBg;
  const fabColor    = isDark ? config.darkFabColor : config.fabColor;

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing,  setRefreshing]  = useState(false);
  const [sortKey,     setSortKey]     = useState<SortKey>('name-asc');
  const [sortVisible, setSortVisible] = useState(false);

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

  const handleSortSelect = useCallback(
    (key: SortKey) => { setSortKey(key); setSortVisible(false); },
    [],
  );
  const openSort  = useCallback(() => setSortVisible(true),  []);
  const closeSort = useCallback(() => setSortVisible(false), []);

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort',
    [sortKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => <InventoryItemCard item={item} onPress={handleItemPress} />,
    [handleItemPress],
  );

  // Dynamic styles
  const dynStyles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    hero: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingTop: staticTheme.spacing.md,
      paddingBottom: staticTheme.spacing.md,
      backgroundColor: heroBg,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? `${accentColor}18` : `${accentColor}20`,
    },
    heroIconCircle: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: iconBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? `${accentColor}30` : `${accentColor}35`,
    },
    heroTitle: { color: isDark ? '#FFFFFF' : theme.colors.text },
    heroSub:   { color: isDark ? 'rgba(255,255,255,0.50)' : theme.colors.gray[500] },
    countBadge: {
      backgroundColor: `${accentColor}18`,
      borderRadius: staticTheme.borderRadius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: `${accentColor}30`,
    },
    searchWrap: {
      paddingHorizontal: staticTheme.spacing.md,
      paddingVertical: staticTheme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.borderSubtle,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : theme.colors.background,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: staticTheme.borderRadius.md,
      backgroundColor: `${accentColor}12`,
      borderWidth: 1,
      borderColor: `${accentColor}28`,
    },
    sortBtnText: { color: accentColor, maxWidth: 130 },
    countText:   { color: isDark ? 'rgba(255,255,255,0.38)' : theme.colors.gray[500] },
    fab: {
      position: 'absolute',
      bottom: staticTheme.spacing.xl,
      right: staticTheme.spacing.lg,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: fabColor,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isDark ? {
        shadowColor: fabColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 10,
      } : staticTheme.shadows.lg),
    },
  }), [theme, isDark, heroBg, iconBg, accentColor, fabColor]);

  const ListHeader = useMemo(() => (
    <View style={controlsStyles.row}>
      <Pressable
        style={({ pressed }) => [dynStyles.sortBtn, pressed && { opacity: 0.75 }]}
        onPress={openSort}
      >
        <ArrowUpDown size={13} color={accentColor} />
        <Text variant="body-xs" weight="medium" style={dynStyles.sortBtnText} numberOfLines={1}>
          {sortLabel}
        </Text>
      </Pressable>
      <Text variant="body-xs" style={dynStyles.countText}>
        {items.length} item{items.length !== 1 ? 's' : ''}
      </Text>
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sortLabel, items.length, openSort, dynStyles, accentColor]);

  const ListEmpty = useMemo(() => (
    <EmptyState
      title={searchQuery.length > 0 ? 'No results found' : config.emptyTitle}
      description={searchQuery.length > 0 ? 'Try adjusting your search.' : config.emptyDescription}
      icon={config.emptyIcon}
      {...(searchQuery.length === 0
        ? { action: { label: 'Add Item', onPress: handleAddPress, variant: 'primary' as const } }
        : {})}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [searchQuery, handleAddPress]);

  return (
    <View style={dynStyles.root}>
      <StatusBar style="light" />

      {/* Hero header */}
      <View style={dynStyles.hero}>
        <View style={heroStyles.row}>
          <View style={dynStyles.heroIconCircle}>
            <config.Icon size={22} color={accentColor} />
          </View>
          <View style={heroStyles.textGroup}>
            <Text variant="h4" weight="bold" style={dynStyles.heroTitle}>
              {config.heroTitle}
            </Text>
            <Text variant="body-sm" style={dynStyles.heroSub}>
              {config.heroSubtitle}
            </Text>
          </View>
          <View style={dynStyles.countBadge}>
            <Text variant="body-sm" weight="semibold" style={{ color: accentColor }}>
              {items.length}
            </Text>
          </View>
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

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={isLoading && items.length === 0 ? <CardRowSkeleton count={5} /> : ListEmpty}
        contentContainerStyle={[
          listStyles.content,
          items.length === 0 && listStyles.contentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
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
        style={({ pressed }) => [dynStyles.fab, pressed && fabPressedStyle]}
        accessibilityRole="button"
        accessibilityLabel={`Add ${category}`}
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      {/* Sort modal */}
      <SortModal
        visible={sortVisible}
        current={sortKey}
        accentColor={accentColor}
        isDark={isDark}
        onSelect={handleSortSelect}
        onClose={closeSort}
      />
    </View>
  );
}

const fabPressedStyle = { opacity: 0.85, transform: [{ scale: 0.94 }] } as const;

const heroStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: staticTheme.spacing.sm },
  textGroup: { flex: 1, gap: 2 },
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
