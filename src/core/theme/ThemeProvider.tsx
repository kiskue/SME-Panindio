/**
 * ThemeProvider
 *
 * Reads the persisted mode from useThemeStore, resolves the correct theme
 * object, and provides it via ThemeContext so every component that calls
 * useAppTheme() gets the live, reactive theme.
 *
 * Also applies the theme background color to the root View so the very
 * first paint already matches the selected mode.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemeContext, getTheme } from './index';
import { useThemeStore, selectThemeMode } from '@/store/theme.store';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const mode = useThemeStore(selectThemeMode);
  const resolvedTheme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={resolvedTheme}>
      <View
        style={[
          styles.root,
          { backgroundColor: resolvedTheme.colors.background },
        ]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
