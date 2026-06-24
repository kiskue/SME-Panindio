import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

export default function OrderConfirmScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const params = useLocalSearchParams<{ orderNumber?: string; total?: string }>();

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const primaryColor = isDark ? '#4F9EFF' : NAVY;
  const textPrimary: string    = isDark ? '#F1F5F9' : '#111111';
  const textSecondary: string  = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const shopBtnBorder = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const shopBtnText   = isDark ? '#4F9EFF' : NAVY;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={styles.brandStripe}>
          <View style={[styles.stripe, { backgroundColor: NAVY }]} />
          <View style={[styles.stripe, { backgroundColor: AMBER }]} />
          <View style={[styles.stripe, { backgroundColor: GREEN }]} />
        </View>
      </View>
      <View style={styles.content}>
        <View style={[styles.checkCircle, { backgroundColor: GREEN }]}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
        <Text style={[styles.title, { color: textPrimary }]}>Order Placed!</Text>
        {params.orderNumber && (
          <Text style={[styles.orderNum, { color: textSecondary }]}>Order #{params.orderNumber}</Text>
        )}
        {params.total && (
          <Text style={[styles.totalText, { color: primaryColor }]}>Total: ₱{Number(params.total).toFixed(2)}</Text>
        )}
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          Your order has been sent to the merchant. They will confirm it shortly.
        </Text>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.ordersBtn, { backgroundColor: NAVY }]}
            onPress={() => router.replace('/(customer)/orders')}
            activeOpacity={0.85}
          >
            <Text style={styles.ordersBtnText}>View My Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shopBtn, { borderColor: shopBtnBorder }]}
            onPress={() => router.replace('/(customer)/products')}
            activeOpacity={0.85}
          >
            <Text style={[styles.shopBtnText, { color: shopBtnText }]}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { backgroundColor: NAVY, height: 8 },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  checkIcon: { fontSize: 36, color: '#FFFFFF', fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  orderNum: { fontSize: 14, marginBottom: 4 },
  totalText: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  btnRow: { width: '100%', gap: 12 },
  ordersBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ordersBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  shopBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shopBtnText: { fontWeight: '700', fontSize: 15 },
});
