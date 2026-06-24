import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useOnlineOrdersStore, selectCartItemCount, selectCustomerCart } from '@/store';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import * as SecureStore from 'expo-secure-store';
import { api, extractApiError } from '@/core/api';
import type { OnlineCatalogItem } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

export default function CustomerProductsScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const customer = useSukiStore(selectCurrentCustomer);
  const cartCount = useOnlineOrdersStore(selectCartItemCount);
  const cart = useOnlineOrdersStore(selectCustomerCart);
  // Subscribe to the action directly — avoids subscribing to the whole store
  // object reference which changes on every render and defeats useCallback.
  const addToCart = useOnlineOrdersStore((s) => s.addToCart);

  const [items, setItems] = useState<OnlineCatalogItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<OnlineCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // loadCatalog is stable across renders (customer.id is the only dep that
  // would legitimately change) so wrap in useCallback to avoid stale closures
  // inside the useEffect below.
  const loadCatalog = useCallback(async () => {
    if (!customer?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      // POST /catalog/for-customer — the backend validates the customer session
      // and returns only available, non-deleted items for the business. The
      // session token authorizes the customer (they are not JWT users).
      const sessionToken = await SecureStore.getItemAsync('suki_customer_session_token').catch(() => null);

      const { data: payload } = await api.post<{ items?: Record<string, unknown>[] }>(
        '/catalog/for-customer',
        {
          ...(customer.businessOwnerId ? { businessOwnerId: customer.businessOwnerId } : {}),
          customerId: customer.id,
          ...(sessionToken ? { sessionToken } : {}),
        },
      );

      const rows = payload.items ?? [];
      // Backend returns camelCase; tolerate snake_case too for safety.
      const mapped: OnlineCatalogItem[] = rows.map((r) => ({
        id: String(r['id'] ?? ''),
        businessOwnerId: String(r['businessOwnerId'] ?? r['business_owner_id'] ?? ''),
        productId: String(r['productId'] ?? r['product_id'] ?? ''),
        productName: String(r['productName'] ?? r['product_name'] ?? ''),
        ...((r['productBarcode'] ?? r['product_barcode']) != null
          ? { productBarcode: String(r['productBarcode'] ?? r['product_barcode']) } : {}),
        ...((r['productImageUrl'] ?? r['product_image_url']) != null
          ? { productImageUrl: String(r['productImageUrl'] ?? r['product_image_url']) } : {}),
        ...((r['customPrice'] ?? r['custom_price']) != null
          ? { customPrice: Number(r['customPrice'] ?? r['custom_price']) } : {}),
        isAvailable: Boolean(r['isAvailable'] ?? r['is_available']),
        stockQuantity: Number(r['stockQuantity'] ?? r['stock_quantity'] ?? 0),
        displayOrder: Number(r['displayOrder'] ?? r['display_order'] ?? 0),
        createdAt: String(r['createdAt'] ?? r['created_at'] ?? ''),
        updatedAt: String(r['updatedAt'] ?? r['updated_at'] ?? ''),
      }));
      setItems(mapped);
    } catch (err) {
      const { code, detail } = extractApiError(err);
      setLoadError(detail ?? (code === 'NETWORK_ERROR' ? 'Network error. Please try again.' : code));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id, customer?.businessOwnerId]);

  useEffect(() => {
    if (!customer) return;
    void loadCatalog();
  }, [customer, loadCatalog]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredItems(items);
    } else {
      const q = search.toLowerCase();
      setFilteredItems(items.filter((i) => i.productName.toLowerCase().includes(q)));
    }
  }, [search, items]);

  const handleAddToCart = (item: OnlineCatalogItem) => {
    if (item.stockQuantity <= 0) {
      dialog.show({ variant: 'error', title: 'Out of stock', message: 'This product is currently unavailable.' });
      return;
    }
    const inCart = cart.find((c) => c.catalogItem.id === item.id)?.quantity ?? 0;
    if (inCart >= item.stockQuantity) {
      dialog.show({
        variant: 'error',
        title: 'Stock limit reached',
        message: `Only ${item.stockQuantity} in stock. You already have ${inCart} in your cart.`,
      });
      return;
    }
    addToCart(item, 1);
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg      = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const primaryColor = isDark ? '#4F9EFF' : NAVY;
  const textPrimary: string   = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const placeholderBg   = isDark ? '#1E2435' : '#F0F4F8';
  const emptyTitleColor: string = isDark ? '#F1F5F9' : '#111111';
  const addBtnBg     = isDark ? '#2D4A7A' : NAVY;
  const cartBadgeBg  = AMBER;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {/* Header — brand-locked NAVY */}
      <View style={styles.header}>
        <View style={styles.brandStripe}>
          <View style={[styles.stripe, { backgroundColor: NAVY }]} />
          <View style={[styles.stripe, { backgroundColor: AMBER }]} />
          <View style={[styles.stripe, { backgroundColor: GREEN }]} />
        </View>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Browse Products</Text>
          <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/(customer)/cart')}>
            <Text style={styles.cartIcon}>🛒</Text>
            {cartCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: cartBadgeBg }]}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor="rgba(255,255,255,0.5)"
        />
      </View>

      {isLoading ? (
        <View style={{ marginTop: 40 }}>
          <LoadingSpinner color={primaryColor} />
        </View>
      ) : loadError != null ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>Unable to load products</Text>
          <Text style={[styles.emptySub, { color: textSecondary }]}>{loadError}</Text>
          <TouchableOpacity onPress={() => { void loadCatalog(); }} style={[styles.retryBtn, { borderColor: primaryColor }]}>
            <Text style={[styles.retryBtnText, { color: primaryColor }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: emptyTitleColor }]}>No products available</Text>
          <Text style={[styles.emptySub, { color: textSecondary }]}>Check back later or contact your merchant.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.productCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {item.productImageUrl ? (
                <Image source={{ uri: item.productImageUrl }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImagePlaceholder, { backgroundColor: placeholderBg }]}>
                  <Text style={styles.productImagePlaceholderText}>📦</Text>
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: textPrimary }]} numberOfLines={2}>{item.productName}</Text>
                <Text style={[styles.productPrice, { color: primaryColor }]}>
                  {item.customPrice != null ? `₱${item.customPrice.toFixed(2)}` : '—'}
                </Text>
                {item.stockQuantity > 0 ? (
                  <Text style={[styles.stockText, { color: item.stockQuantity <= 5 ? AMBER : textSecondary }]}>
                    {item.stockQuantity <= 5 ? `Only ${item.stockQuantity} left` : `${item.stockQuantity} in stock`}
                  </Text>
                ) : (
                  <Text style={[styles.stockText, { color: '#EF4444' }]}>Out of stock</Text>
                )}
                <TouchableOpacity
                  style={[
                    styles.addBtn,
                    { backgroundColor: addBtnBg },
                    item.stockQuantity <= 0 && styles.addBtnDisabled,
                  ]}
                  onPress={() => handleAddToCart(item)}
                  disabled={item.stockQuantity <= 0}
                  activeOpacity={0.85}
                >
                  <Text style={styles.addBtnText}>{item.stockQuantity <= 0 ? 'Unavailable' : 'Add to Cart'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
      {dialog.Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { marginRight: 12 },
  backText: { color: '#FFFFFF', fontSize: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  cartBtn: { position: 'relative', padding: 4 },
  cartIcon: { fontSize: 22 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: '#FFFFFF',
  },

  list: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },

  productCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: { width: '100%', height: 120, resizeMode: 'cover' },
  productImagePlaceholder: {
    width: '100%', height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  productImagePlaceholderText: { fontSize: 36 },
  productInfo: { padding: 10 },
  productName: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  stockText: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  addBtn: { borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { fontSize: 13, fontWeight: '700' },
});
