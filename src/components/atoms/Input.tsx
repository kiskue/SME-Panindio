import React, { useState } from 'react';
import { TextInput, View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../../core/theme';
import { ComponentProps } from '../../../types';

interface InputProps extends ComponentProps, Omit<React.ComponentProps<typeof TextInput>, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  variant = 'outlined',
  size = 'md',
  multiline = false,
  numberOfLines = 1,
  editable = true,
  style,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const getVariantStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: theme.colors.gray[50],
          borderColor: 'transparent',
        };
      case 'outlined':
        return {
          backgroundColor: theme.colors.white,
          borderColor: error ? theme.colors.error[500] : isFocused ? theme.colors.primary[500] : theme.colors.gray[300],
        };
      default:
        return {
          backgroundColor: theme.colors.white,
          borderColor: error ? theme.colors.error[500] : isFocused ? theme.colors.primary[500] : theme.colors.gray[300],
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.borderRadius.sm,
          fontSize: theme.typography.sizes.sm,
        };
      case 'md':
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.base,
        };
      case 'lg':
        return {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          fontSize: theme.typography.sizes.lg,
        };
      default:
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.base,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: error ? theme.colors.error[500] : theme.colors.gray[700 }]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer,
        variantStyles,
        {
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderRadius: sizeStyles.borderRadius,
          minHeight: multiline ? size === 'sm' ? 80 : size === 'md' ? 100 : 120 : 'auto',
        },
        !editable && styles.disabled,
      ]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            {
              fontSize: sizeStyles.fontSize,
              paddingLeft: leftIcon ? theme.spacing.sm : sizeStyles.paddingHorizontal,
              paddingRight: secureTextEntry || rightIcon ? theme.spacing.sm : sizeStyles.paddingHorizontal,
              paddingVertical: sizeStyles.paddingVertical,
              color: editable ? theme.colors.gray[900] : theme.colors.gray[500],
            },
            multiline && styles.multilineInput,
          ]}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          placeholderTextColor={theme.colors.gray[400]}
        />
        
        {secureTextEntry && (
          <Pressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            <Text style={{ color: theme.colors.gray[500] }}>
              {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
            </Text>
          </Pressable>
        )}
        
        {rightIcon && !secureTextEntry && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      
      {(error || helperText) && (
        <Text style={[styles.helperText, { color: error ? theme.colors.error[500] : theme.colors.gray[500] }]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    fontFamily: theme.typography.fontFamily,
  },
  multilineInput: {
    textAlignVertical: 'top',
  },
  leftIcon: {
    marginLeft: theme.spacing.sm,
  },
  rightIcon: {
    marginRight: theme.spacing.sm,
  },
  helperText: {
    fontSize: theme.typography.sizes.xs,
    marginTop: theme.spacing.xs,
  },
  disabled: {
    opacity: 0.6,
  },
});