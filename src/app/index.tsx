import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@/core/theme';
import { useRouteGuards } from '@/core/navigation/route-guards';
import { BrandLogo } from '@/components/atoms/BrandLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Splash / index screen — visible briefly while Zustand hydrates from
 * AsyncStorage. useRouteGuards replaces this screen once the destination
 * is resolved.
 *
 * Design: brand navy background, centered animated logo, subtle pulse ring.
 */
export default function IndexScreen() {
  useRouteGuards();

  const logoScale  = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringScale  = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ring expands and fades out
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.6,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.35,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 14,
        stiffness: 160,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Tagline fades in after logo settles
    const taglineTimeout = setTimeout(() => {
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 400);

    return () => clearTimeout(taglineTimeout);
  }, [logoScale, logoOpacity, ringScale, ringOpacity, taglineOpacity]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Decorative blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      {/* Logo card */}
      <Animated.View
        style={[
          styles.logoCard,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <BrandLogo size="lg" variant="full" />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Your complete business command centre
      </Animated.Text>

      {/* Bottom brand stripe */}
      <View style={styles.bottomStripe}>
        <View style={[styles.stripeSegment, { backgroundColor: theme.colors.primary[500] }]} />
        <View style={[styles.stripeSegment, { backgroundColor: theme.colors.highlight[400] }]} />
        <View style={[styles.stripeSegment, { backgroundColor: theme.colors.accent[500] }]} />
      </View>
    </View>
  );
}

const LOGO_CARD_SIZE = Math.min(SCREEN_WIDTH * 0.55, 240);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Decorative ambient circles
  blobTopRight: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -120,
    right: -100,
  },
  blobBottomLeft: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245,166,35,0.10)',
    bottom: -80,
    left: -100,
  },

  // Animated pulse ring
  pulseRing: {
    position: 'absolute',
    width: LOGO_CARD_SIZE + 32,
    height: LOGO_CARD_SIZE + 32,
    borderRadius: (LOGO_CARD_SIZE + 32) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // White logo card
  logoCard: {
    width: LOGO_CARD_SIZE,
    height: LOGO_CARD_SIZE,
    borderRadius: 28,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 18,
  },

  tagline: {
    marginTop: 28,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Tricolour bottom stripe
  bottomStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 5,
    flexDirection: 'row',
  },
  stripeSegment: {
    flex: 1,
  },
});
