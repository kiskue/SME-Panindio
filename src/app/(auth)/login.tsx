import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore, selectAuthLoading, selectAuthError } from '@/store';
import { useSukiStore, selectSukiLoading, selectSukiError } from '@/store';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '@/core/theme';
import { LoginForm } from '@/components/organisms/LoginForm';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { useAppDialog } from '@/hooks/useAppDialog';
import type { LoginCredentials } from '@/types';

// ── Brand constants ─────────────────────────────────────────────────────────
const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

// ── Types ───────────────────────────────────────────────────────────────────
type LoginMode = 'customer' | 'business';

// ─────────────────────────────────────────────────────────────────────────────
// CustomerLoginContent — inline customer login UI
// ─────────────────────────────────────────────────────────────────────────────
function CustomerLoginContent() {
  const router = useRouter();
  const dialog = useAppDialog();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { authenticateCustomer } = useSukiStore();
  const isLoading = useSukiStore(selectSukiLoading);
  const error     = useSukiStore(selectSukiError);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      dialog.show({ variant: 'error', title: 'Missing fields', message: 'Please enter your username and password.' });
      return;
    }
    await authenticateCustomer(username.trim(), password);
    if (useSukiStore.getState().isCustomerLoggedIn) {
      router.replace('/(customer)/home');
    }
  };

  return (
    <View style={cust.wrapper}>
      <View style={cust.formContainer}>
        {!!error && (
          <View style={cust.errorBox}>
            <Animated.Text style={cust.errorText}>{error}</Animated.Text>
          </View>
        )}

        <Animated.Text style={cust.label}>Username</Animated.Text>
        <TextInput
          style={cust.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={theme.colors.placeholder}
        />

        <Animated.Text style={cust.label}>Password</Animated.Text>
        <View style={cust.passwordRow}>
          <TextInput
            style={cust.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            placeholderTextColor={theme.colors.placeholder}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={cust.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPassword
              ? <Eye size={18} color="#9CA3AF" />
              : <EyeOff size={18} color="#9CA3AF" />
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[cust.loginBtn, isLoading && cust.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Animated.Text style={cust.loginBtnText}>Log In</Animated.Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={cust.registerRow}
          onPress={() => router.push('/(auth)/customer-register')}
          activeOpacity={0.7}
        >
          <Animated.Text style={cust.registerText}>
            New customer?{' '}
            <Animated.Text style={cust.registerLink}>Register here</Animated.Text>
          </Animated.Text>
        </TouchableOpacity>
      </View>
      {dialog.Dialog}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LoginScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router    = useRouter();
  const { login } = useAuthStore();
  const isLoading = useAuthStore(selectAuthLoading);
  const error     = useAuthStore(selectAuthError);

  // ── Mode toggle state ────────────────────────────────────────────────────
  const [mode, setMode] = useState<LoginMode>('customer');

  // Animated underline/indicator position: 0 = customer, 1 = business
  const toggleAnim = useRef(new Animated.Value(0)).current;
  // Content fade on mode switch
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const switchMode = useCallback((next: LoginMode) => {
    if (next === mode) return;
    // Fade out → update state → fade in
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setMode(next);
      Animated.parallel([
        Animated.spring(toggleAnim, {
          toValue: next === 'customer' ? 0 : 1,
          useNativeDriver: false,
          tension: 70,
          friction: 10,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [mode, toggleAnim, contentOpacity]);

  const handleBusinessLogin = async (credentials: LoginCredentials) => {
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

  // Interpolated position of the sliding pill/indicator
  const indicatorLeft = toggleAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['2%', '50%'],
  });

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
          {/* ── Navy header ─────────────────────────────────────────── */}
          <View style={styles.header}>
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

            <Animated.Text style={styles.welcomeTitle}>Welcome back</Animated.Text>
            <Animated.Text style={styles.welcomeSub}>
              {mode === 'customer'
                ? 'Sign in to your Suki account'
                : 'Sign in to manage your business'}
            </Animated.Text>
          </View>

          {/* ── Mode toggle pill ─────────────────────────────────────── */}
          <View style={styles.toggleContainer}>
            {/* Sliding highlight pill */}
            <Animated.View
              style={[
                styles.togglePill,
                { left: indicatorLeft },
              ]}
            />

            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => switchMode('customer')}
              activeOpacity={0.8}
            >
              <Animated.Text
                style={[
                  styles.toggleText,
                  mode === 'customer' ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                Customer Login
              </Animated.Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => switchMode('business')}
              activeOpacity={0.8}
            >
              <Animated.Text
                style={[
                  styles.toggleText,
                  mode === 'business' ? styles.toggleTextActive : styles.toggleTextInactive,
                ]}
              >
                Business Login
              </Animated.Text>
            </TouchableOpacity>
          </View>

          {/* ── Form card ────────────────────────────────────────────── */}
          <View style={styles.card}>
            {/* Accent bar changes color per mode */}
            <View style={styles.cardAccentBar}>
              {mode === 'customer' ? (
                <>
                  <View style={[styles.accentSegment, { backgroundColor: GREEN, flex: 3 }]} />
                  <View style={[styles.accentSegment, { backgroundColor: AMBER, flex: 1 }]} />
                  <View style={[styles.accentSegment, { backgroundColor: NAVY,  flex: 2 }]} />
                </>
              ) : (
                <>
                  <View style={[styles.accentSegment, { backgroundColor: NAVY,  flex: 3 }]} />
                  <View style={[styles.accentSegment, { backgroundColor: AMBER, flex: 1 }]} />
                  <View style={[styles.accentSegment, { backgroundColor: GREEN, flex: 2 }]} />
                </>
              )}
            </View>

            <Animated.View style={[styles.cardBody, { opacity: contentOpacity }]}>
              {/* Card title */}
              <Animated.Text style={styles.cardTitle}>
                {mode === 'customer' ? 'Customer Login' : 'Business Login'}
              </Animated.Text>
              <Animated.Text style={styles.cardSub}>
                {mode === 'customer'
                  ? 'Enter your credentials to continue'
                  : 'Enter your business credentials to continue'}
              </Animated.Text>

              {/* ── Render the correct form ── */}
              {mode === 'customer' ? (
                <CustomerLoginContent />
              ) : (
                <>
                  <LoginForm
                    onSubmit={handleBusinessLogin}
                    isLoading={isLoading}
                    {...(error?.message ? { error: error.message } : {})}
                    onDemoPress={handleDemoLogin}
                  />

                  <View style={styles.demoHint}>
                    <View style={styles.demoIcon} />
                    <Animated.Text style={styles.demoText}>
                      Demo:{' '}
                      <Animated.Text style={styles.demoBold}>demo</Animated.Text>
                      {' / '}
                      <Animated.Text style={styles.demoBold}>demo1234</Animated.Text>
                    </Animated.Text>
                  </View>

                  <View style={styles.registerRow}>
                    <Animated.Text style={styles.registerText}>Don't have an account? </Animated.Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/register')}
                      activeOpacity={0.7}
                    >
                      <Animated.Text style={styles.registerLink}>Create one</Animated.Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </View>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Animated.Text style={styles.footerText}>
              SME Panindio — All-in-one business management
            </Animated.Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Animated.Text style={styles.footerLink}>Privacy Policy</Animated.Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {isLoading && mode === 'business' && (
        <LoadingSpinner fullScreen overlay text="Signing you in..." />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — main screen
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  keyboardView: { flex: 1 },
  scroll:       { flexGrow: 1, paddingBottom: 8 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: NAVY,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 36,
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
  stripe: { flex: 1 },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: 140,
    height: 90,
  },
  welcomeTitle: {
    marginTop: 14,
    fontSize: 24,
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

  // ── Mode toggle ────────────────────────────────────────────────────────────
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -20, // overlap header bottom by 20pt for floating effect
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    position: 'relative',
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '48%',
    backgroundColor: NAVY,
    borderRadius: 10,
    zIndex: 0,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    zIndex: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  toggleTextActive:   { color: '#FFFFFF' },
  toggleTextInactive: { color: theme.colors.textSecondary },

  // ── Form card ──────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAccentBar: {
    flexDirection: 'row',
    height: 4,
  },
  accentSegment: { height: 4 },
  cardBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },

  // ── Business login extras ──────────────────────────────────────────────────
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

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles — CustomerLoginContent
// ─────────────────────────────────────────────────────────────────────────────
const cust = StyleSheet.create({
  wrapper: { width: '100%' },

  // Password form
  formContainer: { gap: 4 },
  label:  { fontSize: 12, fontWeight: '600', color: NAVY, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    backgroundColor: '#FAFBFD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
  },
  loginBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorBox:  { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 4 },
  errorText: { fontSize: 12, color: '#B91C1C' },

  // Register link
  registerRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  registerText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
  registerLink: { color: GREEN, fontWeight: '700' },

  // Business search picker
  searchPickerWrap:        { marginBottom: 4, position: 'relative', zIndex: 10 },
  searchPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    backgroundColor: '#FAFBFD',
    borderRadius: 10,
    paddingRight: 8,
  },
  searchPickerRowSelected: { borderColor: NAVY, backgroundColor: '#EAF0FA' },
  searchIconWrap: { paddingLeft: 10, paddingRight: 4 },
  searchPickerInput: {
    flex: 1,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DDE3EE',
    backgroundColor: '#FAFBFD',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 11 },
  searchIndicator: { marginHorizontal: 6 },
  clearBtn: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  clearBtnText:    { fontSize: 18, lineHeight: 22, fontWeight: '600', color: '#4B5563' },
  resultsDropdown: {
    position: 'absolute',
    top: '100%', left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE3EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 20,
  },
  resultRow:    { paddingHorizontal: 14, paddingVertical: 12 },
  resultName:   { fontSize: 13, fontWeight: '500', color: theme.colors.text },
  resultSep:    { height: 1, marginHorizontal: 14, backgroundColor: '#F3F4F6' },
  noResultsRow: { paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center' },
  noResultsText: { fontSize: 12, color: theme.colors.textSecondary },
});
