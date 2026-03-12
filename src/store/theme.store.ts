/**
 * Theme Store
 *
 * Persists the user's preferred color scheme ('light' | 'dark') across
 * app restarts via AsyncStorage. The resolved theme object is provided
 * by ThemeProvider — this store only owns the raw mode preference.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;

  // Actions
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',

      toggleMode: () => {
        set({ mode: get().mode === 'light' ? 'dark' : 'light' });
      },

      setMode: (mode: ThemeMode) => {
        set({ mode });
      },
    }),
    {
      name: 'theme-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ── Selectors ──────────────────────────────────────────────────────────────
export const selectThemeMode = (state: ThemeState): ThemeMode => state.mode;
