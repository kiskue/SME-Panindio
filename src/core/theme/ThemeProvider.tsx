/**
 * ThemeProvider
 *
 * Provides ThemeContext / ThemeModeContext for any code that reads from context
 * directly (e.g. third-party components). The public hooks `useAppTheme()` and
 * `useThemeMode()` no longer read from these contexts — they subscribe to the
 * Zustand store directly so that only the calling leaf component re-renders on
 * mode change, never the entire React tree.
 *
 * Why static values here?
 * With the hooks reading from Zustand, ThemeContext changes would only matter
 * to code calling `useContext(ThemeContext)` directly — which nothing in this
 * codebase does. Keeping this provider static means zero reactive subscriptions
 * at the root level, which is what prevents the Fabric viewState crash.
 */

import React from 'react';
import { ThemeContext, ThemeModeContext, theme } from './index';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => (
  <ThemeContext.Provider value={theme}>
    <ThemeModeContext.Provider value="light">
      {children}
    </ThemeModeContext.Provider>
  </ThemeContext.Provider>
);
