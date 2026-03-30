import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
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
import { useAppTheme } from '@/core/theme';
import { FormField } from '@/components/molecules/FormField';
import { Button } from '@/components/atoms/Button/Button';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { RegisterCredentials, EnterpriseType, JobRole } from '@/types';
import { useRegistrationSetup, BusinessTypeWithMode, GroupedBusinessTypes } from '@/hooks/useRegistrationSetup';
import { useAppDialog } from '@/hooks';

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

// ─── Business Type Grouped Picker Sheet ───────────────────────────────────────
// Two-section bottom sheet: "I make my products" (production) vs "I resell products" (reseller).
// Replaces the flat searchable modal — no search needed given the short curated lists.

interface GroupedBusinessTypeSheetProps {
  visible:    boolean;
  selectedId: number;
  grouped:    GroupedBusinessTypes;
  onSelect:   (item: BusinessTypeWithMode) => void;
  onClose:    () => void;
}

// Icons as emoji strings — avoids adding a new lucide icon dependency just for the picker.
const PRODUCTION_ICON = '🍳';
const RESELLER_ICON   = '🛒';

const GroupedBusinessTypeSheet: React.FC<GroupedBusinessTypeSheetProps> = React.memo(
  ({ visible, selectedId, grouped, onSelect, onClose }) => {
    const theme = useAppTheme();

    const handleSelect = useCallback(
      (item: BusinessTypeWithMode) => {
        onSelect(item);
        onClose();
      },
      [onSelect, onClose],
    );

    const dynSheetStyles = useMemo(() => StyleSheet.create({
      panel: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 32,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 14,
      },
      handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: theme.colors.border,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 4,
      },
      panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderSubtle,
      },
      panelTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.text,
      },
      closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
      },
      closeBtnText: {
        fontSize: 12,
        color: theme.colors.text,
        fontWeight: '700',
      },
      sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        gap: 8,
      },
      sectionEmoji: {
        fontSize: 20,
      },
      sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        flex: 1,
      },
      sectionSubtitle: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        paddingHorizontal: 16,
        paddingBottom: 8,
      },
      divider: {
        height: 1,
        backgroundColor: theme.colors.borderSubtle,
        marginHorizontal: 16,
        marginVertical: 4,
      },
      groupDivider: {
        height: 6,
        backgroundColor: theme.colors.surfaceSubtle,
        marginVertical: 8,
      },
      itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 13,
        minHeight: 52,
        gap: 12,
      },
      itemRowSelected: {
        backgroundColor: theme.colors.primary[50],
      },
      itemContent: {
        flex: 1,
      },
      itemName: {
        fontSize: 15,
        color: theme.colors.text,
        fontWeight: '500',
      },
      itemNameSelected: {
        color: NAVY,
        fontWeight: '700',
      },
      itemDescription: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: 2,
      },
      checkmark: {
        fontSize: 14,
        color: NAVY,
        fontWeight: '700',
      },
    }), [theme]);

    const renderItem = useCallback((item: BusinessTypeWithMode) => {
      const isSelected = item.id === selectedId;
      return (
        <TouchableOpacity
          key={item.id}
          style={[
            dynSheetStyles.itemRow,
            isSelected && dynSheetStyles.itemRowSelected,
          ]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={dynSheetStyles.itemContent}>
            <Text style={[dynSheetStyles.itemName, isSelected && dynSheetStyles.itemNameSelected]}>
              {item.name}
            </Text>
            {item.description !== null && (
              <Text style={dynSheetStyles.itemDescription} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          {item.pos_enabled && (
            <View style={pickerStyles.posBadge}>
              <Text style={pickerStyles.posBadgeText}>POS</Text>
            </View>
          )}
          {isSelected && (
            <Text style={dynSheetStyles.checkmark}>{'V'}</Text>
          )}
        </TouchableOpacity>
      );
    }, [selectedId, handleSelect, dynSheetStyles]);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={pickerStyles.overlay}>
          <TouchableOpacity
            style={pickerStyles.backdrop}
            onPress={onClose}
            activeOpacity={1}
          />
          <View style={dynSheetStyles.panel}>
            <View style={dynSheetStyles.handle} />
            <View style={dynSheetStyles.panelHeader}>
              <Text style={dynSheetStyles.panelTitle}>What kind of business do you run?</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={dynSheetStyles.closeBtn}
              >
                <Text style={dynSheetStyles.closeBtnText}>{'X'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Production group ─────────────────────────────────────── */}
              <View style={dynSheetStyles.sectionHeader}>
                <Text style={dynSheetStyles.sectionEmoji}>{PRODUCTION_ICON}</Text>
                <Text style={dynSheetStyles.sectionTitle}>I make my products</Text>
              </View>
              <Text style={dynSheetStyles.sectionSubtitle}>
                Cook, bake, or assemble products from ingredients and raw materials
              </Text>
              {grouped.production.map((item) => (
                <React.Fragment key={item.id}>
                  {renderItem(item)}
                </React.Fragment>
              ))}

              <View style={dynSheetStyles.groupDivider} />

              {/* ── Reseller group ───────────────────────────────────────── */}
              <View style={dynSheetStyles.sectionHeader}>
                <Text style={dynSheetStyles.sectionEmoji}>{RESELLER_ICON}</Text>
                <Text style={dynSheetStyles.sectionTitle}>I resell products</Text>
              </View>
              <Text style={dynSheetStyles.sectionSubtitle}>
                Buy ready-made products and sell them to customers
              </Text>
              {grouped.reseller.map((item) => (
                <React.Fragment key={item.id}>
                  {renderItem(item)}
                </React.Fragment>
              ))}
            </ScrollView>
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
    const theme = useAppTheme();
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

    const dynPickerStyles = useMemo(() => StyleSheet.create({
      panel: {
        backgroundColor: theme.colors.surface,
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
        borderBottomColor: theme.colors.borderSubtle,
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
        backgroundColor: theme.colors.surfaceSubtle,
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
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      searchInput: {
        fontSize: 14,
        color: theme.colors.text,
        paddingVertical: 0,
      },
      separator: {
        height: 1,
        backgroundColor: theme.colors.borderSubtle,
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
        backgroundColor: theme.colors.primary[50],
      },
      itemText: {
        flex: 1,
        fontSize: 15,
        color: theme.colors.text,
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
    }), [theme]);

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
          <View style={dynPickerStyles.panel}>
            <View style={dynPickerStyles.panelHeader}>
              <Text style={dynPickerStyles.panelTitle}>Select Your Role</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                style={dynPickerStyles.closeBtn}
              >
                <Text style={dynPickerStyles.closeBtnText}>{'X'}</Text>
              </TouchableOpacity>
            </View>

            <View style={dynPickerStyles.searchRow}>
              <TextInput
                style={dynPickerStyles.searchInput}
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
              ItemSeparatorComponent={() => <View style={dynPickerStyles.separator} />}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[
                      dynPickerStyles.itemRow,
                      isSelected && dynPickerStyles.itemRowSelected,
                    ]}
                    onPress={() => handleSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        dynPickerStyles.itemText,
                        isSelected && dynPickerStyles.itemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isSelected && (
                      <Text style={dynPickerStyles.checkmark}>{'V'}</Text>
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
// NOTE: PickerTrigger uses module-level styles only (no semantic color tokens).
// The colors it uses (NAVY, border, placeholder) are brand or static error colors
// which do not change per theme mode. Only the border color references theme.colors.border
// which is handled via the parent screen's dynStyles.

interface PickerTriggerProps {
  label: string;
  displayValue: string;
  hasError: boolean;
  disabled: boolean;
  onPress: () => void;
  borderColor: string;
  placeholderColor: string;
  textSecondaryColor: string;
}

const PickerTrigger: React.FC<PickerTriggerProps> = React.memo(
  ({ label, displayValue, hasError, disabled, onPress, borderColor, placeholderColor, textSecondaryColor }) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.pickerTouchable,
          { borderColor },
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
            displayValue === '' && { color: placeholderColor },
          ]}
          numberOfLines={1}
        >
          {displayValue !== '' ? displayValue : `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={[styles.chevron, { color: textSecondaryColor }]}>{'v'}</Text>
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
  const theme      = useAppTheme();
  const dialog     = useAppDialog();

  const {
    businessTypes,
    groupedBusinessTypes,
    jobRoles,
    loading: setupLoading,
    error: setupError,
  } = useRegistrationSetup();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [businessTypePickerVisible, setBusinessTypePickerVisible] = useState(false);
  const [jobRolePickerVisible, setJobRolePickerVisible] = useState(false);

  // Track the selected business type category separately — required by RegisterCredentials
  // so the auth service can derive businessOperationMode without an extra DB call.
  const [selectedBusinessTypeCategory, setSelectedBusinessTypeCategory] = useState<string>('');

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
        email:                data.email,
        password:             data.password,
        firstName:            data.firstName,
        lastName:             data.lastName,
        username:             data.username,
        businessName:         data.businessName,
        businessTypeId:       data.businessTypeId,
        businessTypeCategory: selectedBusinessTypeCategory,
        jobRoleId:            data.jobRoleId,
        enterpriseType:       data.enterpriseType as EnterpriseType,
      };
      await register(credentials);

      const { isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated) {
        dialog.show({
          variant: 'info',
          title:   'Check your email',
          message: 'We sent a confirmation link to ' + data.email + '. Click it to activate your account.',
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setSubmitError(message);
    }
  };

  const displayError = submitError ?? storeError?.message ?? setupError ?? null;

  const pickersDisabled = setupLoading;

  const dynStyles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    card: {
      marginHorizontal: 20,
      marginTop: 24,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: NAVY,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 10,
    },
    cardSub: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 20,
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSubtle,
    },
    signInText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    footerText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    pill: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: NAVY,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      minHeight: 44,
      justifyContent: 'center',
    },
  }), [theme]);

  return (
    <SafeAreaView style={dynStyles.root} edges={['top', 'bottom']}>
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
          <View style={dynStyles.card}>
            <View style={styles.cardAccentBar}>
              <View style={[styles.accentSegment, { backgroundColor: GREEN, flex: 2 }]} />
              <View style={[styles.accentSegment, { backgroundColor: AMBER, flex: 1 }]} />
              <View style={[styles.accentSegment, { backgroundColor: NAVY, flex: 3 }]} />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Sign up</Text>
              <Text style={dynStyles.cardSub}>Fill in your details to get started</Text>

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
                          borderColor={theme.colors.border}
                          placeholderColor={theme.colors.placeholder}
                          textSecondaryColor={theme.colors.textSecondary}
                        />
                        {error?.message !== undefined && (
                          <Text style={styles.fieldError}>{error.message}</Text>
                        )}

                        <GroupedBusinessTypeSheet
                          visible={businessTypePickerVisible}
                          selectedId={value}
                          grouped={groupedBusinessTypes}
                          onSelect={(item) => {
                            onChange(item.id);
                            setSelectedBusinessTypeCategory(item.category);
                          }}
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
                          borderColor={theme.colors.border}
                          placeholderColor={theme.colors.placeholder}
                          textSecondaryColor={theme.colors.textSecondary}
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
                          dynStyles.pill,
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
                          dynStyles.pill,
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

              <View style={dynStyles.signInRow}>
                <Text style={dynStyles.signInText}>Already have an account? </Text>
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
            <Text style={dynStyles.footerText}>
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
      {dialog.Dialog}
    </SafeAreaView>
  );
}

// ─── Picker modal static styles ───────────────────────────────────────────────
const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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

// ─── Screen static styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
  chevron: {
    fontSize: 11,
    marginLeft: 8,
  },

  // ── Enterprise type pills ─────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 10,
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
    color: '#6B7280',
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitButton: {
    marginTop: 8,
  },

  // ── Sign-in link ──────────────────────────────────────────────────────────
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
  footerLink: {
    fontSize: 11,
    color: NAVY,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
