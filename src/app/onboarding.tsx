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
import Svg, { Path, Circle, Rect, G, Polygon } from 'react-native-svg';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { useOnboardingStore, ONBOARDING_STEPS } from '@/store';
import { theme } from '@/core/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Brand colours ────────────────────────────────────────────────────────────
const NAVY  = '#1E4D8C';
const AMBER = '#F5A623';
const GREEN = '#27AE60';

// ─── Per-slide theme configuration ──────────────────────────────────────────
interface SlideConfig {
  background: string;
  accent: string;
  blob1: string;
  blob2: string;
  buttonColor: string;
}

const SLIDE_CONFIGS: SlideConfig[] = [
  {
    // Welcome — navy
    background: NAVY,
    accent: AMBER,
    blob1: 'rgba(245,166,35,0.18)',
    blob2: 'rgba(255,255,255,0.08)',
    buttonColor: AMBER,
  },
  {
    // Inventory — deep green
    background: '#1A7A48',
    accent: AMBER,
    blob1: 'rgba(245,166,35,0.15)',
    blob2: 'rgba(255,255,255,0.07)',
    buttonColor: AMBER,
  },
  {
    // POS — amber/orange
    background: '#C8780A',
    accent: '#FFFFFF',
    blob1: 'rgba(255,255,255,0.15)',
    blob2: 'rgba(30,77,140,0.12)',
    buttonColor: NAVY,
  },
  {
    // Insights — navy dark
    background: '#12305E',
    accent: GREEN,
    blob1: 'rgba(39,174,96,0.20)',
    blob2: 'rgba(255,255,255,0.07)',
    buttonColor: GREEN,
  },
];

const FALLBACK_CONFIG: SlideConfig = SLIDE_CONFIGS[0]!;

// ─── Slide illustration icons (SVG) ─────────────────────────────────────────

const StoreIllustration: React.FC<{ accent: string }> = ({ accent }) => (
  <Svg width={120} height={120} viewBox="0 0 120 120">
    {/* Body */}
    <Rect x="18" y="52" width="84" height="56" rx="4" fill="#FFFFFF" opacity={0.95} />
    {/* Awning frame */}
    <Rect x="10" y="40" width="100" height="18" rx="3" fill={NAVY} />
    {/* Awning stripes */}
    <G>
      <Rect x="10" y="40" width="13" height="18" fill={accent} />
      <Rect x="36" y="40" width="13" height="18" fill={accent} />
      <Rect x="62" y="40" width="13" height="18" fill={accent} />
      <Rect x="88" y="40" width="22" height="18" rx="3" fill={accent} />
    </G>
    {/* Scallop */}
    <Path d="M10 58 Q16 64 22 58 Q28 64 34 58 Q40 64 46 58 Q52 64 58 58 Q64 64 70 58 Q76 64 82 58 Q88 64 94 58 Q100 64 106 58 Q109 62 110 58" stroke={accent} strokeWidth="2" fill="none" />
    {/* Roof */}
    <Polygon points="60,10 8,42 112,42" fill={NAVY} />
    <Polygon points="60,14 16,42 104,42" fill={accent} opacity={0.3} />
    {/* Door */}
    <Rect x="45" y="76" width="30" height="32" rx="3" fill={NAVY} opacity={0.15} />
    <Circle cx="60" cy="95" r="2.5" fill={NAVY} opacity={0.4} />
    {/* Windows */}
    <Rect x="22" y="60" width="16" height="14" rx="2" fill={NAVY} opacity={0.12} />
    <Rect x="82" y="60" width="16" height="14" rx="2" fill={NAVY} opacity={0.12} />
    {/* Box */}
    <Rect x="28" y="64" width="14" height="11" rx="1.5" fill={accent} opacity={0.7} />
    <Rect x="44" y="67" width="10" height="8" rx="1" fill={accent} opacity={0.5} />
  </Svg>
);

