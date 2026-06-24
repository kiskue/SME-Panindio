import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useRouter } from 'expo-router';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { useSukiStore, selectSukiLoading, selectSukiError } from '@/store';

export function CustomerLoginSheet() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const mode = useThemeMode();
  const isDark = mode === 'dark';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { authenticateCustomer } = useSukiStore();
  const isLoading = useSukiStore(selectSukiLoading);
  const error = useSukiStore(selectSukiError);

  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in your username and password.');
      return;
    }
    await authenticateCustomer(username.trim(), password);
    const state = useSukiStore.getState();
    if (state.isCustomerLoggedIn) {
      router.replace('/(customer)/home');
    }
  };

  // ── Dynamic tokens ────────────────────────────────────────────────────────────
  const primaryColor  = isDark ? '#4F9EFF' : appTheme.colors.primary[500];
  const inputBg       = isDark ? '#1E2435' : '#FAFBFD';
  const inputBorder   = isDark ? 'rgba(255,255,255,0.12)' : '#DDE3EE';
  const inputText: string     = isDark ? 'rgba(255,255,255,0.90)' : staticTheme.colors.text;
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : staticTheme.colors.placeholder;
  const labelColor    = primaryColor;
  const errorBoxBg    = isDark ? 'rgba(239,68,68,0.10)' : '#FEF2F2';
  const errorTextColor = isDark ? '#FF6B6B' : '#B91C1C';

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: errorBoxBg }]}>
            <Text style={[styles.errorText, { color: errorTextColor }]}>{error}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: labelColor }]}>Username</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
          value={username}
          onChangeText={setUsername}
          placeholder="Your username"
          autoCapitalize="none"
          placeholderTextColor={placeholderColor}
        />

        <Text style={[styles.label, { color: labelColor }]}>Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: inputText }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          placeholderTextColor={placeholderColor}
        />

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: primaryColor }, isLoading && styles.loginBtnDisabled]}
          onPress={handlePasswordLogin}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.loginBtnText}>Log In</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  formContainer: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  loginBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorBox: { borderRadius: 8, padding: 10, marginBottom: 4 },
  errorText: { fontSize: 12 },
});
