import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Switch, RefreshControl } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { SearchBar, StatusBadge, EmptyState, CardRowSkeleton, CatalogListingSheet } from '@/components/molecules';
import { PackageSearch } from 'lucide-react-native';
import { useAppDialog } from '@/hooks';
import { useRefreshControl } from '@/hooks';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, selectCurrentUser, useInventoryStore } from '@/store';
import { useSukiBusinessStore, selectCatalogItems, selectCatalogLoading, selectSukiBusinessError } from '@/store';
import { useAppTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import type { InventoryItem } from '@/types';

export default function OnlineCatalogScreen() {
  const dialog = useAppDialog();
  const theme = useAppTheme();

  const user = useAuthStore(selectCurrentUser);

  const allItems = useInventoryStore(useShallow((s) => s.items));
  const products = useMemo(
    () => allItems.filter((item) => item.category === 'product'),
    [allItems],
  );

  const catalogItems = useSukiBusinessStore(selectCatalogItems);
  const isCatalogLoading = useSukiBusinessStore(selectCatalogLoading);
  const error = useSukiBusinessStore(selectSukiBusinessError);
  const loadCatalog = useSukiBusinessStore((s) => s.loadCatalog);
  const toggleCatalogItem = useSukiBusinessStore((s) => s.toggleCatalogItem);

  const [search, setSearch] = useState('');
  /** Product whose online listing is being managed in the sheet (null = closed). */
  const [managingItem, setManagingItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (user?.id) void loadCatalog(user.id);
  }, [user?.id, loadCatalog]);

  const { refreshing, onRefresh } = useRefreshControl(async () => {
    if (user?.id) await loadCatalog(user.id);
  });

  // Memoize the map so handleToggle always reads a consistent snapshot and
  // the reference is only rebuilt when catalogItems actually changes.
  const catalogMap = useMemo(
    () => new Map(catalogItems.map((c) => [c.productId, c])),
    [catalogItems],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        if (!search.trim()) return true;
        return p.name.toLowerCase().includes(search.toLowerCase());
      }),
    [products, search],
  );

  const handleToggle = useCallback(
    async (product: InventoryItem, val: boolean) => {
      if (!user?.id) return;
      const existing = catalogMap.get(product.id);
      // Only toggles availability on an already-listed product — the manually
      // allocated online stock is PRESERVED (omit stockQuantity so the server
      // leaves it unchanged). New listings go through the sheet ("List") so the
      // owner sets the allocation explicitly rather than auto-pushing on-hand.
      if (!existing) return;
      try {
        await toggleCatalogItem(product.id, val, user.id);
      } catch (err) {
        dialog.show({
          variant: 'error',
          title: 'Catalog Update Failed',
          message: err instanceof Error ? err.message : 'Could not update the catalog. Please try again.',
        });
      }
    },
    [user?.id, catalogMap, toggleCatalogItem, dialog],
  );

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const catalogEntry = catalogMap.get(item.id);
    const isListed = !!catalogEntry;
    const isAvailable = catalogEntry?.isAvailable ?? false;
    const allocated = catalogEntry?.stockQuantity ?? 0;
    const outOfStock = isListed && isAvailable && allocated <= 0;

    const stateLabel = !isListed
      ? 'Not listed'
      : !isAvailable
        ? 'Unavailable'
        : outOfStock
          ? 'Out of stock'
          : 'Listed';
    const stateColor = !isListed || !isAvailable
      ? theme.colors.textSecondary
      : outOfStock
        ? theme.colors.tintHighlight
        : theme.colors.tintAccent;

    return (
      <Card variant="elevated" padding="md" borderRadius="lg" style={styles.card}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text variant="body-sm" weight="semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
              {item.name}
            </Text>
            <Text variant="body-sm" weight="bold" style={{ color: theme.colors.tintPrimary }}>
              {formatCurrency(Number(catalogEntry?.customPrice ?? item.price ?? 0))}
            </Text>
            <Text variant="body-xs" style={{ color: theme.colors.textSecondary }}>
              {isListed
                ? `Online: ${allocated}  ·  On hand: ${item.quantity} ${item.unit}`
                : `On hand: ${item.quantity} ${item.unit}`}
            </Text>
            <StatusBadge
              size="sm"
              label={stateLabel}
              backgroundColor={theme.colors.surfaceSubtle}
              textColor={stateColor}
              style={styles.stateBadge}
            />
            {!!item.sku && (
              <Text variant="body-xs" style={{ color: theme.colors.textSecondary, opacity: 0.7 }}>
                Barcode: {item.sku}
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            {isListed ? (
              <>
                <Switch
                  value={isAvailable}
                  onValueChange={(val) => handleToggle(item, val)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.accent[500] }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel={`${isAvailable ? 'Hide' : 'Show'} ${item.name} in the online store`}
                />
                <Button
                  title="Manage"
                  variant="ghost"
                  size="sm"
                  onPress={() => setManagingItem(item)}
                />
              </>
            ) : (
              <Button
                title="List"
                variant="primary"
                size="sm"
                onPress={() => setManagingItem(item)}
              />
            )}
          </View>
        </View>
      </Card>
    );
  };

  const listBody = () => {
    if (isCatalogLoading && catalogItems.length === 0) {
      return <CardRowSkeleton count={6} />;
    }
    if (error && catalogItems.length === 0) {
      return (
        <EmptyState
          size="md"
          title="Couldn't load catalog"
          description="Please check your connection and try again."
          icon={<PackageSearch size={28} color={theme.colors.textSecondary} />}
          action={{ label: 'Retry', onPress: () => user?.id && void loadCatalog(user.id) }}
        />
      );
    }
    if (filteredProducts.length === 0) {
      return (
        <EmptyState
          size="md"
          title={search.trim() ? 'No products found' : 'No products yet'}
          description={
            search.trim()
              ? 'Try a different search term.'
              : 'Add products in your Inventory first, then list them for online ordering here.'
          }
          icon={<PackageSearch size={28} color={theme.colors.textSecondary} />}
        />
      );
    }
    return (
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.tintPrimary} />}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search products…" />
      </View>

      <Text variant="body-xs" style={[styles.hint, { color: theme.colors.textSecondary }]}>
        Tap “List” to choose how many units to sell online and set the price. Use “Manage” to adjust stock or
        availability anytime — changes sync to customers instantly.
      </Text>

      {listBody()}

      {managingItem && user?.id && (
        <CatalogListingSheet
          visible={!!managingItem}
          item={managingItem}
          {...(catalogMap.get(managingItem.id)
            ? { existing: catalogMap.get(managingItem.id)! }
            : {})}
          businessId={user.id}
          onClose={() => setManagingItem(null)}
          onSuccess={() => {
            if (user?.id) void loadCatalog(user.id);
          }}
        />
      )}

      {dialog.Dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  hint: { paddingHorizontal: 16, paddingVertical: 8, lineHeight: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },
  card: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 2 },
  stateBadge: { marginTop: 2 },
  actions: { alignItems: 'center', gap: 4 },
});
