/**
 * ThemedStatusBar
 *
 * Renders expo-status-bar's <StatusBar> with its style derived from
 * ThemeContext rather than from a direct Zustand store subscription.
 *
 * This component must be rendered INSIDE ThemeProvider so it participates
 * in the rAF-deferred context update cycle. That guarantee means StatusBar
 * never receives a native prop update while Fabric still has in-flight surface
 * work from a concurrent drawer animation — eliminating the second vector for
 * the "Unable to find viewState for tag X" crash.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from './index';

export const ThemedStatusBar: React.FC = () => {
  const theme = useAppTheme();
  // The dark theme's `text` token is near-white (#F1F5F9), the light theme's
  // is dark navy (#1A3A6B). Comparing against '#F1F5F9' is intentionally
  // fragile; instead we check whether the surface background is dark by
  // looking at the background token's luminance heuristic: a hex starting
  // with '#0' or '#1' is dark enough to need light status bar content.
  const isDark = theme.colors.background.startsWith('#0') || theme.colors.background.startsWith('#1');

  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};
