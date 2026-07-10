import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Package, Flame } from 'lucide-react-native';
import { Text } from '@/components/atoms/Text';
import { Card } from '@/components/atoms/Card';
import { FavoriteButton } from '@/components/molecules/FavoriteButton';
import { AddToCartButton } from '@/components/molecules/AddToCartButton';
import { useAppTheme } from '@/core/theme';
import { theme as staticTheme } from '@/core/theme';
import { formatCurrency } from '@/core/utils/format';
import type { OnlineCatalogItem } from '@/types';

/** Layout variant for the buyable product card. */
export type ProductCardVariant = 'grid' | 'horizontal';

export interface ProductCardProps {
  item: OnlineCatalogItem;
  /**
   * Fired when the user taps Add. Return `true`/`Promise<true>` on a successful
   * add so the button can confirm; `void`/`undefined` is treated as success.
   */
  onAddToCart: (item: OnlineCatalogItem) => boolean | Promise<boolean> | void;
  /**
   * Layout:
   *  - `grid`       — image-on-top card, sized for a 2-column grid (default).
   *  - `horizontal` — image-left row with an inset floating thumbnail, full-width.
   * @default 'grid'
   */
  variant?: ProductCardVariant;
  /** When true, shows a "Popular" pill on the image (suppressed when sold out). */
  isPopular?: boolean;
  /** Whether the current customer has favorited this product. */
  isFavorite?: boolean;
  /** Fired when the heart is tapped. The heart renders ONLY when provided. */
  onToggleFavorite?: (item: OnlineCatalogItem) => void;
}

/** Fixed scrim so a dimmed sold-out photo reads the same in both themes. */
const DIM_SCRIM = 'rgba(15,23,42,0.45)';

