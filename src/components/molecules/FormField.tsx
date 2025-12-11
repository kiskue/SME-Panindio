import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Controller, UseControllerProps } from 'react-hook-form';
import { Input } from '../atoms/Input';
import { theme } from '../../core/theme';

interface FormFieldProps extends UseControllerProps {
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  multiline?: boolean;
  numberOfLines?: number;
  helperText?: string;
  rules?: any;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  control,
  label,
  placeholder,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  variant = 'outlined',
  size = 'md',
  multiline = false,
  numberOfLines = 1,
  helperText,
  rules,
  defaultValue,
}) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <Input
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={error?.message}
            helperText={helperText}
            secureTextEntry={secureTextEntry}
            leftIcon={leftIcon}
            rightIcon={rightIcon}
            variant={variant}
            size={size}
            multiline={multiline}
            numberOfLines={numberOfLines}
          />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.sm,
  },
});