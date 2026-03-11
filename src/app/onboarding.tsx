import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Rocket,
  Star,
  Shield,
  CheckCircle,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react-native';
import { useOnboardingStore, ONBOARDING_STEPS } from '@/store';
import { theme } from '@/core/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlideTheme {
  primary: string;
  blob1: string;
  blob2: string;
}

const SLIDE_THEMES: SlideTheme[] = [
  {
    primary: '#007AFF',
    blob1: 'rgba(255,255,255,0.18)',
    blob2: 'rgba(255,255,255,0.08)',
  },
  {
    primary: '#5856D6',
    blob1: 'rgba(255,255,255,0.18)',
    blob2: 'rgba(255,255,255,0.08)',
  },
  {
    primary: '#34C759',
    blob1: 'rgba(255,255,255,0.18)',
    blob2: 'rgba(255,255,255,0.08)',
  },
  {
    primary: '#FF9500',
    blob1: 'rgba(255,255,255,0.18)',
    blob2: 'rgba(255,255,255,0.08)',
  },
];

const ICON_MAP: Record<string, typeof Rocket> = {
  rocket: Rocket,
  star: Star,
  shield: Shield,
  'check-circle': CheckCircle,
};

const FALLBACK_THEME: SlideTheme = {
  primary: '#007AFF',
  blob1: 'rgba(255,255,255,0.18)',
  blob2: 'rgba(255,255,255,0.08)',
};

const CARD_HEIGHT = SCREEN_HEIGHT * 0.50;

export default function OnboardingScreen() {
  const router = useRouter();
  const currentStep = useOnboardingStore(state => state.currentStep);
  const completeOnboarding = useOnboardingStore(state => state.completeOnboarding);
  const nextStep = useOnboardingStore(state => state.nextStep);
  const previousStep = useOnboardingStore(state => state.previousStep);
  const setStep = useOnboardingStore(state => state.setStep);
  const isFirstStep = useOnboardingStore(state => state.currentStep === 0);
  const isLastStep = useOnboardingStore(
    state => state.currentStep === state.totalSteps - 1,
  );

  const [displayStep, setDisplayStep] = useState(currentStep);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;

  const step = ONBOARDING_STEPS[displayStep] ?? ONBOARDING_STEPS[0]!;
  const slideTheme = SLIDE_THEMES[displayStep] ?? FALLBACK_THEME;
  const IconComponent = ICON_MAP[step.icon] ?? Rocket;

  const animateTransition = useCallback(
    (action: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -24,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(iconScaleAnim, {
          toValue: 0.72,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        action();
        slideAnim.setValue(32);
        iconScaleAnim.setValue(0.72);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            damping: 14,
            stiffness: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnim, slideAnim, iconScaleAnim],
  );

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeOnboarding();
      router.replace('/(auth)/login');
      return;
    }
    const nextIndex = displayStep + 1;
    animateTransition(() => {
      nextStep();
      setDisplayStep(nextIndex);
    });
  }, [isLastStep, completeOnboarding, router, displayStep, animateTransition, nextStep]);

  const handlePrevious = useCallback(() => {
    if (isFirstStep) return;
    const prevIndex = displayStep - 1;
    animateTransition(() => {
      previousStep();
      setDisplayStep(prevIndex);
    });
  }, [isFirstStep, displayStep, animateTransition, previousStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    router.replace('/(auth)/login');
  }, [completeOnboarding, router]);

  const handleDotPress = useCallback(
    (index: number) => {
      if (index === displayStep) return;
      animateTransition(() => {
        setStep(index);
        setDisplayStep(index);
      });
    },
    [displayStep, animateTransition, setStep],
  );

  return (
    <View style={[styles.container, { backgroundColor: slideTheme.primary }]}>
      <StatusBar style="light" />

      {/* Decorative background blobs */}
      <View style={[styles.blob1, { backgroundColor: slideTheme.blob1 }]} />
      <View style={[styles.blob2, { backgroundColor: slideTheme.blob2 }]} />
      <View style={[styles.blob3, { backgroundColor: slideTheme.blob1 }]} />

      {/* Header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {displayStep + 1} / {ONBOARDING_STEPS.length}
            </Text>
          </View>
          {!isLastStep && (
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Icon area — fills upper colored section */}
      <View style={styles.iconSection}>
        <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <IconComponent
                size={64}
                color={slideTheme.primary}
                strokeWidth={1.5}
              />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* White bottom card */}
      <View style={styles.card}>
        {/* Animated text content */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </Animated.View>

        {/* Spacer pushes dots + nav to bottom */}
        <View style={styles.spacer} />

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {ONBOARDING_STEPS.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
            >
              <View
                style={[
                  styles.dot,
                  index === currentStep
                    ? [styles.dotActive, { backgroundColor: slideTheme.primary }]
                    : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigation row */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handlePrevious}
            activeOpacity={0.7}
            disabled={isFirstStep}
          >
            {!isFirstStep && (
              <>
                <ChevronLeft
                  size={18}
                  color={theme.colors.textSecondary}
                  strokeWidth={2}
                />
                <Text style={styles.backText}>Back</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: slideTheme.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextText}>
              {isLastStep ? 'Get Started' : 'Continue'}
            </Text>
            {!isLastStep && (
              <View style={styles.arrowWrapper}>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Decorative blobs ────────────────────────────────────────────────────────
  blob1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -100,
    right: -80,
  },
  blob2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 40,
    left: -70,
  },
  blob3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: SCREEN_HEIGHT * 0.22,
    right: -50,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  skipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },

  // ── Icon section ────────────────────────────────────────────────────────────
  iconSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80, // clear the header
    paddingBottom: theme.spacing.lg,
  },
  iconRing: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },

  // ── Bottom card ─────────────────────────────────────────────────────────────
  card: {
    height: CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    lineHeight: 26,
  },

  // ── Dots ────────────────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotActive: {
    width: 28,
  },
  dotInactive: {
    width: 8,
    backgroundColor: theme.colors.border,
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    minWidth: 80,
  },
  backText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginLeft: 2,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: theme.borderRadius.full,
    gap: 8,
    marginLeft: theme.spacing.md,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
  },
  arrowWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
