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
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CustomerQrResultScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

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

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg       = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg       = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder   = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const textSecondary: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const loadingText: string   = isDark ? 'rgba(255,255,255,0.45)' : staticTheme.colors.textSecondary;

  const timerBg        = isDark ? 'rgba(79,158,255,0.12)' : '#EFF6FF';
  const timerBgUrgent  = isDark ? 'rgba(251,191,36,0.12)' : '#FEF9C3';
  const timerLabelColor: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const timerValueColor = isDark ? '#4F9EFF' : NAVY;

  const instrTextColor: string  = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const instrBoldColor  = isDark ? '#4F9EFF' : NAVY;

  const expiredTitleColor = isDark ? '#FF6B6B' : '#B91C1C';
  const loginBtnBg    = NAVY;   // always brand navy for the CTA

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* Header — always brand navy */}
        <View style={styles.header}>
          <View style={styles.brandStripe}>
            <View style={[styles.stripe, { backgroundColor: NAVY }]} />
            <View style={[styles.stripe, { backgroundColor: AMBER }]} />
            <View style={[styles.stripe, { backgroundColor: GREEN }]} />
          </View>
          <Text style={styles.headerTitle}>Your QR Code</Text>
          <Text style={styles.headerSub}>Registration successful!</Text>
        </View>

        {/* QR Card */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: NAVY }]}>
          <View style={styles.cardAccent}>
            <View style={[styles.accentSeg, { backgroundColor: NAVY, flex: 3 }]} />
            <View style={[styles.accentSeg, { backgroundColor: AMBER, flex: 1 }]} />
            <View style={[styles.accentSeg, { backgroundColor: GREEN, flex: 2 }]} />
          </View>
          <View style={styles.cardBody}>
            {isExpired ? (
              <View style={styles.expiredBox}>
                <Text style={[styles.expiredTitle, { color: expiredTitleColor }]}>QR Code Expired</Text>
                <Text style={[styles.expiredSub, { color: textSecondary }]}>
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
                      color={NAVY}
                      backgroundColor="#FFFFFF"
                    />
                  </View>
                ) : (
                  <View style={styles.qrWrapper}>
                    <Text style={[styles.loadingText, { color: loadingText }]}>Loading QR code...</Text>
                  </View>
                )}

                {/* Countdown */}
                <View style={[
                  styles.timerRow,
                  { backgroundColor: timerBg },
                  secondsLeft < 120 && { backgroundColor: timerBgUrgent },
                ]}>
                  <Text style={[
                    styles.timerLabel,
                    { color: timerLabelColor },
                    secondsLeft < 120 && { color: '#92400E' },
                  ]}>
                    Expires in:
                  </Text>
                  <Text style={[
                    styles.timerValue,
                    { color: timerValueColor },
                    secondsLeft < 120 && { color: '#B45309' },
                  ]}>
                    {formatCountdown(secondsLeft)}
                  </Text>
                </View>

                {/* Instructions */}
                <View style={styles.instructionBox}>
                  <View style={[styles.instrDot, { backgroundColor: AMBER }]} />
                  <Text style={[styles.instrText, { color: instrTextColor }]}>
                    Show this QR code to scan on your first login. This QR can only be scanned{' '}
                    <Text style={{ fontWeight: '700', color: instrBoldColor }}>once</Text>.
                  </Text>
                </View>
                <View style={styles.instructionBox}>
                  <View style={[styles.instrDot, { backgroundColor: AMBER }]} />
                  <Text style={[styles.instrText, { color: instrTextColor }]}>
                    After scanning, you can log in anytime with your username and password.
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: loginBtnBg }]}
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
  root: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    backgroundColor: NAVY,
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
  stripe: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 8 },
  headerSub: { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.70)' },

  card: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
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
  loadingText: { fontSize: 13 },

  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  timerLabel: { fontSize: 12, fontWeight: '500' },
  timerValue: { fontSize: 22, fontWeight: '800' },

  instructionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    marginBottom: 8,
  },
  instrDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  instrText: { flex: 1, fontSize: 12, lineHeight: 18 },

  expiredBox: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  expiredTitle: { fontSize: 18, fontWeight: '700' },
  expiredSub: { fontSize: 13, textAlign: 'center' },

  loginBtn: {
    marginTop: 16,
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
