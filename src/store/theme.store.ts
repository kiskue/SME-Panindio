import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode:       ThemeMode;
  toggleMode: () => void;
  setMode:    (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light' as ThemeMode,
      toggleMode: () =>
        set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name:    'sme-theme-mode',                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the mode field — actions are not serialisable
      partialize: (state) => ({ mode: state.mode }),
    },                                                                                  
  ),
);

export const selectThemeMode = (state: ThemeState): ThemeMode => state.mode;
