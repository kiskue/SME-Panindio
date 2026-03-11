/**
 * Storybook Global Preview
 *
 * Registers providers that every story needs so individual story files
 * are not burdened with boilerplate setup code.
 *
 * Provider order (inner → outer):
 *   SafeAreaProvider  — react-native-safe-area-context
 *   GestureHandlerRootView — react-native-gesture-handler
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// ─── Root Providers ───────────────────────────────────────────────────────────

const RootProviders = ({ children }: { children: React.ReactNode }) => (
  <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </GestureHandlerRootView>
);

// ─── Global Decorators ────────────────────────────────────────────────────────

export const decorators = [
  (Story: () => React.ReactElement) => (
    <RootProviders>
      <Story />
    </RootProviders>
  ),
];

// ─── Global Parameters ────────────────────────────────────────────────────────

export const parameters = {
  /**
   * Actions — automatically detect `onXxx` props and wire them to the
   * Actions panel so reviewers can observe event payloads at a glance.
   */
  actions: { argTypesRegex: '^on[A-Z].*' },

  /**
   * Controls — smart matchers give color pickers and date pickers to
   * props whose names hint at their data type.
   */
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date:  /Date$/,
    },
  },

  /**
   * Backgrounds — three canonical surfaces from the design system.
   * Matching the app theme prevents false positives during visual review.
   */
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light',   value: '#FFFFFF' },
      { name: 'surface', value: '#F2F2F7' },
      { name: 'dark',    value: '#1C1C1E' },
    ],
  },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
});
