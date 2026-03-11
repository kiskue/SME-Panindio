import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore, selectAuthLoading, selectAuthError } from '@/store';
import { theme } from '@/core/theme';
import { LoginForm } from '@/components/organisms/LoginForm';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { LoginCredentials } from '@/types';

const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

export default function LoginScreen() {
  const router     = useRouter();
  const { login }  = useAuthStore();
  const isLoading  = useAuthStore(selectAuthLoading);
  const error      = useAuthStore(selectAuthError);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      await login(credentials);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleDemoLogin = async () => {
    try {
      await login({ username: 'demo', password: 'demo1234' });
    } catch (err) {
      console.error('Demo login failed:', err);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── Navy header ───────────────────────────────────────────── */}
          <View style={styles.header}>
            {/* Decorative blobs */}
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            {/* Brand stripe */}
            <View style={styles.brandStripe}>
              <View style={[styles.stripe, { backgroundColor: NAVY }]} />
              <View style={[styles.stripe, { backgroundColor: AMBER }]} />
              <View style={[styles.stripe, { backgroundColor: GREEN }]} />
            </View>

            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSub}>Sign in to manage your business</Text>
          </View>

          {/* ── Form card ─────────────────────────────────────────────── */}
          <View style={styles.card}>
            {/* Card top accent bar */}
            <View style={styles.cardAccentBar}>
              <View style={[styles.accentSegment, { backgroundColor: NAVY, flex: 3 }]} />
              <View style={[styles.accentSegment, { backgroundColor: AMBER, flex: 1 }]} />
              <View style={[styles.accentSegment, { backgroundColor: GREEN, flex: 2 }]} />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Sign in</Text>
              <Text style={styles.cardSub}>Enter your credentials to continue</Text>

              <LoginForm
                onSubmit={handleLogin}
                isLoading={isLoading}
                {...(error?.message ? { error: error.message } : {})}
                onDemoPress={handleDemoLogin}
              />

              {/* Demo hint */}
              <View style={styles.demoHint}>
                <View style={styles.demoIcon} />
                <Text style={styles.demoText}>
                  Demo:{' '}
                  <Text style={styles.demoBold}>demo</Text>
                  {' / '}
                  <Text style={styles.demoBold}>demo1234</Text>
                </Text>
              </View>

              {/* Register link */}
              <View style={styles.registerRow}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerLink}>Create one</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Footer ────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              SME Panindio — All-in-one business management
            </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isLoading && (
        <LoadingSpinner fullScreen overlay text="Signing you in..." />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: NAVY,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245,166,35,0.12)',
    top: -60,
    right: -50,
  },
  blob2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: -40,
  },
  brandStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    flexDirection: 'row',
  },
  stripe: {
    flex: 1,
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: 150,
    height: 100,
  },
  welcomeTitle: {
    marginTop: 16,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  welcomeSub: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '400',
  },

  // ── Card ────────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  cardAccentBar: {
    flexDirection: 'row',
    height: 4,
  },
  accentSegment: {
    height: 4,
  },
  cardBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },

  // ── Demo hint ───────────────────────────────────────────────────────────
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  demoIcon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AMBER,
  },
  demoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    flex: 1,
    flexWrap: 'wrap',
  },
  demoBold: {
    fontWeight: '600',
    color: NAVY,
  },

  // ── Register row ────────────────────────────────────────────────────────
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  registerText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    color: NAVY,
    fontWeight: '700',
  },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 11,
    color: NAVY,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
