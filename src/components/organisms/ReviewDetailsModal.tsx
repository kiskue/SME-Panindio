import React, { useMemo } from 'react';
import {
  Modal,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button/Button';
import { useAppTheme, useThemeMode } from '@/core/theme';

// ─── Brand constants (fixed identity across light/dark) ────────────────────────
const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

/**
 * One row in the review preview: a label, its value, and an optional leading
 * icon (any node — typically a lucide icon sized ~16).
 */
export interface ReviewDetailItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface ReviewDetailsModalProps {
  visible: boolean;
  /** Rows to preview. Never include passwords or other secrets. */
  items: ReviewDetailItem[];
  /** Fired when the user confirms — proceed with the create/submit action. */
  onConfirm: () => void;
  /** Fired on "Edit", backdrop tap, or hardware back — return to the form. */
  onEdit: () => void;
  title?: string;
  subtitle?: string;
  /** Small footnote under the rows, e.g. a security note. */
  note?: string;
  confirmLabel?: string;
  editLabel?: string;
  /** While true the confirm button shows a spinner and both buttons disable. */
  loading?: boolean;
}

/**
 * Uniform "Review your details" confirmation modal.
 *
 * A centered, brand-accented card that previews what the user entered before a
 * destructive/creating action runs. Shared by the business-registration and
 * Suki (customer) registration flows so both look and behave identically.
 *
 * Theme-aware (light/dark) via the app theme; the navy/amber/green accent stripe
 * is the fixed brand identity and stays constant across modes.
 */
export const ReviewDetailsModal: React.FC<ReviewDetailsModalProps> = ({
  visible,
  items,
  onConfirm,
  onEdit,
  title = 'Review your details',
  subtitle = 'Please confirm everything looks right before we create your account.',
  note,
  confirmLabel = 'Confirm & Create',
  editLabel = 'Edit',
  loading = false,
}) => {
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';

  // Navy adapts for contrast on dark surfaces; the stripe stays brand-fixed.
  const accent = isDark ? '#4F9EFF' : NAVY;

  const dyn = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.surface,
          borderColor: isDark ? theme.colors.border : 'transparent',
        },
        title: { color: accent },
        subtitle: { color: theme.colors.textSecondary },
        block: { borderColor: theme.colors.borderSubtle },
        iconCircle: { backgroundColor: accent + '14' },
        label: { color: accent },
        value: { color: theme.colors.text },
        sep: { backgroundColor: theme.colors.borderSubtle },
        note: { color: theme.colors.textSecondary },
      }),
    [theme, isDark, accent],
  );

  const handleClose = () => {
    if (!loading) onEdit();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={[styles.card, dyn.card]}>
          {/* Brand accent stripe */}
          <View style={styles.accent}>
            <View style={[styles.accentSeg, { backgroundColor: NAVY, flex: 3 }]} />
            <View style={[styles.accentSeg, { backgroundColor: AMBER, flex: 1 }]} />
            <View style={[styles.accentSeg, { backgroundColor: GREEN, flex: 2 }]} />
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, dyn.title]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, dyn.subtitle]}>{subtitle}</Text>}

            <View style={[styles.block, dyn.block]}>
              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {items.map((item, index) => (
                  <React.Fragment key={item.label}>
                    {index > 0 && <View style={[styles.sep, dyn.sep]} />}
                    <View style={styles.row}>
                      {item.icon !== undefined && (
                        <View style={[styles.iconCircle, dyn.iconCircle]}>{item.icon}</View>
                      )}
                      <View style={styles.textWrap}>
                        <Text style={[styles.label, dyn.label]}>{item.label}</Text>
                        <Text style={[styles.value, dyn.value]} numberOfLines={2}>
                          {item.value}
                        </Text>
                      </View>
                    </View>
                  </React.Fragment>
                ))}
              </ScrollView>
            </View>

            {!!note && <Text style={[styles.note, dyn.note]}>{note}</Text>}

            <View style={styles.actions}>
              <Button
                title={editLabel}
                variant="outline"
                onPress={onEdit}
                disabled={loading}
                style={styles.editBtn}
              />
              <Button
                title={confirmLabel}
                variant="primary"
                onPress={onConfirm}
                loading={loading}
                style={styles.confirmBtn}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,17,23,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 16,
  },
  accent: { flexDirection: 'row', height: 4 },
  accentSeg: { height: 4 },
  body: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  block: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  scroll: { maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  sep: { height: 1 },
  note: { marginTop: 14, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', marginTop: 20, gap: 12 },
  editBtn: { flex: 1 },
  confirmBtn: { flex: 1.6 },
});
