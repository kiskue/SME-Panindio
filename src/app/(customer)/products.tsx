import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Package } from 'lucide-react-native';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import { CartButton } from '@/features/customer/components/CartButton';
import { ProductCard } from '@/features/customer/components/ProductCard';
import { useCustomerCatalog } from '@/features/customer/hooks/useCustomerCatalog';
import { useFavorites } from '@/features/customer/hooks/useFavorites';
import { useAddToCartGuarded } from '@/features/customer/hooks/useAddToCartGuarded';
import { getPopularProductIds } from '@/features/customer/utils/popularity';

export default function CustomerProductsScreen() {
  const router = useRouter();
  const isDark = useThemeMode() === 'dark';

  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const { handleAddToCart, Dialog } = useAddToCartGuarded();

  const { items, filtered, search, setSearch, isLoading, error, reload, refreshing, onRefresh } =
    useCustomerCatalog();

  const popularIds = useMemo(() => getPopularProductIds(items), [items]);

  const rootBg = isDark ? '#0F1117' : '#F0F4F8';
  const primaryColor = isDark ? '#4F9EFF' : staticTheme.colors.primary[500];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <CustomerHeader
        title="Browse Products"
        onBack={() => router.back()}
        rightAction={<CartButton />}
      >
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search products…"
          variant="filled"
        />
      </CustomerHeader>

      {isLoading ? (
        <View style={styles.center}>
          <LoadingSpinner color={primaryColor} />
        </View>
      ) : error != null ? (
        <EmptyState
          style={styles.fill}
          title="Unable to load products"
          description={error}
          icon={<Package size={28} color={staticTheme.colors.gray[400]} />}
          action={{ label: 'Try Again', onPress: () => { void reload(); }, variant: 'primary' }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
          renderItem={({ item }) => (
            <ProductCard
              item={item}
              onAddToCart={handleAddToCart}
              isPopular={popularIds.has(item.productId)}
              isFavorite={isFavorite(item.productId)}
              onToggleFavorite={(it) => toggleFavorite(it.productId)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              style={styles.emptyInList}
              title="No products available yet"
              description="Check back later — your merchant hasn't listed any items."
              icon={<Package size={28} color={staticTheme.colors.gray[400]} />}
            />
          }
        />
      )}

      {Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  emptyInList: { marginTop: 60 },
});
