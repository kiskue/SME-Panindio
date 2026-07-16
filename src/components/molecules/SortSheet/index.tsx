/**
 * SortSheet
 *
 * Shared slide-up bottom sheet for picking an inventory sort order. Replaces
 * the two near-identical local `SortModal` implementations that previously
 * lived in `CategoryInventoryScreen` and the inventory overview screen.
 *
 * Renders a dimmed overlay + dark/light sheet with a drag handle, a "Sort by"
 * header (close X), and the shared `SORT_OPTIONS` rows with an accent check on
 * the active option.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { SORT_OPTIONS, type SortKey } from '@/core/utils/sort';

export interface SortSheetProps {
  visible: boolean;
  current: SortKey;
  /** Accent color for the active option + check icon (each screen's own accent). */
  accentColor: string;
  /** Dark/light styling. Falls back to the current theme mode when omitted. */
  isDark?: boolean;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

export const SortSheet: React.FC<SortSheetProps> = React.memo(
  ({ visible, current, accentColor, isDark, onSelect, onClose }) => {
    const theme    = useAppTheme();
    const mode     = useThemeMode();
    const insets   = useSafeAreaInsets();
    const dark     = isDark ?? mode === 'dark';
    const sheetBg  = dark ? '#1A1F2E' : theme.colors.surface;

    const dynStyles = useMemo(() => StyleSheet.create({
      sheet: {
        backgroundColor: sheetBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: staticTheme.spacing.md,
        paddingTop: staticTheme.spacing.md,
        // Clear the home indicator / gesture bar; spacing.xl stays the floor so
        // devices without a bottom inset look unchanged.
        paddingBottom: Math.max(insets.bottom, staticTheme.spacing.xl),
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.07)' : theme.colors.border,
        ...(dark ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 20,
        } : staticTheme.shadows.xl),
      },
      title:         { color: theme.colors.text },
      optionActive:  { backgroundColor: `${accentColor}15` },
      optionPressed: { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : theme.colors.gray[100] },
      handle:        { backgroundColor: dark ? 'rgba(255,255,255,0.15)' : theme.colors.gray[300] },
    }), [theme, sheetBg, dark, accentColor, insets.bottom]);

    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={dynStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.handle, dynStyles.handle]} />
            <View style={styles.header}>
              <Text variant="body" weight="semibold" style={dynStyles.title}>Sort by</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <X size={20} color={dark ? 'rgba(255,255,255,0.45)' : theme.colors.gray[500]} />
              </Pressable>
            </View>
            {SORT_OPTIONS.map((opt) => {
              const isActive = opt.key === current;
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.option,
                    isActive && dynStyles.optionActive,
                    pressed && dynStyles.optionPressed,
                  ]}
                  onPress={() => onSelect(opt.key)}
                  accessibilityRole="menuitem"
                >
                  <Text
                    variant="body"
                    weight={isActive ? 'semibold' : 'normal'}
                    style={{ color: isActive ? accentColor : theme.colors.text }}
                  >
                    {opt.label}
                  </Text>
                  {isActive && <Check size={16} color={accentColor} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
SortSheet.displayName = 'SortSheet';

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: staticTheme.spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: staticTheme.spacing.sm,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: staticTheme.spacing.sm,
    borderRadius: staticTheme.borderRadius.md,
  },
});
