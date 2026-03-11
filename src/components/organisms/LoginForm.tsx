import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { theme } from '../../core/theme';
import { FormField } from '../molecules/FormField';
import { ErrorMessage } from '../molecules/ErrorMessage';
import { Button } from '../atoms/Button/Button';

const loginSchema = yup.object({
  username: yup
    .string()
    .min(3, 'Username must be at least 3 characters')
    .required('Username is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

export interface LoginFormData {
  username: string;
  password: string;
}

export interface LoginFormProps {
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
  const { control, handleSubmit } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorMessage}>
          <ErrorMessage message={error} variant="error" />
        </View>
      )}

      <FormField
        control={control}
        name="username"
        label="Username"
        placeholder="Enter your username"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />

      <FormField
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="done"
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
