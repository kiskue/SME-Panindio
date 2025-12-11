import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingState {
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  
  // Actions
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  nextStep: () => void;
  previousStep: () => void;
  setStep: (step: number) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      isCompleted: false,
      currentStep: 0,
      totalSteps: 4, // Default number of onboarding steps

      completeOnboarding: () => {
        set({
          isCompleted: true,
          currentStep: 0,
        });
      },

      resetOnboarding: () => {
        set({
          isCompleted: false,
          currentStep: 0,
        });
      },

      nextStep: () => {
        const { currentStep, totalSteps } = get();
        if (currentStep < totalSteps - 1) {
          set({ currentStep: currentStep + 1 });
        } else {
          // If we're at the last step, complete onboarding
          get().completeOnboarding();
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      setStep: (step: number) => {
        const { totalSteps } = get();
        if (step >= 0 && step < totalSteps) {
          set({ currentStep: step });
        }
      },
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selectors
export const selectOnboarding = (state: OnboardingState) => ({
  isCompleted: state.isCompleted,
  currentStep: state.currentStep,
  totalSteps: state.totalSteps,
});

export const selectOnboardingProgress = (state: OnboardingState) => ({
  currentStep: state.currentStep,
  totalSteps: state.totalSteps,
  progress: (state.currentStep + 1) / state.totalSteps,
  isFirstStep: state.currentStep === 0,
  isLastStep: state.currentStep === state.totalSteps - 1,
});

// Helper functions
export const isOnboardingCompleted = (): boolean => {
  return useOnboardingStore.getState().isCompleted;
};

export const getCurrentStep = (): number => {
  return useOnboardingStore.getState().currentStep;
};

export const getTotalSteps = (): number => {
  return useOnboardingStore.getState().totalSteps;
};

// Onboarding content configuration
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  image?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Our App',
    description: 'Discover amazing features and enhance your mobile experience with our powerful application.',
    icon: 'rocket',
  },
  {
    id: 'features',
    title: 'Powerful Features',
    description: 'Access advanced tools and functionality designed to make your life easier and more productive.',
    icon: 'star',
  },
  {
    id: 'security',
    title: 'Secure & Private',
    description: 'Your data is protected with enterprise-grade security and privacy controls.',
    icon: 'shield',
  },
  {
    id: 'get-started',
    title: 'Get Started',
    description: 'You\'re all set! Let\'s start exploring