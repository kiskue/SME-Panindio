import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedLanguage } from '@/i18n';

export interface LanguageState {
  language:    SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language:    'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name:       'sme-language',
      storage:    createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ language: state.language }),
    },
  ),
);

export const selectLanguage = (state: LanguageState): SupportedLanguage => state.language;
