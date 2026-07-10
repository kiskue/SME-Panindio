import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import { authColors } from '@/core/theme/authColors';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CustomerQrResultScreen() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('pending_qr_token').then((t) => setToken(t ?? null));
    SecureStore.getItemAsync('pending_qr_expires').then((e) => {
      setExpiresAt(e ?? null);
      if (e) {
        const diff = Math.floor((new Date(e).getTime() - Date.now()) / 1000);
        setSecondsLeft(Math.max(0, diff));
      }
    });
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (expiresAt) setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setIsExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, expiresAt]);

  const handleBackToLogin = async () => {
    await SecureStore.deleteItemAsync('pending_qr_token').catch(() => null);
    await SecureStore.deleteItemAsync('pending_qr_expires').catch(() => null);
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Header — always brand navy */}
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: authColors.NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: authColors.AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: authColors.GREEN }]} />
          </View>
          <Text style={styles.headerTitle}>Your QR Code</Text>
          <Text style={styles.headerSub}>Registration successful!</Text>
        </View>

        {/* QR Card */}
        <View style={styles.card}>
          <View style={styles.cardAccent}>
            <View style={[styles.accentSeg, { backgroundColor: authColors.NAVY, flex: 3 }]} />
            <View style={[styles.accentSeg, { backgroundColor: authColors.AMBER, flex: 1 }]} />
            <View style={[styles.accentSeg, { backgroundColor: authColors.GREEN, flex: 2 }]} />
          </View>
          <View style={styles.cardBody}>
            {isExpired ? (
              <View style={styles.expiredBox}>
                <Text style={styles.expiredTitle}>QR Code Expired</Text>
                <Text style={styles.expiredSub}>
                  Your QR code has expired. Please contact your business owner for a new one.
                </Text>
              </View>
            ) : (
              <>
                {token ? (
                  <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF' }]}>
                    <QRCode
                      value={token}
                      size={220}
                      color={authColors.NAVY}
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                ) : (
                  <View style={styles.qrWrapper}>
                    <Text style={styles.loadingText}>Loading QR code...</Text>
                  </View>
                )}

                {/* Countdown */}
                <View style={[
                  styles.timerRow,
                  secondsLeft < 120 && styles.timerRowUrgent,
                ]}>
                  <Text style={[
                    styles.timerLabel,
                    secondsLeft < 120 && styles.timerLabelUrgent,
                  ]}>
                    Expires in:
                  </Text>
                  <Text style={[
                    styles.timerValue,
                    secondsLeft < 120 && styles.timerValueUrgent,
                  ]}>
                    {formatCountdown(secondsLeft)}
                  </Text>
                </View>

                {/* Instructions */}
                <View style={styles.instructionBox}>
                  <View style={styles.instrDot} />
                  <Text style={styles.instrText}>
                    Show this QR code to scan on your first login. This QR can only be scanned{' '}
                    <Text style={styles.instrBold}>once</Text>.
                  </Text>
                </View>
                <View style={styles.instructionBox}>
                  <View style={styles.instrDot} />
                  <Text style={styles.instrText}>
                    After scanning, you can log in anytime with your username and password.
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleBackToLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>
                {isExpired ? 'Back to Login' : 'Scan Now → Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.CANVAS },
  scroll: { flexGrow: 1 },

  header: {
    backgroundColor: authColors.NAVY,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  headerSub: { marginTop: 4, fontSize: 13, color: authColors.HEADER_SUB },

  card: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: authColors.CARD_BORDER,
    backgroundColor: authColors.CARD,
    overflow: 'hidden',
    shadowColor: authColors.NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  cardAccent: { flexDirection: 'row', height: 4 },
  accentSeg: { height: 4 },
  cardBody: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28, alignItems: 'center' },

  qrWrapper: {
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 20,
  },
  loadingText: { fontSize: 13, color: authColors.TEXT_SECONDARY },

  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
  },
  timerRowUrgent: { backgroundColor: '#FEF9C3' },
  timerLabel: { fontSize: 12, fontWeight: '500', color: authColors.TEXT_SECONDARY },
  timerLabelUrgent: { color: '#92400E' },
  timerValue: { fontSize: 22, fontWeight: '800', color: authColors.NAVY },
  timerValueUrgent: { color: '#B45309' },

  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    marginBottom: 8,
  },
  instrDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: authColors.AMBER },
  instrText: { flex: 1, fontSize: 12, lineHeight: 18, color: authColors.TEXT_SECONDARY },
  instrBold: { fontWeight: '700', color: authColors.NAVY },

  expiredBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  expiredTitle: { fontSize: 18, fontWeight: '700', color: authColors.ERROR_TEXT },
  expiredSub: { fontSize: 13, textAlign: 'center', color: authColors.TEXT_SECONDARY },

  loginBtn: {
    marginTop: 16,
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: authColors.NAVY,
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
