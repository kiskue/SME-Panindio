/**
 * ImagePickerField — molecule
 *
 * Reusable photo field backed by expo-image-picker (already a dependency,
 * mirrors the gallery flow in features/customer/ocr/IdCameraOverlay).
 *
 * - No value  → dashed placeholder; tapping opens the photo library.
 * - Has value → image preview with "Change" / "Remove" actions.
 *
 * The value is a local file URI (or undefined when cleared). Permission denial
 * and cancellation resolve silently, leaving the current value untouched.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Image, type StyleProp, type ViewStyle } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Pencil, Trash2 } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';

export interface ImagePickerFieldProps {
  /** Current image URI, or undefined when no image is set. */
  value?:      string | undefined;
  /** Called with the picked URI, or undefined when the image is removed. */
  onChange:    (uri: string | undefined) => void;
  label?:      string;
  helperText?: string;
  disabled?:   boolean;
  /** Preview height in px. Default 168. */
  height?:     number;
  /**
   * Open the native crop/edit step after picking. Default `false` — the chosen
   * photo is saved as-is. Forcing the editor (especially on Android) is
   * unreliable and means the image only returns when the user completes a crop.
   */
  allowsEditing?: boolean;
  /** Crop aspect ratio, only applied when `allowsEditing` is true. */
  aspect?:     [number, number];
  style?:      StyleProp<ViewStyle>;
}

export const ImagePickerField: React.FC<ImagePickerFieldProps> = ({
  value,
  onChange,
  label,
  helperText,
  disabled = false,
  height = 168,
  allowsEditing = false,
  aspect,
  style,
}) => {
  const theme  = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ['images'],
        quality:       0.7,
        allowsEditing,
        exif:          false,
        ...(allowsEditing && aspect ? { aspect } : {}),
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset?.uri) onChange(asset.uri);
    } catch {
      // Library unavailable / cancelled — keep the current value.
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, onChange, allowsEditing, aspect]);

  const remove = useCallback(() => {
    if (disabled) return;
    onChange(undefined);
  }, [disabled, onChange]);

  const dynStyles = useMemo(() => StyleSheet.create({
    labelText: {
      color: isDark ? 'rgba(255,255,255,0.65)' : theme.colors.gray[700],
      marginBottom: staticTheme.spacing.xs,
    },
    placeholder: {
      height,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : theme.colors.border,
      borderRadius: staticTheme.borderRadius.lg,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : theme.colors.gray[50],
      alignItems: 'center',
      justifyContent: 'center',
      gap: staticTheme.spacing.xs,
    },
    placeholderPressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.colors.gray[100] },
    iconChip: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: isDark ? 'rgba(79,158,255,0.18)' : theme.colors.primary[50],
      alignItems: 'center', justifyContent: 'center',
    },
    preview: {
      height,
      borderRadius: staticTheme.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: theme.colors.gray[100],
    },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: staticTheme.spacing.sm + 2,
      paddingVertical: 8,
      borderRadius: staticTheme.borderRadius.full,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    helper: { color: theme.colors.textSecondary, marginTop: staticTheme.spacing.xs },
  }), [theme, isDark, height]);

  const accent = isDark ? '#4F9EFF' : theme.colors.primary[500];

  return (
    <View style={style}>
      {label !== undefined && (
        <Text variant="body-sm" weight="medium" style={dynStyles.labelText}>{label}</Text>
      )}

      {value !== undefined && value.length > 0 ? (
        <View style={dynStyles.preview}>
          <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.actionRow}>
            <Pressable
              onPress={pick}
              disabled={disabled || busy}
              style={({ pressed }) => [dynStyles.actionBtn, pressed && styles.pressedFaint]}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
            >
              <Pencil size={14} color="#FFFFFF" />
              <Text variant="body-xs" weight="semibold" style={styles.actionText}>Change</Text>
            </Pressable>
            <Pressable
              onPress={remove}
              disabled={disabled}
              style={({ pressed }) => [dynStyles.actionBtn, pressed && styles.pressedFaint]}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
            >
              <Trash2 size={14} color="#FFFFFF" />
              <Text variant="body-xs" weight="semibold" style={styles.actionText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={pick}
          disabled={disabled || busy}
          style={({ pressed }) => [dynStyles.placeholder, pressed && dynStyles.placeholderPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
        >
          <View style={dynStyles.iconChip}>
            <ImagePlus size={22} color={accent} />
          </View>
          <Text variant="body-sm" weight="medium" style={{ color: accent }}>
            {busy ? 'Opening…' : 'Add photo'}
          </Text>
          <Text variant="body-xs" style={{ color: theme.colors.textSecondary }}>
            Tap to choose from your library
          </Text>
        </Pressable>
      )}

      {helperText !== undefined && (
        <Text variant="body-xs" style={dynStyles.helper}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  actionRow: {
    position: 'absolute',
    right: staticTheme.spacing.sm,
    bottom: staticTheme.spacing.sm,
    flexDirection: 'row',
    gap: staticTheme.spacing.sm,
  },
  actionText:   { color: '#FFFFFF' },
  pressedFaint: { opacity: 0.7 },
});
