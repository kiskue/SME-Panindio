import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

/**
 * Which experience is currently on screen. Theming resolves PER CONTEXT so the
 * customer (Suki) side and the business side keep independent light/dark
 * preferences. Auth screens are intentionally un-themed (always light/brand).
 */
export type ThemeContextId = 'business' | 'customer' | 'auth';

export interface ThemeState {
  /** Business-side light/dark preference (persisted). */
  businessMode: ThemeMode;
  /** Customer-side light/dark preference (persisted). */
  customerMode: ThemeMode;
  /** Which context is mounted right now (runtime only — never persisted). */
  activeContext: ThemeContextId;

  /** Set the active context — called by each route group's layout on mount. */
  setActiveContext: (ctx: ThemeContextId) => void;
  /** Toggle the ACTIVE context's mode. No-op while in auth. */
  toggleMode: () => void;
  /** Set the ACTIVE context's mode explicitly. No-op while in auth. */
  setMode: (mode: ThemeMode) => void;
}

const flip = (m: ThemeMode): ThemeMode => (m === 'light' ? 'dark' : 'light');

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      businessMode:  'light',
      customerMode:  'light',
      activeContext: 'auth',

      setActiveContext: (ctx) => set({ activeContext: ctx }),

      // Both mutators act on whichever context is mounted, so every existing
      // caller (drawer toggle, settings toggle, ThemeToggle atom) keeps working
      // unchanged and automatically targets the right side.
      toggleMode: () =>
        set((s) => {
          if (s.activeContext === 'customer') return { customerMode: flip(s.customerMode) };
          if (s.activeContext === 'business') return { businessMode: flip(s.businessMode) };
          return {}; // auth — no-op
        }),

      setMode: (mode) =>
        set((s) => {
          if (s.activeContext === 'customer') return { customerMode: mode };
          if (s.activeContext === 'business') return { businessMode: mode };
          return {}; // auth — no-op
        }),
    }),
    {
      name:    'sme-theme-mode',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the two preferences; activeContext is ephemeral.
      partialize: (state) => ({
        businessMode: state.businessMode,
        customerMode: state.customerMode,
      }),
      // v0 stored a single `{ mode }`. Seed BOTH contexts with it so no user
      // loses their preference; the two then diverge independently.
      migrate: (persisted, version): ThemeState => {
        if (
          version === 0 &&
          persisted &&
          typeof persisted === 'object' &&
          'mode' in persisted
        ) {
          const old = (persisted as { mode?: ThemeMode }).mode ?? 'light';
          return { businessMode: old, customerMode: old } as ThemeState;
        }
        return persisted as ThemeState;
      },
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

/** Resolve the active context's mode. Auth always resolves to light. */
export const selectResolvedMode = (s: ThemeState): ThemeMode =>
  s.activeContext === 'auth'
    ? 'light'
    : s.activeContext === 'customer'
      ? s.customerMode
      : s.businessMode;

/**
 * Back-compat alias. Existing imports of `selectThemeMode` keep resolving the
 * currently-active context's mode (it is no longer a single global field).
 */
export const selectThemeMode = selectResolvedMode;

export const selectBusinessMode  = (s: ThemeState): ThemeMode      => s.businessMode;
export const selectCustomerMode  = (s: ThemeState): ThemeMode      => s.customerMode;
export const selectActiveContext = (s: ThemeState): ThemeContextId => s.activeContext;
