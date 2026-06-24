import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Search, Eye, EyeOff, Check, Store, User, Phone, Mail, AtSign } from 'lucide-react-native';
import { ReviewDetailsModal } from '@/components/organisms';
import type { ReviewDetailItem } from '@/components/organisms';
import { PhoneInput, isValidPhoneNumber, toE164 } from '@/components/molecules/PhoneInput';
import type { Country } from '@/components/molecules/PhoneInput';
import { DEFAULT_COUNTRY } from '@/components/molecules/PhoneInput/countries';
import { Text } from '@/components/atoms/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { api, extractApiError } from '@/lib/api';
import {
  useBusinessSearchStore,
  selectBusinessSearchResults,
  selectBusinessSearching,
  selectBusinessSearchError,
  selectBusinessInitialResults,
  selectBusinessLoadingInitial,
} from '@/store';
import type { BusinessSearchResult } from '@/types';

const AMBER = '#F5A623';
const GREEN  = '#27AE60';

interface FormState {
  fullName: string;
  phoneNumber: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  business?: string;
  fullName?: string;
  phoneNumber?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

function validate(
  form: FormState,
  selectedBusiness: BusinessSearchResult | null,
  phoneCountry: Country,
): FormErrors {
  const errors: FormErrors = {};
  if (selectedBusiness === null) errors.business = 'Please search for and select a business';
  if (!form.fullName.trim() || form.fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters';
  if (!form.phoneNumber.trim() || !isValidPhoneNumber(form.phoneNumber.trim(), phoneCountry)) {
    errors.phoneNumber = `Enter a valid ${phoneCountry.name} phone number`;
  }
  if (!form.username.trim() || form.username.trim().length < 4) errors.username = 'Username must be at least 4 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(form.username.trim())) errors.username = 'Username may only contain letters, numbers, and underscores';
  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export default function CustomerRegisterScreen() {
  const router = useRouter();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const [form, setForm] = useState<FormState>({
    fullName: '',
    phoneNumber: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);

  // Review-before-create modal state
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewPhone, setReviewPhone] = useState('');

  // Business search state
  const [businessQuery, setBusinessQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSearchResult | null>(null);
  const [isPickerFocused, setIsPickerFocused] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { searchBusinesses, clearResults, loadInitialBusinesses } = useBusinessSearchStore();
  const businessResults  = useBusinessSearchStore(selectBusinessSearchResults);
  const isSearching      = useBusinessSearchStore(selectBusinessSearching);
  const businessSearchError = useBusinessSearchStore(selectBusinessSearchError);
  const initialBusinesses = useBusinessSearchStore(selectBusinessInitialResults);
  const isLoadingInitial  = useBusinessSearchStore(selectBusinessLoadingInitial);

  // Whether the typed query is long enough to switch from the default list to search.
  const isSearchMode = businessQuery.trim().length >= 2;

  // Preload a default page of stores so they appear the moment the picker opens.
  React.useEffect(() => {
    void loadInitialBusinesses();
  }, [loadInitialBusinesses]);

  // Debounced search trigger (only once the query is long enough).
  React.useEffect(() => {
    if (selectedBusiness !== null) return;
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    if (!isSearchMode) {
      clearResults();
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      void searchBusinesses(businessQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    };
  }, [businessQuery, isSearchMode, selectedBusiness, searchBusinesses, clearResults]);

  const handleSelectBusiness = (item: BusinessSearchResult) => {
    setSelectedBusiness(item);
    setBusinessQuery(item.businessName);
    setIsPickerFocused(false);
    clearResults();
    setErrors(({ business: _b, ...rest }) => rest);
  };

  const handleClearBusiness = () => {
    setSelectedBusiness(null);
    setBusinessQuery('');
    clearResults();
    setIsPickerFocused(true);
  };

  // The dropdown is open while the picker is focused and nothing is selected yet.
  const showResults = isPickerFocused && selectedBusiness === null;
  // Default list before the user types; live search results once they do.
  const dropdownItems = isSearchMode ? businessResults : initialBusinesses;
  const dropdownLoading = isSearchMode ? isSearching : isLoadingInitial;

  const setField = (key: keyof FormState) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const doRegister = async (e164Phone: string) => {
    setIsLoading(true);
    try {
      const payload = {
        businessId: selectedBusiness!.businessId,
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phoneNumber: e164Phone,
        ...(form.email.trim() !== '' ? { email: form.email.trim() } : {}),
      };

      // POST /customers/register — self-registration against the selected business.
      const { data } = await api.post<{ customerId?: string }>('/customers/register', payload);

      if (!data?.customerId) {
        Alert.alert('Registration Failed', 'Registration failed. Please try again.');
        return;
      }

      Alert.alert(
        'Account Created',
        'Your account has been created. You can now log in with your username and password.',
        [{ text: 'Log In', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: unknown) {
      const { code, detail } = extractApiError(err);
      const msgMap: Record<string, string> = {
        INVALID_BUSINESS: 'Business not found. Please search again and select a valid store.',
        USERNAME_TAKEN: 'This username is already taken. Please choose another.',
        REGISTRATION_FAILED: 'Registration failed. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection and try again.',
      };
      const base = msgMap[code] ?? `Something went wrong (${code}).`;
      Alert.alert('Registration Failed', detail ? `${base}\n\n${detail}` : base);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    const validationErrors = validate(form, selectedBusiness, phoneCountry);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    const e164Phone = toE164(form.phoneNumber.trim(), phoneCountry) ?? form.phoneNumber.trim();

    // Show an in-app preview of everything the user entered (except the
    // password) so they can review before the account is created.
    setReviewPhone(e164Phone);
    setReviewVisible(true);
  };

  const handleConfirmCreate = () => {
    setReviewVisible(false);
    void doRegister(reviewPhone);
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const NAVY = isDark ? '#4F9EFF' : '#1E4D8C';
  const HEADER_BG = '#1E4D8C';
  const rootBg    = isDark ? '#0F1117' : '#F0F4F8';
  const cardBg    = isDark ? '#1A2235' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'transparent';
  const loginTextColor: string = isDark ? 'rgba(255,255,255,0.55)' : staticTheme.colors.textSecondary;
  const loginLinkColor = NAVY;
  const loginRowBorder = isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  const inputBg      = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;
  const resultBg     = isDark ? '#1E2435' : '#FFFFFF';
  const resultBorder = isDark ? 'rgba(255,255,255,0.10)' : '#DDE3EE';
  const resultNameColor: string = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;

  // Derived password match state — computed every render, no extra state needed
  const confirmMatchState: 'idle' | 'match' | 'mismatch' =
    form.confirmPassword.length === 0 ? 'idle'
    : form.password === form.confirmPassword ? 'match'
    : 'mismatch';

  // Block submit when the user has typed a mismatching confirm password
  const submitDisabled = isLoading || confirmMatchState === 'mismatch';

  // Preview rows for the shared review modal (password intentionally excluded).
  const reviewItems: ReviewDetailItem[] = [
    { label: 'Store', value: selectedBusiness?.businessName ?? '—', icon: <Store size={16} color={NAVY} strokeWidth={2} /> },
    { label: 'Full Name', value: form.fullName.trim(), icon: <User size={16} color={NAVY} strokeWidth={2} /> },
    { label: 'Phone', value: reviewPhone, icon: <Phone size={16} color={NAVY} strokeWidth={2} /> },
    ...(form.email.trim() !== ''
      ? [{ label: 'Email', value: form.email.trim(), icon: <Mail size={16} color={NAVY} strokeWidth={2} /> }]
      : []),
    { label: 'Username', value: form.username.trim(), icon: <AtSign size={16} color={NAVY} strokeWidth={2} /> },
  ];

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
          <View style={[styles.header, { backgroundColor: HEADER_BG }]}>
            <View style={styles.brandStripe}>
              <View style={[styles.stripe, { backgroundColor: '#1E4D8C' }]} />
              <View style={[styles.stripe, { backgroundColor: AMBER }]} />
              <View style={[styles.stripe, { backgroundColor: GREEN }]} />
            </View>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backText}>← Back to Login</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Suki Account</Text>
            <Text style={styles.headerSub}>
              Register as a loyal customer. Search for the store you want to join.
            </Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: HEADER_BG }]}>
            <View style={styles.cardAccent}>
              <View style={[styles.accentSeg, { backgroundColor: '#1E4D8C', flex: 3 }]} />
              <View style={[styles.accentSeg, { backgroundColor: AMBER, flex: 1 }]} />
              <View style={[styles.accentSeg, { backgroundColor: GREEN, flex: 2 }]} />
            </View>
            <View style={styles.cardBody}>

              {/* Business search picker */}
              <View style={fieldStyles.wrap}>
                <Text style={[fieldStyles.label, { color: NAVY }]}>Select Store / Business *</Text>
                <Text style={[fieldStyles.hint, { color: isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary }]}>
                  Tap to see stores, or type to search
                </Text>
                <View style={styles.searchPickerWrap}>
                  <View style={[
                    styles.searchPickerRow,
                    { backgroundColor: inputBg, borderColor: errors.business ? '#EF4444' : (selectedBusiness !== null ? GREEN : inputBorder) },
                  ]}>
                    <View style={styles.searchIconWrap}>
                      <Search
                        size={16}
                        color={selectedBusiness !== null ? GREEN : '#9CA3AF'}
                        strokeWidth={2}
                      />
                    </View>
                    <TextInput
                      style={[styles.searchPickerInput, { color: inputText }]}
                      value={businessQuery}
                      onChangeText={(v) => {
                        setSelectedBusiness(null);
                        setBusinessQuery(v);
                      }}
                      onFocus={() => setIsPickerFocused(true)}
                      placeholder="Tap to choose, or type to search..."
                      autoCapitalize="none"
                      placeholderTextColor={placeholderColor}
                      editable={selectedBusiness === null}
                    />
                    {dropdownLoading && (
                      <ActivityIndicator size="small" color={NAVY} style={styles.searchIndicator} />
                    )}
                    {selectedBusiness !== null && (
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={handleClearBusiness}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.clearBtnText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {showResults && (
                    <View style={[styles.resultsDropdown, { backgroundColor: resultBg, borderColor: resultBorder }]}>
                      {dropdownItems.length > 0 ? (
                        <ScrollView
                          style={{ maxHeight: 220 }}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                        >
                          {!isSearchMode && (
                            <Text style={[styles.dropdownHeader, { color: placeholderColor, borderBottomColor: resultBorder }]}>
                              Stores you can join — type to search more
                            </Text>
                          )}
                          {dropdownItems.map((item, index) => (
                            <React.Fragment key={item.businessId}>
                              {index > 0 && <View style={[styles.resultSep, { backgroundColor: resultBorder }]} />}
                              <TouchableOpacity
                                style={styles.resultRow}
                                onPress={() => handleSelectBusiness(item)}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.resultName, { color: resultNameColor }]}>{item.businessName}</Text>
                              </TouchableOpacity>
                            </React.Fragment>
                          ))}
                        </ScrollView>
                      ) : dropdownLoading ? (
                        <View style={styles.noResultsRow}>
                          <ActivityIndicator size="small" color={NAVY} />
                        </View>
                      ) : (
                        <View style={styles.noResultsRow}>
                          <Text style={[styles.noResultsText, { color: businessSearchError !== null ? '#EF4444' : placeholderColor }]}>
                            {businessSearchError !== null
                              ? businessSearchError
                              : isSearchMode
                                ? 'No stores found'
                                : 'No stores available yet'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                {!!errors.business && <Text style={fieldStyles.error}>{errors.business}</Text>}
              </View>

              <Field label="Full Name *" value={form.fullName} onChangeText={setField('fullName')} error={errors.fullName} placeholder="Juan Dela Cruz" isDark={isDark} primaryColor={NAVY} />
              <PhoneInput
                label="Phone Number *"
                value={form.phoneNumber}
                onChangeText={setField('phoneNumber')}
                onChangeCountry={setPhoneCountry}
                isDark={isDark}
                primaryColor={NAVY}
                {...(errors.phoneNumber !== undefined ? { error: errors.phoneNumber } : {})}
              />
              <Field label="Email (optional)" value={form.email} onChangeText={setField('email')} keyboardType="email-address" autoCapitalize="none" placeholder="juan@email.com" isDark={isDark} primaryColor={NAVY} />
              <Field label="Username *" value={form.username} onChangeText={setField('username')} error={errors.username} autoCapitalize="none" placeholder="juandelacruz" isDark={isDark} primaryColor={NAVY} />
              <Field label="Password *" value={form.password} onChangeText={setField('password')} error={errors.password} secureTextEntry placeholder="Min. 8 characters" isDark={isDark} primaryColor={NAVY} />

              <Field
                label="Confirm Password *"
                value={form.confirmPassword}
                onChangeText={setField('confirmPassword')}
                error={
                  confirmMatchState === 'mismatch' ? 'Passwords do not match'
                  : confirmMatchState === 'match'   ? undefined
                  : errors.confirmPassword
                }
                success={confirmMatchState === 'match'}
                secureTextEntry
                placeholder="Repeat your password"
                isDark={isDark}
                primaryColor={NAVY}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: HEADER_BG }, submitDisabled && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitDisabled}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <View style={[styles.loginRow, { borderTopColor: loginRowBorder }]}>
                <Text style={[styles.loginText, { color: loginTextColor }]}>Already registered? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
                  <Text style={[styles.loginLink, { color: loginLinkColor }]}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Review-before-create preview — shared component (uniform with business registration) */}
      <ReviewDetailsModal
        visible={reviewVisible}
        loading={isLoading}
        title="Review your details"
        subtitle="Please confirm everything is correct before we create your Suki account."
        note="🔒 Your password is hidden for security and is not shown here."
        confirmLabel="Create Account"
        items={reviewItems}
        onConfirm={handleConfirmCreate}
        onEdit={() => setReviewVisible(false)}
      />
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  hint?: string | undefined;
  value: string;
  onChangeText: (v: string) => void;
  error?: string | undefined;
  success?: boolean | undefined;
  placeholder?: string | undefined;
  secureTextEntry?: boolean | undefined;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | undefined;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | undefined;
  isDark: boolean;
  primaryColor: string;
}

function Field({ label, hint, value, onChangeText, error, success, placeholder, secureTextEntry, keyboardType = 'default', autoCapitalize = 'words', isDark, primaryColor }: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputBg      = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder  = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string    = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const hintColor: string    = isDark ? 'rgba(255,255,255,0.40)' : staticTheme.colors.textSecondary;
  const placeholderColor     = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;
  const eyeColor: string     = isDark ? 'rgba(255,255,255,0.50)' : '#9CA3AF';

  const borderColor = error ? '#EF4444' : success ? '#27AE60' : inputBorder;

  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, { color: primaryColor }]}>{label}</Text>
      {!!hint && <Text style={[fieldStyles.hint, { color: hintColor }]}>{hint}</Text>}
      {secureTextEntry ? (
        <View style={[fieldStyles.inputRow, { backgroundColor: inputBg, borderColor }]}>
          <TextInput
            style={[fieldStyles.inputInner, { color: inputText }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            secureTextEntry={!showPassword}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            placeholderTextColor={placeholderColor}
          />
          {success && (
            <Check size={16} color="#27AE60" style={fieldStyles.matchIcon} />
          )}
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={fieldStyles.eyeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPassword
              ? <Eye size={18} color={eyeColor} />
              : <EyeOff size={18} color={eyeColor} />
            }
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[fieldStyles.input, { backgroundColor: inputBg, borderColor, color: inputText }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={false}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={placeholderColor}
        />
      )}
      {!!error && <Text style={fieldStyles.error}>{error}</Text>}
      {!error && success && (
        <Text style={fieldStyles.successText}>Passwords match</Text>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  hint: { fontSize: 11, marginBottom: 4 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10 },
  inputInner: { flex: 1, paddingLeft: 14, paddingRight: 4, paddingVertical: 11, fontSize: 14 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 11 },
  matchIcon: { marginRight: 4 },
  error: { fontSize: 11, color: '#EF4444', marginTop: 3 },
  successText: { fontSize: 11, color: '#27AE60', marginTop: 3, fontWeight: '500' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  brandStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, flexDirection: 'row' },
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

  // Business search picker
  searchPickerWrap: { position: 'relative', zIndex: 10 },
  searchPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchIconWrap: { paddingLeft: 12, paddingRight: 4 },
  searchPickerInput: { flex: 1, fontSize: 14, paddingVertical: 9, paddingLeft: 6, paddingRight: 14 },
  searchIndicator: { marginLeft: 8 },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  clearBtnText: { fontSize: 20, color: '#9CA3AF', lineHeight: 22 },
  resultsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  dropdownHeader: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resultRow: { paddingHorizontal: 14, paddingVertical: 12 },
  resultName: { fontSize: 14, fontWeight: '500' },
  resultSep: { height: 1 },
  noResultsRow: { paddingHorizontal: 14, paddingVertical: 14 },
  noResultsText: { fontSize: 13 },

  submitBtn: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  loginText: { fontSize: 13 },
  loginLink: { fontSize: 13, fontWeight: '700' },
});
