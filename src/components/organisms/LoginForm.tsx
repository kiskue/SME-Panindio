import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { theme } from '../../core/theme';
import { Button } from '../atoms/Button';
import { FormField } from '../molecules/FormField';
import { ErrorMessage } from '../molecules/ErrorMessage';
import { Text } from '../atoms/Text';

const loginSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => void;
  isLoading?: boolean;
  error?: string;
  onDemoPress?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
  onDemoPress,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <View style={styles.container}>
      {error && (
        <ErrorMessage
          message={error}
          variant="error"
          style={styles.errorMessage}
        />
      )}

      <FormField
        control={control}
        name="email"
        label="Email Address"
        placeholder="Enter your email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        rules={{
          required: 'Email is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address',
          },
        }}
      />

      <FormField
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        autoComplete="password"
        rules={{
          required: 'Password is required',
          minLength: {
            value: 6,
            message: 'Password must be at least 6 characters',
          },
        }}
      />

      <Button
        title="Sign In"
        onPress={handleSubmit(onSubmit)}
        loading={isLoading}
        fullWidth
        style={styles.submitButton}
      />

      {onDemoPress && (
        <Button
          title="Try Demo Account"
          onPress={onDemoPress}
          variant="outline"
          fullWidth
          style={styles.demoButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorMessage: {
    marginBottom: theme.spacing.md,
  },
  submitButton: {
    marginTop: theme.spacing.md,
  },
  demoButton: {
    marginTop: theme.spacing.sm,
  },
});