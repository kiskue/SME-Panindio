import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAppDialog } from '@/hooks';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuthStore, selectCurrentUser, useSukiBusinessStore } from '@/store';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import type { BusinessRegisterCustomerInput } from '@/types';

const AMBER = '#F5A623';
const GREEN  = '#27AE60';

const PHONE_PH = /^\+?63\d{10}$|^09\d{9}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

interface FormState {
  fullName: string;
  phoneNumber: string;
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
}

interface FormErrors {
  fullName?: string;
  phoneNumber?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.fullName.trim() || form.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  }
  if (!form.phoneNumber.trim() || !PHONE_PH.test(form.phoneNumber.trim())) {
    errors.phoneNumber = 'Enter a valid Philippine phone number (e.g. 09xxxxxxxxx)';
  }
  if (!form.username.trim() || form.username.trim().length < 4) {
    errors.username = 'Username must be at least 4 characters';
  } else if (!USERNAME_RE.test(form.username.trim())) {
    errors.username = 'Username may only contain letters, numbers, and underscores';
  }
  if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string | undefined;
  value: string;
  onChangeText: (v: string) => void;
  error?: string | undefined;
  placeholder?: string | undefined;
  secureTextEntry?: boolean | undefined;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | undefined;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | undefined;
  isDark: boolean;
  primaryColor: string;
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  error,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'words',
  isDark,
  primaryColor,
}: FieldProps) {
  const inputBg      = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string   = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const hintColor: string   = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary;
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;

  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, { color: primaryColor }]}>{label}</Text>
      {!!hint && <Text style={[fieldStyles.hint, { color: hintColor }]}>{hint}</Text>}
      <TextInput
        style={[
          fieldStyles.input,
          { backgroundColor: inputBg, borderColor: error ? '#EF4444' : inputBorder, color: inputText },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={placeholderColor}
      />
      {!!error && <Text style={fieldStyles.error}>{error}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 11, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  error: { fontSize: 11, color: '#EF4444', marginTop: 3 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RegisterCustomerScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const user = useAuthStore(selectCurrentUser);
  const { registerCustomerByBusiness } = useSukiBusinessStore();

  const [form, setForm] = useState<FormState>({
    fullName: '',
    phoneNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const setField = (key: keyof FormState) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const businessId = user?.id;
    if (!businessId) {
      dialog.show({ variant: 'error', title: 'Error', message: 'You must be logged in to register a customer.' });
      return;
    }

    setIsLoading(true);
    try {
      const input: BusinessRegisterCustomerInput = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        username: form.username.trim(),
        password: form.password,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
      };

      const result = await registerCustomerByBusiness(input, businessId);

      if (!result) {
        const storeError = useSukiBusinessStore.getState().error;
        dialog.show({ variant: 'error', title: 'Registration Failed', message: storeError ?? 'Something went wrong. Please try again.' });
        return;
      }

      dialog.show({
        variant: 'success',
        title: 'Customer Registered',
        message: `${form.fullName.trim()} can now log in with their username and password.`,
        confirmText: 'OK',
        onConfirm: () => router.back(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      dialog.show({ variant: 'error', title: 'Registration Failed', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const rootBg      = isDark ? '#0F1117' : '#F0F4F8';
  const headerBg    = isDark ? '#151A27' : appTheme.colors.primary[500];
  const cardBg      = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder  = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const primaryColor = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const submitBg    = isDark ? '#2D4A7A' : appTheme.colors.primary[500];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: rootBg }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 12 }]}>
            <View style={styles.brandStripe}>
              <View style={[styles.stripe, { backgroundColor: primaryColor }]} />
              <View style={[styles.stripe, { backgroundColor: AMBER }]} />
              <View style={[styles.stripe, { backgroundColor: GREEN }]} />
            </View>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Register Customer</Text>
            <Text style={styles.headerSub}>Add a new loyal customer to your Suki program</Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: primaryColor }]}>
            <View style={styles.cardAccent}>
              <View style={[styles.accentSeg, { backgroundColor: primaryColor, flex: 3 }]} />
              <View style={[styles.accentSeg, { backgroundColor: AMBER, flex: 1 }]} />
              <View style={[styles.accentSeg, { backgroundColor: GREEN, flex: 2 }]} />
            </View>
            <View style={styles.cardBody}>
              <Field label="Full Name *" value={form.fullName} onChangeText={setField('fullName')} error={errors.fullName} placeholder="Juan Dela Cruz" isDark={isDark} primaryColor={primaryColor} />
              <Field label="Phone Number *" value={form.phoneNumber} onChangeText={setField('phoneNumber')} error={errors.phoneNumber} keyboardType="phone-pad" autoCapitalize="none" placeholder="09xxxxxxxxx" isDark={isDark} primaryColor={primaryColor} />
              <Field label="Email (optional)" value={form.email} onChangeText={setField('email')} keyboardType="email-address" autoCapitalize="none" placeholder="juan@email.com" isDark={isDark} primaryColor={primaryColor} />
              <Field label="Username *" value={form.username} onChangeText={setField('username')} error={errors.username} autoCapitalize="none" placeholder="juandelacruz" isDark={isDark} primaryColor={primaryColor} />
              <Field label="Password *" value={form.password} onChangeText={setField('password')} error={errors.password} secureTextEntry placeholder="Min. 8 characters" isDark={isDark} primaryColor={primaryColor} />
              <Field label="Confirm Password *" value={form.confirmPassword} onChangeText={setField('confirmPassword')} error={errors.confirmPassword} secureTextEntry placeholder="Repeat password" isDark={isDark} primaryColor={primaryColor} />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitBg }, isLoading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Register Customer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {dialog.Dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  brandStripe: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    flexDirection: 'row',
  },
  stripe: { flex: 1 },
  backBtn: { marginBottom: 16 },
  backText: { color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
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
  cardBody: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },

  submitBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