/**
 * Buyable catalog product card for the customer (suki) ordering experience.
 *
 * Modern refresh: xl-radius elevated Card, an inset floating thumbnail in the
 * horizontal row, a circular "+" add button (Plus→Check confirm), a favorite
 * heart and an optional "Popular" pill as image overlays, and a dimmed +
 * non-orderable sold-out state. Availability/ordering correctness stays with the
 * store guards (via the passed `onAddToCart`); the card only reflects state.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  onAddToCart,
  variant = 'grid',
  isPopular = false,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const outOfStock = item.stockQuantity <= 0;
  const showPopular = isPopular && !outOfStock;
  const isHorizontal = variant === 'horizontal';

  // Image fade-in over the placeholder (RN Image — expo-image isn't installed).
  const imgOpacity = useSharedValue(0);
  const imgStyle = useAnimatedStyle(() => ({ opacity: imgOpacity.value }));
  const onImgLoad = useCallback(() => {
    imgOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: 220 });
  }, [imgOpacity, reducedMotion]);

  const placeholderBg = theme.colors.surfaceSubtle;
  const iconColor = theme.colors.tintPrimary;
  const priceColor = theme.colors.tintPrimary;
  const nameColor = theme.colors.text;

  const heart = onToggleFavorite ? (
    <FavoriteButton
      isFavorite={isFavorite}
      onToggle={() => onToggleFavorite(item)}
      size={isHorizontal ? 'sm' : 'md'}
      accessibilityLabel={`${isFavorite ? 'Remove' : 'Add'} ${item.productName} ${isFavorite ? 'from' : 'to'} favorites`}
    />
  ) : null;

  const addButton = (
    <AddToCartButton
      onAdd={() => onAddToCart(item)}
      disabled={outOfStock}
      accessibilityLabel={`Add ${item.productName} to cart`}
      addedAccessibilityLabel={`${item.productName} added to cart`}
    />
  );

  const popularPill = showPopular ? (
    <View style={styles.popularPill}>
      <Flame size={isHorizontal ? 11 : 12} color={staticTheme.colors.onHighlight} />
      <Text variant="body-xs" weight="bold" style={styles.popularText}>
        Popular
      </Text>
    </View>
  ) : null;

  // The image stack: placeholder underneath, photo fading in on top, an optional
  // sold-out dim scrim, then the overlays (Popular / heart / grid add / sold-out).
  const imageStack = (iconSize: number) => (
    <>
      <View style={[StyleSheet.absoluteFill, styles.placeholderFill, { backgroundColor: placeholderBg }]}>
        <Package size={iconSize} color={iconColor} />
      </View>
      {item.productImageUrl ? (
        <Animated.Image
          source={{ uri: item.productImageUrl }}
          style={[StyleSheet.absoluteFill, imgStyle]}
          resizeMode="cover"
          onLoad={onImgLoad}
        />
      ) : null}
      {outOfStock && <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM_SCRIM }]} pointerEvents="none" />}
      {outOfStock && (
        <View style={styles.soldOutFill} pointerEvents="none">
          <View style={styles.soldOutPill}>
            <Text variant="body-xs" weight="bold" style={styles.soldOutText}>
              Sold out
            </Text>
          </View>
        </View>
      )}
    </>
  );

  // ── Horizontal row (home) — inset floating thumbnail + footer add button ────
  if (isHorizontal) {
    return (
      <Card variant="elevated" padding="none" borderRadius="xl" shadow="sm" style={styles.rowCard}>
        <View style={styles.rowInner}>
          <View style={styles.rowImageWrap}>
            {imageStack(26)}
            {popularPill && <View style={styles.popularHorizontal}>{popularPill}</View>}
            {heart && <View style={styles.heartHorizontal}>{heart}</View>}
          </View>

          <View style={styles.rowBody}>
            <Text variant="body-sm" weight="semibold" numberOfLines={2} style={{ color: nameColor }}>
              {item.productName}
            </Text>
            <View style={styles.rowFooter}>
              <Text variant="h6" weight="bold" style={[styles.priceText, { color: priceColor }]}>
                {formatCurrency(item.customPrice ?? NaN, { dashOnZero: true })}
              </Text>
              {addButton}
            </View>
          </View>
        </View>
      </Card>
    );
  }

  // ── Grid card (browse) — image-top, add button floats on the image ──────────
  return (
    <Card variant="elevated" padding="none" borderRadius="xl" shadow="sm" style={styles.card}>
      <View style={styles.imageWrap}>
        {imageStack(34)}
        {popularPill && <View style={styles.popularGrid}>{popularPill}</View>}
        {heart && <View style={styles.heartGrid}>{heart}</View>}
        <View style={styles.addGrid}>{addButton}</View>
      </View>

      <View style={styles.body}>
        <Text variant="body-sm" weight="semibold" numberOfLines={2} style={[styles.gridName, { color: nameColor }]}>
          {item.productName}
        </Text>
        <Text variant="h6" weight="bold" style={[styles.priceText, styles.gridPrice, { color: priceColor }]}>
          {formatCurrency(item.customPrice ?? NaN, { dashOnZero: true })}
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  // Grid variant
  card: { flex: 1 },
  imageWrap: { position: 'relative', width: '100%', height: 128 },
  body: { padding: staticTheme.spacing.sm },
  gridName: { minHeight: 34 },
  gridPrice: { marginTop: 2 },
  addGrid: { position: 'absolute', bottom: 8, right: 8 },

  // Horizontal variant
  rowCard: { width: '100%' },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: staticTheme.spacing.sm,
    gap: staticTheme.spacing.sm,
  },
  rowImageWrap: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: staticTheme.borderRadius.lg,
    overflow: 'hidden',
  },
  rowBody: { flex: 1, justifyContent: 'center', gap: 4 },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Shared
  placeholderFill: { alignItems: 'center', justifyContent: 'center' },
  priceText: { letterSpacing: -0.2 },

  popularPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: staticTheme.colors.highlight[400],
  },
  popularText: { color: staticTheme.colors.onHighlight },
  popularGrid: { position: 'absolute', top: 8, left: 8 },
  popularHorizontal: { position: 'absolute', bottom: 6, left: 6 },

  heartGrid: { position: 'absolute', top: 8, right: 8 },
  heartHorizontal: { position: 'absolute', top: 6, right: 6 },

  soldOutFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutPill: {
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: staticTheme.colors.gray[800],
  },
  soldOutText: { color: '#FFFFFF' },
});
