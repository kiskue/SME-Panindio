import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Chip } from '@/components/atoms/Chip';
import { SearchBar, StatusBadge, EmptyState, CardRowSkeleton } from '@/components/molecules';
import { Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore, selectCurrentUser } from '@/store';
import {
  useSukiBusinessStore,
  selectLoyalCustomers,
  selectSukiBusinessLoading,
  selectSukiBusinessError,
} from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { verificationStatusColor } from '@/core/theme/statusColors';
import { useRefreshControl } from '@/hooks';
import { formatDate } from '@/core/utils/date';
import type { CustomerSummary, CustomerVerificationStatus } from '@/types';

const TABS: { key: CustomerVerificationStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',        label: 'All' },
  { key: 'UNVERIFIED', label: 'Unverified' },
  { key: 'PENDING',    label: 'Pending' },
  { key: 'VERIFIED',   label: 'Verified' },
];

export default function SukiIndexScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  const user = useAuthStore(selectCurrentUser);
  const customers = useSukiBusinessStore(selectLoyalCustomers);
  const isLoading = useSukiBusinessStore(selectSukiBusinessLoading);
  const error = useSukiBusinessStore(selectSukiBusinessError);
  const { loadLoyalCustomers } = useSukiBusinessStore();

  const [activeTab, setActiveTab] = useState<CustomerVerificationStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.id) void loadLoyalCustomers(user.id);
  }, [user?.id, loadLoyalCustomers]);

  const { refreshing, onRefresh } = useRefreshControl(async () => {
    if (user?.id) await loadLoyalCustomers(user.id);
  });

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        if (activeTab !== 'ALL' && c.verificationStatus !== activeTab) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return c.fullName.toLowerCase().includes(q) || c.phoneNumber.includes(q);
        }
        return true;
      }),
    [customers, activeTab, search],
  );

  const renderItem = ({ item }: { item: CustomerSummary }) => {
    const sc = verificationStatusColor(item.verificationStatus, isDark);
    return (
      <Card
        variant="elevated"
        padding="md"
        borderRadius="lg"
        style={styles.card}
        onPress={() => router.push({ pathname: '/(app)/(tabs)/suki/[id]', params: { id: item.id } })}
      >
        <View style={styles.row}>
          <Avatar initials={item.fullName.charAt(0).toUpperCase()} size="md" />
          <View style={styles.info}>
            <Text variant="body" weight="semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
              {item.fullName}
            </Text>
            <Text variant="body-sm" style={{ color: theme.colors.textSecondary }}>{item.phoneNumber}</Text>
            <Text variant="body-xs" style={{ color: theme.colors.textSecondary, opacity: 0.8 }}>
              Joined {formatDate(item.createdAt)}
            </Text>
          </View>
          <View style={styles.right}>
            <StatusBadge size="sm" label={item.verificationStatus} backgroundColor={sc.bg} textColor={sc.text} />
            {item.payLaterEnabled && <Badge label="Pay Later" variant="secondary" size="sm" />}
          </View>
        </View>
      </Card>
    );
  };

  const listBody = () => {
    if (isLoading && customers.length === 0) {
      return <CardRowSkeleton count={6} />;
    }
    if (error && customers.length === 0) {
      return (
        <EmptyState
          size="md"
          title="Couldn't load customers"
          description="Please check your connection and try again."
          icon={<Users size={28} color={theme.colors.textSecondary} />}
          action={{ label: 'Retry', onPress: () => user?.id && void loadLoyalCustomers(user.id) }}
        />
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          size="md"
          title={search.trim() || activeTab !== 'ALL' ? 'No matching customers' : 'No customers yet'}
          description={
            search.trim() || activeTab !== 'ALL'
              ? 'Try adjusting your search or filter.'
              : 'Customers can register themselves using the Customer Portal on the login screen.'
          }
          icon={<Users size={28} color={theme.colors.textSecondary} />}
        />
      );
    }
    return (
      <FlatList
        data={filtered}
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
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search customers…" />
      </View>

      <View style={styles.navRow}>
        <Button title="Orders" onPress={() => router.push('/(app)/(tabs)/suki/orders')} style={styles.navBtn} />
        <Button title="Catalog" tone="success" onPress={() => router.push('/(app)/(tabs)/suki/catalog')} style={styles.navBtn} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Chip
            key={tab.key}
            label={tab.label}
            selected={activeTab === tab.key}
            onPress={() => setActiveTab(tab.key)}
            size="sm"
          />
        ))}
      </View>

      {listBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  navRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  navBtn: { flex: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  list: { padding: 16, paddingBottom: 32 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
});
