import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  Info,
  AlertTriangle,
  AlertCircle,
  MessageCircle,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useAppTheme, useThemeMode } from '@/core/theme';
import { Text } from '../atoms/Text';
import { Card } from '../atoms/Card';
import { Avatar } from '../atoms/Avatar';
import { Badge, type BadgeVariant } from '../atoms/Badge';
import { formatRelativeTime } from '@/core/utils/date';
import { Notification, NotificationType } from '@/types';

export interface NotificationItemProps {
  notification: Notification;
  onPress?: (notification: Notification) => void;
  onDismiss?: (notification: Notification) => void;
  /** Show the relative timestamp in the trailing column. Default `true`. */
  showTime?: boolean;
}

// ── Small pure color helpers ────────────────────────────────────────────────
// Colors come exclusively from theme tokens; these only composite two tokens so
// the tinted surfaces stay opaque (no bleed of the screen background through a
// translucent card).
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

/** Opaque blend of `overlay` over `base` at `alpha` (0..1). */
const mix = (base: string, overlay: string, alpha: number): string => {
  const b = hexToRgb(base);
  const o = hexToRgb(overlay);
  const r = Math.round(b.r + (o.r - b.r) * alpha);
  const g = Math.round(b.g + (o.g - b.g) * alpha);
  const bl = Math.round(b.b + (o.b - b.b) * alpha);
  return `rgb(${r}, ${g}, ${bl})`;
};

type TypeConfig = {
  scale: Record<number, string>;
  badge: BadgeVariant;
  Icon: LucideIcon;
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
  showTime = true,
}) => {
  const theme = useAppTheme();
  const isDark = useThemeMode() === 'dark';
  const isUnread = !notification.isRead;

  const typeConfig = useMemo<Record<NotificationType, TypeConfig>>(
    () => ({
      INFO: { scale: theme.colors.info, badge: 'info', Icon: Info },
      WARNING: { scale: theme.colors.warning, badge: 'warning', Icon: AlertTriangle },
      ALERT: { scale: theme.colors.error, badge: 'error', Icon: AlertCircle },
      CHAT_MESSAGE: { scale: theme.colors.primary, badge: 'primary', Icon: MessageCircle },
    }),
    [theme],
  );

  const config = typeConfig[notification.type] ?? typeConfig.INFO;
  // Saturated brand/semantic hues read fine as accents in both modes; the deep
  // 500 shades disappear on dark surfaces, so step up to 400 there.
  const accent = isDark ? (config.scale[400] ?? config.scale[500] ?? theme.colors.primary[500])
                        : (config.scale[500] ?? theme.colors.primary[500]);

  // A product image (when the payload carries one) is the hero; otherwise a
  // type-tinted icon chip stands in.
  const rawImage = notification.data?.productImageUrl;
  const imageUri = typeof rawImage === 'string' && rawImage.length > 0 ? rawImage : undefined;

  const time = showTime ? formatRelativeTime(notification.createdAt) : '';

  const dyn = useMemo(() => {
    const surface = theme.colors.surface;
    return StyleSheet.create({
      card: {
        // Unread rows sit on a subtle, opaque type-tinted surface + a left accent
        // bar; read rows use the plain elevated surface.
        ...(isUnread ? { backgroundColor: mix(surface, accent, isDark ? 0.16 : 0.06) } : {}),
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        paddingRight: theme.spacing.md,
        paddingLeft: theme.spacing.md,
      },
      accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: accent,
      },
      iconChip: {
        width: 44,
        height: 44,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: mix(surface, accent, isDark ? 0.22 : 0.13),
      },
      title: { color: theme.colors.text },
      body: { color: theme.colors.textSecondary, marginTop: 2 },
      time: { color: theme.colors.textSecondary },
    });
  }, [theme, isDark, isUnread, accent]);

  const handlePress = () => onPress?.(notification);
  const handleDismiss = () => onDismiss?.(notification);

  return (
    <Card
      variant="elevated"
      padding="none"
      borderRadius="lg"
      style={dyn.card}
      {...(onPress ? { onPress: handlePress } : {})}
    >
      <View style={dyn.row}>
        {isUnread && <View style={dyn.accentBar} />}

        {/* Leading — product thumbnail or type-tinted icon chip */}
        {imageUri !== undefined ? (
          <Avatar source={{ uri: imageUri }} variant="rounded" size="md" />
        ) : (
          <View style={dyn.iconChip}>
            <config.Icon size={22} color={accent} />
          </View>
        )}

        {/* Body — title + 2-line preview */}
        <View style={styles.content}>
          <Text
            variant="body"
            weight={isUnread ? 'bold' : 'semibold'}
            numberOfLines={1}
            style={dyn.title}
          >
            {notification.title}
          </Text>
          <Text variant="body-sm" numberOfLines={2} style={dyn.body}>
            {notification.body}
          </Text>
        </View>

        {/* Trailing — relative time + unread dot (+ optional dismiss) */}
        <View style={styles.trailing}>
          {onDismiss !== undefined ? (
            <Pressable
              onPress={handleDismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              style={styles.dismissBtn}
            >
              <X size={16} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
          {time !== '' && (
            <Text variant="caption" style={dyn.time} numberOfLines={1}>
              {time}
            </Text>
          )}
          {isUnread && <Badge dot variant={config.badge} style={styles.dot} />}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 6,
    minWidth: 44,
  },
  dismissBtn: {
    padding: 2,
  },
  dot: {
    marginTop: 2,
  },
});
