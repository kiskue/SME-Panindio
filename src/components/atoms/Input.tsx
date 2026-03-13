import React, { useState } from 'react';
import { TextInput, View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../../core/theme';
import { useThemeStore, selectThemeMode } from '../../store/theme.store';
import { ComponentProps } from '@/types';

// ── Dark-mode design tokens (input-specific) ──────────────────────────────────
// These sit outside the shared theme object because they are input-surface
// colours that need to sit one step lighter than the card background so the
// field is visually distinct without being harsh.
const INPUT_DARK = {
  bg:              '#1E2435',           // one step lighter than card (#151A27 / #1A1F2E)
  bgFilled:        '#242A3A',           // filled variant — slightly more opaque
  borderRest:      'rgba(255,255,255,0.12)',
  borderFocus:     'rgba(255,255,255,0.30)',
  text:            'rgba(255,255,255,0.90)',
  textDisabled:    'rgba(255,255,255,0.35)',
  placeholder:     'rgba(255,255,255,0.35)',
  label:           'rgba(255,255,255,0.60)',
  helperText:      'rgba(255,255,255,0.40)',
  eyeIcon:         'rgba(255,255,255,0.50)',
} as const;

const INPUT_LIGHT = {
  bg:              '#F8F9FC',
  bgFilled:        '#F1F3F7',
  borderRest:      '#E2E8F0',
  borderFocus:     theme.colors.primary[500],
  text:            theme.colors.gray[900],
  textDisabled:    theme.colors.gray[500],
  placeholder:     theme.colors.gray[400],
  label:           theme.colors.gray[700],
  helperText:      theme.colors.gray[500],
  eyeIcon:         theme.colors.gray[500],
} as const;


export interface InputProps extends ComponentProps, Omit<React.ComponentProps<typeof TextInput>, 'style'> {
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

  const mode   = useThemeStore(selectThemeMode);
  const isDark = mode === 'dark';
  const tok    = isDark ? INPUT_DARK : INPUT_LIGHT;

  // Derive border colour as a plain string BEFORE entering JSX so TypeScript
  // can narrow it correctly (StyleSheet.create expects plain string, not union).
  const borderColor: string = error
    ? theme.colors.error[500]
    : isFocused
      ? (isDark ? tok.borderFocus : theme.colors.primary[500])
      : tok.borderRest;

  const getVariantStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: tok.bgFilled,
          borderColor: 'transparent' as const,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: tok.bg,
          borderColor,
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
      case 'lg':
        return {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          fontSize: theme.typography.sizes.lg,
        };
      case 'md':
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
  const sizeStyles    = getSizeStyles();

  // Derive text colour as a plain string before JSX
  const textColor: string = editable ? tok.text : tok.textDisabled;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: error ? theme.colors.error[500] : tok.label }]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputContainer,
        variantStyles,
        {
          borderWidth: variant === 'outlined' || variant === 'default' ? 1 : 0,
          borderRadius: sizeStyles.borderRadius,
          ...(multiline ? { minHeight: size === 'sm' ? 80 : size === 'md' ? 100 : 120 } : {}),
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
              color: textColor,
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
          placeholderTextColor={tok.placeholder}
        />

        {secureTextEntry && (
          <Pressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIcon}
          >
            <Text style={{ color: tok.eyeIcon }}>
              {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
            </Text>
          </Pressable>
        )}

        {rightIcon && !secureTextEntry && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {(error || helperText) && (
        <Text style={[styles.helperText, { color: error ? theme.colors.error[500] : tok.helperText }]}>
          {error ?? helperText}
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