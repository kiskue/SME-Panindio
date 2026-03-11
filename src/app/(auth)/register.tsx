import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuthStore, selectAuthLoading, selectAuthError } from '@/store';
import { theme } from '@/core/theme';
import { FormField } from '@/components/molecules/FormField';
import { Button } from '@/components/atoms/Button/Button';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { RegisterCredentials, EnterpriseType, BusinessType, JobRole } from '@/types';
import { useRegistrationSetup } from '@/hooks/useRegistrationSetup';

// ─── Brand constants ──────────────────────────────────────────────────────────
const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

// ─── POS badge colours ────────────────────────────────────────────────────────
const POS_BADGE_BG   = '#D1FAE5';
const POS_BADGE_TEXT = '#065F46';

// ─── Yup schema ───────────────────────────────────────────────────────────────
const registerSchema = yup.object({
  firstName: yup
    .string()
    .min(2, 'First name must be at least 2 characters')
    .required('First name is required'),
  lastName: yup
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .required('Last name is required'),
  username: yup
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed')
    .required('Username is required'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  businessName: yup
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .required('Business name is required'),
  businessTypeId: yup
    .number()
    .min(1, 'Please select your business type')
    .required('Please select your business type'),
  jobRoleId: yup
    .number()
    .min(1, 'Please select your job role')
    .required('Please select your job role'),
  enterpriseType: yup
    .string()
    .oneOf(['small', 'medium'] as const, 'Please select enterprise type')
    .required('Please select enterprise type'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

interface RegisterFormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  businessName: string;
  businessTypeId: number;
  jobRoleId: number;
  enterpriseType: 'small' | 'medium';
  password: string;
  confirmPassword: string;
}

// ─── Business Type Picker Modal ───────────────────────────────────────────────

interface BusinessTypePickerProps {
  visible: boolean;
  selectedId: number;
  items: BusinessType[];
  onSelect: (id: number) => void;
  onClose: () => void;
}

const BusinessTypePickerModal: React.FC<BusinessTypePickerProps> = React.memo(
  ({ visible, selectedId, items, onSelect, onClose }) => {
    const [query, setQuery] = useState('');

    const filtered: BusinessType[] =
      query.trim() === ''
        ? items
        : items.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          );

    const handleSelect = useCallback(
      (id: number) => {
        onSelect(id);
        setQuery('');
        onClose();
      },
      [onSelect, onClose],
    );

    const handleClose = useCallback(() => {
      setQuery('');
      onClose();
    }, [onClose]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={pickerStyles.overlay}>
          <TouchableOpacity
            style={pickerStyles.backdrop}
            onPress={handleClose}
            activeOpacity={1}
          />
          <View style={pickerStyles.panel}>
            <View style={pickerStyles.panelHeader}>
              <Text style={pickerStyles.panelTitle}>Select Business Type</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={pickerStyles.closeBtn}
              >
                <Text style={pickerStyles.closeBtnText}>{'X'}</Text>
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.searchRow}>
              <TextInput
                style={pickerStyles.searchInput}
                placeholder="Search business type..."
                placeholderTextColor={theme.colors.placeholder}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <FlatList<BusinessType>
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      pickerStyles.itemRow,
                      isSelected && pickerStyles.itemRowSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        pickerStyles.itemText,
                        isSelected && pickerStyles.itemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.pos_enabled && (
                      <View style={pickerStyles.posBadge}>
                        <Text style={pickerStyles.posBadgeText}>POS</Text>
                      </View>
                    )}
                    {isSelected && (
                      <Text style={pickerStyles.checkmark}>{'V'}</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    );
  },
);

// ─── Job Role Picker Modal ────────────────────────────────────────────────────

interface JobRolePickerProps {
  visible: boolean;
  selectedId: number;
  items: JobRole[];
  onSelect: (id: number) => void;
  onClose: () => void;
}

const JobRolePickerModal: React.FC<JobRolePickerProps> = React.memo(
  ({ visible, selectedId, items, onSelect, onClose }) => {
    const [query, setQuery] = useState('');

    const filtered: JobRole[] =
      query.trim() === ''
        ? items
        : items.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          );

    const handleSelect = useCallback(
      (id: number) => {
        onSelect(id);
        setQuery('');
        onClose();
      },
      [onSelect, onClose],
    );

    const handleClose = useCallback(() => {
      setQuery('');
      onClose();
    }, [onClose]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={pickerStyles.overlay}>
          <TouchableOpacity
            style={pickerStyles.backdrop}
            onPress={handleClose}
            activeOpacity={1}
          />
          <View style={pickerStyles.panel}>
            <View style={pickerStyles.panelHeader}>
              <Text style={pickerStyles.panelTitle}>Select Your Role</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={pickerStyles.closeBtn}
              >
                <Text style={pickerStyles.closeBtnText}>{'X'}</Text>
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.searchRow}>
              <TextInput
                style={pickerStyles.searchInput}
                placeholder="Search role..."
                placeholderTextColor={theme.colors.placeholder}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <FlatList<JobRole>
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      pickerStyles.itemRow,
                      isSelected && pickerStyles.itemRowSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        pickerStyles.itemText,
                        isSelected && pickerStyles.itemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && (
                      <Text style={pickerStyles.checkmark}>{'V'}</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    );
  },
);

// ─── Picker trigger row ───────────────────────────────────────────────────────

interface PickerTriggerProps {
  label: string;
  displayValue: string;
  hasError: boolean;
  disabled: boolean;
  onPress: () => void;
}

const PickerTrigger: React.FC<PickerTriggerProps> = React.memo(
  ({ label, displayValue, hasError, disabled, onPress }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.pickerTouchable,
          hasError && styles.pickerTouchableError,
          disabled && styles.pickerTouchableDisabled,
        ]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Text
          style={[
            styles.pickerValue,
            displayValue === '' && styles.pickerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {displayValue !== '' ? displayValue : `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={styles.chevron}>{'v'}</Text>
      </TouchableOpacity>
    </View>
  ),
);

// ─── Inline loading placeholder shown inside the card ─────────────────────────

const PickerSkeleton: React.FC = () => (
  <View style={styles.skeletonContainer}>
    <ActivityIndicator size="small" color={NAVY} />
    <Text style={styles.skeletonText}>Loading options...</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();
  const isLoading  = useAuthStore(selectAuthLoading);
  const storeError = useAuthStore(selectAuthError);

  const {
    businessTypes,
    jobRoles,
    loading: setupLoading,
    error: setupError,
  } = useRegistrationSetup();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [businessTypePickerVisible, setBusinessTypePickerVisible] = useState(false);
  const [jobRolePickerVisible, setJobRolePickerVisible] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
  } = useForm<RegisterFormData>({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      firstName:      '',
      lastName:       '',
      username:       '',
      email:          '',
      businessName:   '',
      businessTypeId: 0,
      jobRoleId:      0,
      enterpriseType: 'small',
      password:       '',
      confirmPassword: '',
    },
  });

  // Derive display names from the lookup arrays without extra state.
  const watchedBusinessTypeId = watch('businessTypeId');
  const watchedJobRoleId      = watch('jobRoleId');

  const selectedBusinessTypeName =
    businessTypes.find((bt) => bt.id === watchedBusinessTypeId)?.name ?? '';
  const selectedJobRoleName =
    jobRoles.find((jr) => jr.id === watchedJobRoleId)?.name ?? '';

  const handleRegister = async (data: RegisterFormData) => {
    setSubmitError(null);
    try {
      const credentials: RegisterCredentials = {
        email:          data.email,
        password:       data.password,
        firstName:      data.firstName,
        lastName:       data.lastName,
        username:       data.username,
        businessName:   data.businessName,
        businessTypeId: data.businessTypeId,
        jobRoleId:      data.jobRoleId,
        enterpriseType: data.enterpriseType as EnterpriseType,
      };
      await register(credentials);

      const { isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        Alert.alert(
          'Check your email',
          'We sent a confirmation link to ' + data.email + '. Click it to activate your account.',
          [{ text: 'OK', onPress: () => router.push('/(auth)/login') }],
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setSubmitError(message);
    }
  };

  const displayError = submitError ?? storeError?.message ?? setupError ?? null;

  const pickersDisabled = setupLoading;

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
          {/* ── Navy header ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            <View style={styles.brandStripe}>
              <View style={[styles.stripe, { backgroundColor: NAVY }]} />
              <View style={[styles.stripe, { backgroundColor: AMBER }]} />
              <View style={[styles.stripe, { backgroundColor: GREEN }]} />
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.backArrow}>{'<-'}</Text>
              <Text style={styles.backLabel}>Sign in</Text>
            </TouchableOpacity>

            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.welcomeTitle}>Create Account</Text>
            <Text style={styles.welcomeSub}>Join SME Panindio today</Text>
          </View>

          {/* ── Form card ───────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardAccentBar}>
              <View style={[styles.accentSegment, { backgroundColor: GREEN, flex: 2 }]} />
              <View style={[styles.accentSegment, { backgroundColor: AMBER, flex: 1 }]} />
              <View style={[styles.accentSegment, { backgroundColor: NAVY, flex: 3 }]} />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Sign up</Text>
              <Text style={styles.cardSub}>Fill in your details to get started</Text>

              {displayError !== null && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{displayError}</Text>
                </View>
              )}

              {/* ── 1. Name row ──────────────────────────────────────────── */}
              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <FormField
                    control={control}
                    name="firstName"
                    label="First Name"
                    placeholder="e.g. Maria"
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.nameField}>
                  <FormField
                    control={control}
                    name="lastName"
                    label="Last Name"
                    placeholder="e.g. Santos"
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* ── 2. Username ──────────────────────────────────────────── */}
              <FormField
                control={control}
                name="username"
                label="Username"
                placeholder="@your_username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
              />

              {/* ── 3. Email ─────────────────────────────────────────────── */}
              <FormField
                control={control}
                name="email"
                label="Email Address"
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />

              {/* ── 4. Business Name ─────────────────────────────────────── */}
              <FormField
                control={control}
                name="businessName"
                label="Business Name"
                placeholder="e.g. Maria's Store"
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* ── 5 & 6. Picker fields — skeleton while loading ─────────── */}
              {setupLoading ? (
                <PickerSkeleton />
              ) : (
                <>
                  {/* ── 5. Business Type picker ──────────────────────────── */}
                  <Controller
                    control={control}
                    name="businessTypeId"
                    render={({ field: { value, onChange }, fieldState: { error } }) => (
                      <View style={styles.fieldGroup}>
                        <PickerTrigger
                          label="Business Type"
                          displayValue={selectedBusinessTypeName}
                          hasError={error !== undefined}
                          disabled={pickersDisabled}
                          onPress={() => setBusinessTypePickerVisible(true)}
                        />
                        {error?.message !== undefined && (
                          <Text style={styles.fieldError}>{error.message}</Text>
                        )}

                        <BusinessTypePickerModal
                          visible={businessTypePickerVisible}
                          selectedId={value}
                          items={businessTypes}
                          onSelect={onChange}
                          onClose={() => setBusinessTypePickerVisible(false)}
                        />
                      </View>
                    )}
                  />

                  {/* ── 6. Job Role picker ───────────────────────────────── */}
                  <Controller
                    control={control}
                    name="jobRoleId"
                    render={({ field: { value, onChange }, fieldState: { error } }) => (
                      <View style={styles.fieldGroup}>
                        <PickerTrigger
                          label="Your Role"
                          displayValue={selectedJobRoleName}
                          hasError={error !== undefined}
                          disabled={pickersDisabled}
                          onPress={() => setJobRolePickerVisible(true)}
                        />
                        {error?.message !== undefined && (
                          <Text style={styles.fieldError}>{error.message}</Text>
                        )}

                        <JobRolePickerModal
                          visible={jobRolePickerVisible}
                          selectedId={value}
                          items={jobRoles}
                          onSelect={onChange}
                          onClose={() => setJobRolePickerVisible(false)}
                        />
                      </View>
                    )}
                  />
                </>
              )}

              {/* ── 7. Enterprise Type pills ─────────────────────────────── */}
              <Controller
                control={control}
                name="enterpriseType"
                render={({ field: { value, onChange }, fieldState: { error } }) => (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Enterprise Type</Text>
                    <View style={styles.pillRow}>
                      <TouchableOpacity
                        style={[
                          styles.pill,
                          value === 'small' && styles.pillSelected,
                        ]}
                        onPress={() => onChange('small')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            value === 'small' && styles.pillTextSelected,
                          ]}
                        >
                          Small Enterprise
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pill,
                          value === 'medium' && styles.pillSelected,
                        ]}
                        onPress={() => onChange('medium')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            value === 'medium' && styles.pillTextSelected,
                          ]}
                        >
                          Medium Enterprise
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {error?.message !== undefined && (
                      <Text style={styles.fieldError}>{error.message}</Text>
                    )}
                  </View>
                )}
              />

              {/* ── 8. Password ──────────────────────────────────────────── */}
              <FormField
                control={control}
                name="password"
                label="Password"
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
              />

              {/* ── 9. Confirm Password ──────────────────────────────────── */}
              <FormField
                control={control}
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Repeat your password"
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
              />

              <Button
                title="Create Account"
                onPress={handleSubmit(handleRegister)}
                loading={isLoading}
                fullWidth
                style={styles.submitButton}
              />

              <View style={styles.signInRow}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.signInLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Footer ──────────────────────────────────────────────────── */}
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
        <LoadingSpinner fullScreen overlay text="Creating your account..." />
      )}
    </SafeAreaView>
  );
}

// ─── Picker modal styles ──────────────────────────────────────────────────────
const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  panelTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    color: NAVY,
    fontWeight: '700',
  },
  searchRow: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    fontSize: 14,
    color: '#1A3A6B',
    paddingVertical: 0,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 44,
  },
  itemRowSelected: {
    backgroundColor: '#EAF0FA',
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  itemTextSelected: {
    color: NAVY,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 14,
    color: NAVY,
    fontWeight: '700',
    marginLeft: 8,
  },
  posBadge: {
    backgroundColor: POS_BADGE_BG,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  posBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: POS_BADGE_TEXT,
    letterSpacing: 0.5,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
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

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: NAVY,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(39,174,96,0.10)',
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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 44,
  },
  backArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 24,
  },
  backLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
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

  // ── Card ──────────────────────────────────────────────────────────────────
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
    marginBottom: 20,
  },

  // ── Name row ──────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
  },

  // ── Error banner ──────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 18,
  },

  // ── Custom field wrapper ───────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: NAVY,
    marginBottom: 6,
  },
  fieldError: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 4,
  },

  // ── Picker touchable ──────────────────────────────────────────────────────
  pickerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  pickerTouchableError: {
    borderColor: '#EF4444',
  },
  pickerTouchableDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    color: '#1A3A6B',
  },
  pickerPlaceholder: {
    color: theme.colors.placeholder,
  },
  chevron: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },

  // ── Enterprise type pills ─────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: NAVY,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: NAVY,
    textAlign: 'center',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },

  // ── Skeleton loading ──────────────────────────────────────────────────────
  skeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  skeletonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitButton: {
    marginTop: 8,
  },

  // ── Sign-in link ──────────────────────────────────────────────────────────
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  signInText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  signInLink: {
    fontSize: 13,
    color: NAVY,
    fontWeight: '700',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
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
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
