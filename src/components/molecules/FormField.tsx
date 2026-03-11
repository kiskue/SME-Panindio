import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Controller, UseControllerProps, Control } from 'react-hook-form';
import { Input } from '../atoms/Input';
import { theme } from '../../core/theme';

type TextInputProps = React.ComponentProps<typeof TextInput>;

export interface FormFieldProps extends Omit<UseControllerProps, 'control'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
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
  // Common TextInput pass-through props
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCorrect?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  textContentType?: TextInputProps['textContentType'];
  editable?: boolean;
  maxLength?: number;
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
  shouldUnregister,
  disabled,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  keyboardType,
  returnKeyType,
  textContentType,
  editable,
  maxLength,
}) => {
  const passThrough = {
    ...(autoCapitalize !== undefined ? { autoCapitalize } : {}),
    ...(autoComplete !== undefined ? { autoComplete } : {}),
    ...(autoCorrect !== undefined ? { autoCorrect } : {}),
    ...(keyboardType !== undefined ? { keyboardType } : {}),
    ...(returnKeyType !== undefined ? { returnKeyType } : {}),
    ...(textContentType !== undefined ? { textContentType } : {}),
    ...(editable !== undefined ? { editable } : {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
  };

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      defaultValue={defaultValue}
      {...(shouldUnregister !== undefined ? { shouldUnregister } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <Input
            label={label}
            {...(placeholder !== undefined ? { placeholder } : {})}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            {...(error?.message ? { error: error.message } : {})}
            {...(helperText !== undefined ? { helperText } : {})}
            secureTextEntry={secureTextEntry}
            {...(leftIcon !== undefined ? { leftIcon } : {})}
            {...(rightIcon !== undefined ? { rightIcon } : {})}
            variant={variant}
            size={size}
            multiline={multiline}
            numberOfLines={numberOfLines}
            {...passThrough}
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
