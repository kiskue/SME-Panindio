import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboardingStore, ONBOARDING_STEPS, selectOnboardingProgress } from '@/store';
import { theme } from '@/core/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { currentStep, completeOnboarding, nextStep, previousStep, setStep } = useOnboardingStore();
  const { progress, isFirstStep, isLastStep } = useOnboardingStore(selectOnboardingProgress);

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding();
      router.replace('/auth/login');
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      previousStep();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    router.replace('/auth/login');
  };

  const renderItem = ({ item, index }: { item: typeof ONBOARDING_STEPS[0]; index: number }) => {
    const isActive = index === currentStep;
    
    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {ONBOARDING_STEPS.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.paginationDot,
              index === currentStep && styles.paginationDotActive,
            ]}
            onPress={() => setStep(index)}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Skip button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={ONBOARDING_STEPS}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.flatListContent}
      />

      {/* Pagination */}
      {renderPagination()}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handlePrevious}
          disabled={isFirstStep}
        >
          <Text style={[styles.buttonText, isFirstStep && styles.buttonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  skipButton: {
    padding: theme.spacing.sm,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  flatListContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  icon: {
    fontSize: 48,
    color: theme.colors.primary,
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.xs,
  },
  paginationDotActive: {
    backgroundColor: theme.colors.primary,
    width: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.xs,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    textAlign: 'center',
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
  },
  buttonTextDisabled: {
    color: theme.colors.disabled,
  },
});