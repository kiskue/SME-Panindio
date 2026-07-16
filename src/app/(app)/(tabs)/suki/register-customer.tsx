import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { useAppDialog } from '@/hooks';
import { useRouter } from 'expo-router';
import { useAuthStore, selectCurrentUser, useSukiBusinessStore } from '@/store';
import { useAppTheme } from '@/core/theme';
import type { BusinessRegisterCustomerInput } from '@/types';

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

/** Conditionally forwards an `error` prop only when set (exactOptionalPropertyTypes). */
const errProp = (e?: string): { error: string } | Record<string, never> => (e ? { error: e } : {});

export default function RegisterCustomerScreen() {
  const router = useRouter();
  const dialog = useAppDialog();
  const theme = useAppTheme();

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

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="body-sm" style={[styles.intro, { color: theme.colors.textSecondary }]}>
            Add a new loyal customer to your Suki program. They'll be able to log in and order online.
          </Text>

          <Card variant="elevated" padding="lg" borderRadius="lg">
            <Input
              label="Full Name *"
              value={form.fullName}
              onChangeText={setField('fullName')}
              placeholder="Juan Dela Cruz"
              autoCapitalize="words"
              accessibilityLabel="Full name"
              {...errProp(errors.fullName)}
            />
            <Input
              label="Phone Number *"
              value={form.phoneNumber}
              onChangeText={setField('phoneNumber')}
              placeholder="09xxxxxxxxx"
              keyboardType="phone-pad"
              autoCapitalize="none"
              accessibilityLabel="Phone number"
              {...errProp(errors.phoneNumber)}
            />
            <Input
              label="Email (optional)"
              value={form.email}
              onChangeText={setField('email')}
              placeholder="juan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email address"
            />
            <Input
              label="Username *"
              value={form.username}
              onChangeText={setField('username')}
              placeholder="juandelacruz"
              autoCapitalize="none"
              accessibilityLabel="Username"
              {...errProp(errors.username)}
            />
            <Input
              label="Password *"
              value={form.password}
              onChangeText={setField('password')}
              placeholder="Min. 8 characters"
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Password"
              {...errProp(errors.password)}
            />
            <Input
              label="Confirm Password *"
              value={form.confirmPassword}
              onChangeText={setField('confirmPassword')}
              placeholder="Repeat password"
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Confirm password"
              {...errProp(errors.confirmPassword)}
            />

            <Button
              title="Register Customer"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              style={styles.submit}
            />
          </Card>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
      {dialog.Dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  intro: { marginBottom: 12, lineHeight: 18 },
  submit: { marginTop: 8 },
  bottomSpacer: { height: 32 },
});
