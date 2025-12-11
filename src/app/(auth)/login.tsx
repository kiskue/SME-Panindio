import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore, selectAuthLoading, selectAuthError } from '@/store';
import { theme } from '@/core/theme';
import { LoginForm } from '@/components/organisms/LoginForm';
import { LoadingSpinner } from '@/components/molecules/LoadingSpinner';
import { LoginCredentials } from '@/types';

export default function LoginScreen() {
  const router = useRouter();
  const { login, clearError } = useAuthStore();
  const isLoading = useAuthStore(selectAuthLoading);
  const error = useAuthStore(selectAuthError);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      await login(credentials);
      // Navigation is handled by the route guards
    } catch (error) {
      // Error is already handled in the store
      console.error('Login failed:', error);
    }
  };

  const handleDemoLogin = async () => {
    try {
      await login({ email: 'demo@app.com', password: 'demo1234' });
    } catch (error) {
      console.error('Demo login failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue to your account</Text>
            </View>

            {/* Login Form */}
            <LoginForm
              onSubmit={handleLogin}
              isLoading={isLoading}
              error={error?.message}
              onDemoPress={handleDemoLogin}
            />

            {/* Credentials hint */}
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>Demo credentials:</Text>
              <Text style={styles.hintText}>Email: demo@app.com</Text>
              <Text style={styles.hintText}>Password: demo1234</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Loading overlay */}
      {isLoading && (
        <LoadingSpinner
          fullScreen
          overlay
          text="Signing you in..."
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  hintContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  hintText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});