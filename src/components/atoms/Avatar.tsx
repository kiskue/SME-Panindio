import React from 'react';
import { View, Image, Text as RNText, StyleSheet } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export interface AvatarProps extends ComponentProps {
  source?: { uri: string };
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'rounded' | 'square';
  backgroundColor?: string;
  online?: boolean;
  badge?: React.ReactNode;
}

const SIZE_MAP = {
  xs: { dimension: 24, fontSize: 10 },
  sm: { dimension: 32, fontSize: 13 },
  md: { dimension: 40, fontSize: 16 },
  lg: { dimension: 56, fontSize: 22 },
  xl: { dimension: 72, fontSize: 28 },
};

export const Avatar: React.FC<AvatarProps> = ({
  source,
  initials,
  size = 'md',
  variant = 'circle',
  backgroundColor,
  online = false,
  badge,
  style,
}) => {
  const { dimension, fontSize } = SIZE_MAP[size];

  const getBorderRadius = () => {
    switch (variant) {
      case 'circle':  return dimension / 2;
      case 'rounded': return theme.borderRadius.md;
      case 'square':  return 0;
      default:        return dimension / 2;
    }
  };

  const borderRadius = getBorderRadius();
  const bgColor = backgroundColor ?? theme.colors.primary[500];
  const onlineSize = Math.max(8, Math.round(dimension * 0.25));

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.avatar,
          {
            width: dimension,
            height: dimension,
            borderRadius,
            backgroundColor: source ? 'transparent' : bgColor,
          },
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: dimension, height: dimension, borderRadius }}
            resizeMode="cover"
          />
        ) : (
          <RNText style={{ fontSize, color: theme.colors.white, fontWeight: '600' }}>
            {initials ?? '?'}
          </RNText>
        )}
      </View>

      {online && (
        <View
          style={[
            styles.onlineIndicator,
            { width: onlineSize, height: onlineSize, borderRadius: onlineSize / 2 },
          ]}
        />
      )}

      {badge !== undefined && (
        <View style={styles.badgeContainer}>{badge}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.success[500],
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
});
