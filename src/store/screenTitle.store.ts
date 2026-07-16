import { create } from 'zustand';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Screen-title override for the shared drawer header.
 *
 * The business Drawer renders ONE header (`TopNavBar` via `CustomHeader` in
 * `(app)/(tabs)/_layout.tsx`) whose title is derived from the pathname. Detail
 * screens whose title isn't derivable from the path — e.g. "Order #123" or a
 * customer's name — set a transient override here on focus; `CustomHeader` reads
 * it and prefers it over the static route title. Cleared on blur so it never
 * leaks to the next screen.
 */
export interface ScreenTitleState {
  /** Active title override, or null when the pathname title should be used. */
  title: string | null;
  setTitle: (title: string | null) => void;
  clear: () => void;
}

export const useScreenTitleStore = create<ScreenTitleState>((set) => ({
  title: null,
  setTitle: (title) => set({ title }),
  clear: () => set({ title: null }),
}));

export const selectScreenTitle = (s: ScreenTitleState): string | null => s.title;

/**
 * Set a dynamic header title for the focused screen. Pass the resolved title
 * (e.g. `Order #${n}`); a falsy value clears the override so the pathname title
 * shows instead. The override is automatically cleared when the screen blurs.
 */
export function useScreenTitle(title: string | null | undefined): void {
  useFocusEffect(
    useCallback(() => {
      useScreenTitleStore.getState().setTitle(title && title.trim() ? title : null);
      return () => useScreenTitleStore.getState().clear();
    }, [title]),
  );
}
