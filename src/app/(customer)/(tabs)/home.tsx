import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Package, Heart } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Chip } from '@/components/atoms/Chip';
import { SearchBar } from '@/components/molecules/SearchBar';
import { EmptyState } from '@/components/molecules/EmptyState';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSukiStore, selectCurrentCustomer } from '@/store';
import { useThemeMode, useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { verificationStatusColor } from '@/core/theme/statusColors';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { CustomerHeader } from '@/features/customer/components/CustomerHeader';
import { CartButton } from '@/features/customer/components/CartButton';
import { CartBar } from '@/features/customer/components/CartBar';
import { ProductCard } from '@/features/customer/components/ProductCard';
import { useCustomerCatalog } from '@/features/customer/hooks/useCustomerCatalog';
import { useFavorites } from '@/features/customer/hooks/useFavorites';
import { useAddToCartGuarded } from '@/features/customer/hooks/useAddToCartGuarded';
import { getPopularProductIds } from '@/features/customer/utils/popularity';
import { CUSTOMER_TAB_BAR_HEIGHT } from '@/features/customer/constants/tabBar';
import type { CustomerVerificationStatus } from '@/types';

const VERIFICATION_LABEL: Record<CustomerVerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Pending Review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

/**
 * Client-side filter strip. `OnlineCatalogItem` has NO category field, so we
 * expose genuine, data-backed views of the same catalog: everything, popular
 * (merchant displayOrder), the customer's favorites, and available-only.
 */
type CatalogFilter = 'all' | 'popular' | 'favorites' | 'available';
const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'popular', label: 'Popular' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'available', label: 'Available' },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const isDark = useThemeMode() === 'dark';
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const customer = useSukiStore(selectCurrentCustomer);
  const { isFavorite, toggle: toggleFavorite, favoriteIds } = useFavorites();
  const { handleAddToCart, Dialog } = useAddToCartGuarded();

  const [filter, setFilter] = useState<CatalogFilter>('all');

  const { items, filtered, search, setSearch, isLoading, error, reload, refreshing, onRefresh } =
    useCustomerCatalog();

  // "Popular" is derived from the merchant's displayOrder across the whole
  // catalog (search-independent), so the badge is stable while filtering.
  const popularIds = useMemo(() => getPopularProductIds(items), [items]);

  // Bottom padding so the last row clears the absolute glass tab bar + the
  // floating CartBar that sits above it.
  const bottomInset = CUSTOMER_TAB_BAR_HEIGHT + insets.bottom;
  const listBottomPad = bottomInset + 96; // extra room for the CartBar

  const visibleItems = useMemo(() => {
    switch (filter) {
      case 'available':
        return filtered.filter((i) => i.stockQuantity > 0);
      case 'favorites':
        return filtered.filter((i) => favoriteIds.has(i.productId));
      case 'popular':
        return [...filtered].sort((a, b) => a.displayOrder - b.displayOrder);
      case 'all':
      default:
        return filtered;
    }
  }, [filter, filtered, favoriteIds]);

  if (!customer) return null;

  const isUnverified = customer.verificationStatus === 'UNVERIFIED';
  const verColor = verificationStatusColor(customer.verificationStatus, isDark);

  // ── Dynamic tokens ──────────────────────────────────────────────────────────
  const rootBg = isDark ? theme.colors.background : '#F0F4F8';
  const verifyBannerBg = isDark ? 'rgba(245,166,35,0.10)' : '#FEF9C3';
  const verifyBannerText: string = isDark ? '#FCD34D' : '#78350F';
  const verifyBannerCta = theme.colors.primary[isDark ? 400 : 500];
  const primaryColor = theme.colors.primary[isDark ? 400 : 500];
  const amber = staticTheme.colors.highlight[400];

  const ListHeader = (
    <View>
      {/* Greeting row */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text variant="h4" weight="bold" style={{ color: theme.colors.text }}>
            Hello, {customer.fullName.split(' ')[0]}!
          </Text>
          <Text variant="body-sm" color="textSecondary">
            What would you like to order today?
          </Text>
        </View>
        <StatusBadge
          size="md"
          label={VERIFICATION_LABEL[customer.verificationStatus]}
          backgroundColor={verColor.bg}
          textColor={verColor.text}
        />
      </View>

      {/* Unverified banner */}
      {isUnverified && (
        <TouchableOpacity
          style={[styles.verifyBanner, { backgroundColor: verifyBannerBg, borderLeftColor: amber }]}
          onPress={() => router.push('/(customer)/profile')}
          activeOpacity={0.85}
        >
          <View style={[styles.verifyBannerDot, { backgroundColor: amber }]} />
          <Text variant="body-xs" style={[styles.verifyBannerText, { color: verifyBannerText }]}>
            Complete your profile to unlock{' '}
            <Text variant="body-xs" weight="bold" style={{ color: verifyBannerText }}>Pay Later</Text> orders.{' '}
            <Text variant="body-xs" weight="bold" style={{ color: verifyBannerCta }}>Verify Now →</Text>
          </Text>
        </TouchableOpacity>
      )}

      {/* Filter chip strip (data-backed, not fake categories) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipStrip}
        style={styles.chipStripWrap}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            variant="filled"
            color="primary"
            size="md"
          />
        ))}
      </ScrollView>

      <SectionHeader
        title={filter === 'all' ? 'All Items' : FILTERS.find((f) => f.key === filter)?.label ?? 'Items'}
        style={styles.sectionHeader}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top']}>
      <StatusBar style="light" />

      <CustomerHeader
        title={`Hi, ${customer.fullName.split(' ')[0]}`}
        subtitle="Order from your suki merchant"
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
          icon={<Package size={28} color={theme.colors.gray[400]} />}
          action={{ label: 'Try Again', onPress: () => { void reload(); }, variant: 'primary' }}
        />
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: listBottomPad }]}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />
          }
          renderItem={({ item }) => (
            <View style={styles.rowItem}>
              <ProductCard
                item={item}
                onAddToCart={handleAddToCart}
                variant="horizontal"
                isPopular={popularIds.has(item.productId)}
                isFavorite={isFavorite(item.productId)}
                onToggleFavorite={(it) => toggleFavorite(it.productId)}
              />
            </View>
          )}
          ListEmptyComponent={
            filter === 'favorites' ? (
              <EmptyState
                style={styles.emptyInList}
                title="No favorites yet"
                description="Tap the heart on any product to save it here."
                icon={<Heart size={28} color={theme.colors.gray[400]} />}
              />
            ) : (
              <EmptyState
                style={styles.emptyInList}
                title="No products available yet"
                description="Check back later — your merchant hasn't listed any items."
                icon={<Package size={28} color={theme.colors.gray[400]} />}
              />
            )
          }
        />
      )}

      <CartBar bottomOffset={bottomInset} />

      {Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  list: { padding: 12 },
  rowItem: { marginBottom: 12 },

  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  greetingText: { flex: 1, paddingRight: 12 },

  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
  },
  verifyBannerDot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  verifyBannerText: { flex: 1, lineHeight: 18 },

  chipStripWrap: { marginTop: 16, marginHorizontal: -12 },
  chipStrip: { paddingHorizontal: 12, gap: 8 },

  sectionHeader: { marginTop: 18, marginBottom: 6, paddingHorizontal: 4 },

  emptyInList: { marginTop: 40 },
});
