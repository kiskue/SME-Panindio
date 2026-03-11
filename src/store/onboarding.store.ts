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
    title: 'Welcome to SME Panindio',
    description: 'Your all-in-one business command centre — manage inventory, run your POS, track sales, and grow your store from a single powerful app.',
    icon: 'store',
  },
  {
    id: 'inventory',
    title: 'Smart Inventory Control',
    description: 'Monitor stock levels in real time. Get instant low-stock alerts, manage suppliers, and never run out of your best-selling products.',
    icon: 'boxes',
  },
  {
    id: 'pos',
    title: 'Lightning-Fast POS',
    description: 'Ring up sales in seconds. Our tablet-optimised point-of-sale keeps your checkout queue moving and your customers smiling.',
    icon: 'zap',
  },
  {
    id: 'insights',
    title: 'Insights That Drive Growth',
    description: 'Beautiful reports, daily revenue summaries, and trend analytics — everything you need to make smarter business decisions every day.',
    icon: 'trending-up',
  },
];
  