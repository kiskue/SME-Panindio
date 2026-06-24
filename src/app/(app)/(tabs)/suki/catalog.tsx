import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'expo-router';
import { useAuthStore, selectCurrentUser, useInventoryStore } from '@/store';
import { useSukiBusinessStore, selectCatalogItems, selectCatalogLoading } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { InventoryItem } from '@/types';

export default function OnlineCatalogScreen() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const user = useAuthStore(selectCurrentUser);

  const allItems = useInventoryStore(useShallow((s) => s.items));
  const products = useMemo(
    () => allItems.filter((item) => item.category === 'product'),
    [allItems],
  );

  const catalogItems = useSukiBusinessStore(selectCatalogItems);
  const isCatalogLoading = useSukiBusinessStore(selectCatalogLoading);
  // Extract actions as individual stable selectors — avoids the proxy-object
  // anti-pattern where a destructured object literal defeats useCallback deps.
  const loadCatalog = useSukiBusinessStore((s) => s.loadCatalog);
  const toggleCatalogItem = useSukiBusinessStore((s) => s.toggleCatalogItem);
  const addProductToCatalog = useSukiBusinessStore((s) => s.addProductToCatalog);

  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.id) void loadCatalog(user.id);
  // loadCatalog is a stable Zustand action reference — including it satisfies
  // exhaustive-deps without causing spurious re-runs.
  }, [user?.id, loadCatalog]);

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
      // Push the product's current on-hand stock so customers see it and can't
      // order beyond it. `quantity` is the owner's authoritative local stock.
      const stock = Math.max(0, Math.floor(Number(product.quantity ?? 0)));
      try {
        if (existing) {
          await toggleCatalogItem(product.id, val, user.id, stock);
        } else if (val) {
          // product.imageUri is a LOCAL file:// URI — not a public URL.
          // Pass undefined so customers aren't shown a broken image.
          await addProductToCatalog(
            product.id,
            product.name,
            product.sku,
            undefined,
            user.id,
            product.price,
            stock,
          );
        }
        // val === false && !existing → nothing to do; Switch is already off.
      } catch (err) {
        Alert.alert(
          'Catalog Update Failed',
          err instanceof Error ? err.message : 'Could not update the catalog. Please try again.',
        );
      }
    },
    [user?.id, catalogMap, toggleCatalogItem, addProductToCatalog],
  );

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const headerBg     = isDark ? '#151A27' : appTheme.colors.primary[500];
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const inputBg      = isDark ? '#1E2435' : '#FFFFFF';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string  = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const primaryColor = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const accentColor  = isDark ? '#3DD68C' : appTheme.colors.accent[500];
  const textPrimary: string  = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const hintTextColor: string = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary;
  const backTextColor = isDark ? 'rgba(255,255,255,0.80)' : '#FFFFFF';
  const toggleOnColor = isDark ? accentColor : appTheme.colors.accent[500];
  const toggleOffTrack = isDark ? '#374151' : '#E5E7EB';

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const catalogEntry = catalogMap.get(item.id);
    const isAvailable = catalogEntry?.isAvailable ?? false;
    return (
      <View style={[styles.productRow, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: textPrimary }]}>{item.name}</Text>
          <Text style={[styles.productPrice, { color: primaryColor }]}>
            ₱{Number(catalogEntry?.customPrice ?? item.price ?? 0).toFixed(2)}
          </Text>
          <Text style={[styles.productStock, { color: textSecondary }]}>Stock: {item.quantity} {item.unit}</Text>
          {!!item.sku && <Text style={[styles.productSku, { color: hintTextColor }]}>Barcode: {item.sku}</Text>}
        </View>
        <View style={styles.toggleCol}>
          <Switch
            value={isAvailable}
            onValueChange={(val) => handleToggle(item, val)}
            trackColor={{ false: toggleOffTrack, true: toggleOnColor }}
            thumbColor="#FFFFFF"
          />
          <Text style={[styles.toggleLabel, { color: isAvailable ? toggleOnColor : hintTextColor }]}>
            {isAvailable ? 'On' : 'Off'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <View style={[styles.headerRow, { backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: backTextColor }]}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Online Store Catalog</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder}
        />
      </View>

      <View style={styles.hint}>
        <Text style={[styles.hintText, { color: hintTextColor }]}>
          Toggle products ON to make them available for online ordering. Prices can differ from in-store.
        </Text>
      </View>

      {isCatalogLoading ? (
        <ActivityIndicator color={primaryColor} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
  },
  hint: { paddingHorizontal: 16, paddingVertical: 8 },
  hintText: { fontSize: 11, lineHeight: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600' },
  productPrice: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  productStock: { fontSize: 11, marginTop: 1 },
  productSku: { fontSize: 10, marginTop: 1 },
  toggleCol: { alignItems: 'center', gap: 2 },
  toggleLabel: { fontSize: 10, fontWeight: '600' },
});
