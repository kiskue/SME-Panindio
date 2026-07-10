import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { useAppTheme } from '@/core/theme';

export interface SectionHeaderProps {
  /** Section title (left side). */
  title: string;
  /** Optional trailing action label (e.g. "See all"). */
  actionLabel?: string;
  /** Fired when the trailing action is pressed. Required for the action to show. */
  onAction?: () => void;
  /** Optional style applied to the outer row. */
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}

/**
 * Titled section header with an optional trailing "see all"-style action.
 *
 * Standardises the hand-rolled section titles previously scattered across the
 * customer home and profile screens so every list/section header looks the same
 * (title weight, spacing, optional action affordance).
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
  style,
}) => {
  const theme = useAppTheme();
  const showAction = actionLabel !== undefined && onAction !== undefined;

  return (
    <View style={[styles.row, style]}>
      <Text variant="h6" weight="bold" style={{ color: theme.colors.text }}>
        {title}
      </Text>

      {showAction && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.action}
        >
          <Text variant="body-sm" weight="semibold" style={{ color: theme.colors.primary[500] }}>
            {actionLabel}
          </Text>
          <ChevronRight size={16} color={theme.colors.primary[500]} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
