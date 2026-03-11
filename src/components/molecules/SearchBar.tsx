import React, { useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export interface SearchBarProps extends ComponentProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSearch?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
  loading?: boolean;
  variant?: 'default' | 'filled' | 'outlined';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  onSearch,
  autoFocus = false,
  editable = true,
  loading = false,
  variant = 'default',
  style,
}) => {
  const inputRef = useRef<TextInput>(null);

  const getContainerStyle = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: theme.colors.gray[200],
          borderRadius: theme.borderRadius.full,
          borderWidth: 0,
        };
      case 'outlined':
        return {
          backgroundColor: theme.colors.white,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.gray[300],
        };
      default:
        return {
          backgroundColor: theme.colors.gray[100],
          borderRadius: theme.borderRadius.lg,
          borderWidth: 0,
        };
    }
  };

  const handleClear = () => {
    onChangeText('');
    onClear?.();
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, getContainerStyle(), style]}>
      <View style={styles.iconLeft}>
        {loading
          ? <ActivityIndicator size="small" color={theme.colors.gray[400]} />
          : <Search size={18} color={theme.colors.gray[400]} />}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.placeholder}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        onSubmitEditing={onSearch}
        style={[styles.input, !editable && styles.disabled]}
      />

      {value.length > 0 && editable && (
        <Pressable onPress={handleClear} style={styles.iconRight} hitSlop={8}>
          <X size={16} color={theme.colors.gray[400]} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    height: 44,
  },
  iconLeft: {
    marginRight: theme.spacing.xs,
    width: 22,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  iconRight: {
    marginLeft: theme.spacing.xs,
    padding: 2,
  },
  disabled: { opacity: 0.6 },
});