const BoxesIllustration: React.FC<{ accent: string }> = ({ accent }) => (
  <Svg width={120} height={120} viewBox="0 0 120 120">
    {/* Back box */}
    <Rect x="40" y="24" width="52" height="46" rx="4" fill="#FFFFFF" opacity={0.6} />
    <Rect x="40" y="24" width="52" height="12" rx="4" fill={accent} opacity={0.5} />
    {/* Middle box */}
    <Rect x="20" y="52" width="52" height="46" rx="4" fill="#FFFFFF" opacity={0.85} />
    <Rect x="20" y="52" width="52" height="12" rx="4" fill={accent} opacity={0.7} />
    {/* Front box */}
    <Rect x="50" y="62" width="52" height="46" rx="4" fill="#FFFFFF" />
    <Rect x="50" y="62" width="52" height="12" rx="4" fill={accent} />
    {/* Tape lines */}
    <Path d="M50 74 L102 74" stroke={accent} strokeWidth="2" opacity={0.5} />
    <Path d="M76 62 L76 108" stroke={accent} strokeWidth="2" opacity={0.5} />
    {/* Check badge */}
    <Circle cx="92" cy="44" r="14" fill={GREEN} />
    <Path d="M85 44 L90 50 L100 38" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

const PosIllustration: React.FC<{ accent: string }> = ({ accent }) => (
  <Svg width={120} height={120} viewBox="0 0 120 120">
    {/* Tablet frame */}
    <Rect x="14" y="12" width="92" height="70" rx="8" fill="#FFFFFF" opacity={0.95} />
    <Rect x="14" y="12" width="92" height="70" rx="8" stroke={accent} strokeWidth="2" fill="none" />
    {/* Screen content — product tiles */}
    <Rect x="20" y="20" width="24" height="20" rx="3" fill={accent} opacity={0.7} />
    <Rect x="48" y="20" width="24" height="20" rx="3" fill={NAVY} opacity={0.25} />
    <Rect x="76" y="20" width="24" height="20" rx="3" fill={accent} opacity={0.5} />
    <Rect x="20" y="44" width="24" height="20" rx="3" fill={NAVY} opacity={0.2} />
    <Rect x="48" y="44" width="24" height="20" rx="3" fill={accent} opacity={0.6} />
    <Rect x="76" y="44" width="24" height="20" rx="3" fill={NAVY} opacity={0.3} />
    {/* Divider */}
    <Path d="M60 20 L60 64" stroke={accent} strokeWidth="1.5" opacity={0.4} />
    {/* Stand */}
    <Rect x="48" y="82" width="24" height="6" rx="3" fill="#FFFFFF" opacity={0.6} />
    <Rect x="34" y="88" width="52" height="6" rx="3" fill="#FFFFFF" opacity={0.8} />
    {/* Tap-to-pay symbol */}
    <Path d="M76 96 Q82 96 82 102 Q82 108 76 108" stroke={GREEN} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <Path d="M80 96 Q90 96 90 102 Q90 108 80 108" stroke={GREEN} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <Circle cx="72" cy="102" r="3" fill={GREEN} />
  </Svg>
);

const InsightsIllustration: React.FC<{ accent: string }> = ({ accent }) => (
  <Svg width={120} height={120} viewBox="0 0 120 120">
    {/* Chart card */}
    <Rect x="10" y="18" width="100" height="76" rx="8" fill="#FFFFFF" opacity={0.95} />
    {/* Bar chart */}
    <Rect x="24" y="56" width="14" height="28" rx="3" fill={NAVY} opacity={0.3} />
    <Rect x="42" y="44" width="14" height="40" rx="3" fill={accent} opacity={0.7} />
    <Rect x="60" y="36" width="14" height="48" rx="3" fill={accent} />
    <Rect x="78" y="26" width="14" height="58" rx="3" fill={GREEN} />
    {/* Trend line */}
    <Path d="M31 60 L49 48 L67 38 L85 28" stroke={accent} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="31" cy="60" r="3.5" fill={accent} />
    <Circle cx="49" cy="48" r="3.5" fill={accent} />
    <Circle cx="67" cy="38" r="3.5" fill={accent} />
    <Circle cx="85" cy="28" r="4.5" fill={GREEN} />
    {/* Revenue badge */}
    <Rect x="16" y="20" width="52" height="16" rx="4" fill={NAVY} opacity={0.1} />
    <Rect x="20" y="24" width="8" height="8" rx="2" fill={accent} />
    <Rect x="32" y="26" width="28" height="4" rx="2" fill={NAVY} opacity={0.25} />
  </Svg>
);

const ILLUSTRATION_MAP: Record<string, React.FC<{ accent: string }>> = {
  'store': StoreIllustration,
  'boxes': BoxesIllustration,
  'zap': PosIllustration,
  'trending-up': InsightsIllustration,
};

// ─── Constants ───────────────────────────────────────────────────────────────
const CARD_HEIGHT = SCREEN_HEIGHT * 0.52;

export default function OnboardingScreen() {
  const router = useRouter();
  const currentStep      = useOnboardingStore(state => state.currentStep);
  const completeOnboarding = useOnboardingStore(state => state.completeOnboarding);
  const nextStep         = useOnboardingStore(state => state.nextStep);
  const previousStep     = useOnboardingStore(state => state.previousStep);
  const setStep          = useOnboardingStore(state => state.setStep);
  const isFirstStep      = useOnboardingStore(state => state.currentStep === 0);
  const isLastStep       = useOnboardingStore(
    state => state.currentStep === state.totalSteps - 1,
  );

  const [displayStep, setDisplayStep] = useState(currentStep);

  const fadeAnim      = useRef(new Animated.Value(1)).current;
  const slideAnim     = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;

  const step       = ONBOARDING_STEPS[displayStep] ?? ONBOARDING_STEPS[0]!;
  const slideConfig = SLIDE_CONFIGS[displayStep] ?? FALLBACK_CONFIG;
  const IllustrationComponent = ILLUSTRATION_MAP[step.icon] ?? StoreIllustration;

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
    <View style={[styles.container, { backgroundColor: slideConfig.background }]}>
      <StatusBar style="light" />

      {/* Ambient blobs */}
      <View style={[styles.blob1, { backgroundColor: slideConfig.blob1 }]} />
      <View style={[styles.blob2, { backgroundColor: slideConfig.blob2 }]} />
      <View style={[styles.blob3, { backgroundColor: slideConfig.blob1 }]} />

      {/* Brand stripe at very top */}
      <View style={styles.brandStripe}>
        <View style={[styles.stripeSegment, { backgroundColor: NAVY }]} />
        <View style={[styles.stripeSegment, { backgroundColor: AMBER }]} />
        <View style={[styles.stripeSegment, { backgroundColor: GREEN }]} />
      </View>

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Brand name */}
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeSme}>SME</Text>
            <Text style={styles.brandBadgePanindio}>Panindio</Text>
          </View>

          <View style={styles.headerRight}>
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
        </View>
      </SafeAreaView>

      {/* Illustration area */}
      <View style={styles.illustrationSection}>
        <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
          <View style={styles.illustrationRing}>
            <View style={[styles.illustrationCircle, { borderColor: slideConfig.accent + '55' }]}>
              <IllustrationComponent accent={slideConfig.accent} />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Content card */}
      <View style={styles.card}>
        {/* Accent bar */}
        <View
          style={[
            styles.accentBar,
            { backgroundColor: slideConfig.buttonColor },
          ]}
        />

        {/* Animated text */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </Animated.View>

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
                    ? [styles.dotActive, { backgroundColor: slideConfig.buttonColor }]
                    : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigation */}
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
            style={[styles.nextButton, { backgroundColor: slideConfig.buttonColor }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.nextText,
                {
                  color:
                    slideConfig.buttonColor === AMBER || slideConfig.buttonColor === GREEN
                      ? '#FFFFFF'
                      : '#FFFFFF',
                },
              ]}
            >
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

  // Brand top stripe (3 px)
  brandStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    flexDirection: 'row',
    zIndex: 100,
  },
  stripeSegment: {
    flex: 1,
  },

  // Blobs
  blob1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -100,
    right: -70,
  },
  blob2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 50,
    left: -60,
  },
  blob3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: SCREEN_HEIGHT * 0.24,
    right: -40,
  },

  // Header
  headerSafeArea: {
    position: 'absolute',
    top: 3, // below stripe
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
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandBadgeSme: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandBadgePanindio: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },

  // Illustration
  illustrationSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 88,
    paddingBottom: theme.spacing.lg,
  },
  illustrationRing: {
    width: Math.min(SCREEN_WIDTH * 0.52, 210),
    height: Math.min(SCREEN_WIDTH * 0.52, 210),
    borderRadius: Math.min(SCREEN_WIDTH * 0.26, 105),
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationCircle: {
    width: Math.min(SCREEN_WIDTH * 0.38, 156),
    height: Math.min(SCREEN_WIDTH * 0.38, 156),
    borderRadius: Math.min(SCREEN_WIDTH * 0.19, 78),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },

  // Card
  card: {
    height: CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 0,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    overflow: 'hidden',
  },
  accentBar: {
    height: 4,
    width: 52,
    borderRadius: 2,
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    lineHeight: 26,
  },

  // Dots
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

  // Navigation
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
