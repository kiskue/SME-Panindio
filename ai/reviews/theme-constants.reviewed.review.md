# theme-constants.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Core / Design System Foundation
**Responsibility:** Provides the single source of truth for design tokens (colors, spacing, typography, shadows, animations) and application-level constants (API config, validation rules, route names, notification settings).
**System Fit:** Every component, screen, and service depends on these files. Errors here propagate to the entire surface area of the UI and runtime behavior.

---

## STRENGTHS

- **`as const` on the theme object.** Freezes the shape and enables TypeScript to infer literal types for all keys. Correct pattern for design token objects.
- **Exported type aliases from theme.** `Theme`, `Colors`, `Spacing`, `Typography`, etc. are derived from `typeof theme`, ensuring they always stay in sync with the actual implementation.
- **Utility getter functions.** `getSpacing()`, `getBorderRadius()`, `getShadow()` provide type-safe access. These are the right abstraction for consumers needing computed token values.
- **Separation of constants by domain.** `APP_CONSTANTS`, `NAVIGATION_CONSTANTS`, `NOTIFICATION_CONSTANTS`, `ERROR_CONSTANTS`, `VALIDATION_CONSTANTS` are distinct exports. The intent to namespace concerns is correct.
- **Environment variable support for API base URL.** `process.env.EXPO_PUBLIC_API_URL` with fallback is the correct Expo pattern for environment-specific configuration.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `Platform` import is at the bottom of the file after it is used**
`src/core/constants/index.ts:126`:
```ts
import { Platform } from 'react-native'; // line 126
```
But `Platform` is consumed at line 24:
```ts
IS_IOS: Platform.OS === 'ios',
IS_ANDROID: Platform.OS === 'android',
```
JavaScript/TypeScript `import` statements are hoisted, so this does not cause a ReferenceError in a transpiled environment — but it is a critical readability violation and linting error. ESLint's `import/first` rule would flag this. In environments using Babel with unusual configurations, evaluation order can differ. Move the import to line 1.

**Risk:** Misleads maintainers; will fail ESLint `import/first` rule; fragile in non-standard build configs.

**2. CRITICAL: `APP_CONSTANTS` does not contain `VALIDATION_CONSTANTS` as a nested property**
`auth.service.ts:68` accesses:
```ts
APP_CONSTANTS.VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH
```
But in `constants/index.ts`, `VALIDATION_CONSTANTS` is a **top-level export**, not a property of `APP_CONSTANTS`:
```ts
export const APP_CONSTANTS = { ... }; // no VALIDATION_CONSTANTS key
export const VALIDATION_CONSTANTS = { MIN_PASSWORD_LENGTH: 8, ... }; // separate
```
`APP_CONSTANTS.VALIDATION_CONSTANTS` resolves to `undefined`. Accessing `.MIN_PASSWORD_LENGTH` on `undefined` throws at runtime.

**Risk:** The password length validation in `auth.service.ts` silently never runs. Any password of any length passes. This is both a logic bug and a security vulnerability.

**Fix:** Either nest `VALIDATION_CONSTANTS` inside `APP_CONSTANTS` or fix the import in `auth.service.ts`:
```ts
import { APP_CONSTANTS, VALIDATION_CONSTANTS } from '@/core/constants';
// then use: VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH
```

**3. Theme color structure is a flat string map — not a scale**
`theme/index.ts` defines:
```ts
colors: { primary: '#007AFF', ... }
```
But `Button.tsx`, `Input.tsx`, and `profile.tsx` access:
```ts
theme.colors.primary[500]  // undefined
theme.colors.gray[500]     // undefined — 'gray' doesn't exist at all
theme.colors.error[500]    // undefined
theme.colors.white         // undefined — 'white' doesn't exist
theme.colors.gray[50], [300], [400], [700], [900]  // all undefined
```
Accessing index `[500]` on a string gives the character at position 500 (or `undefined` if the string is shorter). This means virtually all color values in Button and Input resolve to `undefined`, causing invisible elements or wrong styles at runtime.

**Risk:** Critical visual regression. Components appear unstyled or invisible. This is a broken design system contract used by every component.

**Fix:** Either adopt a proper color scale (recommended):
```ts
colors: {
  primary: {
    50: '#EBF5FF', 100: '#CCE5FF', 500: '#007AFF', 700: '#0055B3', ...
  },
  gray: {
    50: '#F9FAFB', 300: '#D1D5DB', 500: '#6B7280', 900: '#111827', ...
  },
  white: '#FFFFFF',
  error: { 500: '#FF3B30' },
  ...
}
```
Or fix all component references to use the flat values:
```ts
theme.colors.primary  // instead of theme.colors.primary[500]
theme.colors.error    // instead of theme.colors.error[500]
```

**4. `theme.typography.sizes.base` does not exist**
`Button.tsx:100` and `Input.tsx:71` reference `theme.typography.sizes.base`. The theme defines `xs, sm, md, lg, xl, xxl, xxxl`. `base` is undefined — font size resolves to `undefined`, meaning no font size is applied in the default case.

**Fix:** Change `sizes.base` to `sizes.md` (16px) in all component references.

**5. `theme.typography.fontFamily` does not exist**
`Input.tsx:181`:
```ts
fontFamily: theme.typography.fontFamily,
```
The `typography` object has `sizes`, `weights`, and `lineHeights`. No `fontFamily`. This resolves to `undefined`, applying no font family to the input — may cause visual inconsistency with system fonts.

**Fix:** Add `fontFamily` to the theme typography definition, or remove the reference.

### CODE SMELLS

**6. `ThemeColors` interface in `types/index.ts` is incomplete**
`ThemeColors` defines only 10 color properties but the actual `theme.colors` object has 14 (missing: `border`, `disabled`, `placeholder`, `info`). The cast `as ThemeColors` silently loses type safety for those 4 tokens.

**7. Animation easing values are strings, not native Animated.Easing references**
```ts
easing: { easeInOut: 'ease-in-out', ... }
```
React Native's `Animated` API uses `Easing` functions, not CSS string values. These strings are web-only. Using `theme.animations.easing.easeInOut` in an Animated interpolation would silently fail on native.

**8. `NOTIFICATION_CONSTANTS` values duplicate `NotificationType` union type**
`NotificationType = 'CHAT_MESSAGE' | 'ALERT' | 'INFO' | 'WARNING'` is defined in `types/index.ts`. The exact same string literals appear in `NOTIFICATION_CONSTANTS`. Two sources of truth — they can diverge silently.

**Fix:** Derive one from the other:
```ts
export const NOTIFICATION_TYPES = ['CHAT_MESSAGE', 'ALERT', 'INFO', 'WARNING'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];
```

---

## ANTI-PATTERNS IDENTIFIED

- **Theme contract broken at definition.** Components reference a color scale (`primary[500]`) that the theme object never promised. The `ThemeColors` interface enabled this by being looser than the implementation.
- **Constants with wrong access paths shipped.** `APP_CONSTANTS.VALIDATION_CONSTANTS` is an impossible path that TypeScript didn't catch because `as const` has no index-access guard without a mapped type.
- **Import at bottom of module.** `import { Platform }` after all usages — structural violation.
- **Parallel string-constant and type-union duplication.** `NotificationType` and `NOTIFICATION_CONSTANTS` values are not linked.

---

## BEST-PRACTICE RECOMMENDATIONS

**Adopt a full color scale for the theme:**
```ts
export const colors = {
  primary: { 50: '...', 100: '...', 500: '#007AFF', 700: '...' },
  gray: { 50: '#F9FAFB', 100: '...', 300: '...', 500: '...', 700: '...', 900: '...' },
  white: '#FFFFFF',
  black: '#000000',
  error: { 500: '#FF3B30' },
  success: { 500: '#34C759' },
} as const;
```

**Add a `fontFamily` token:**
```ts
typography: {
  fontFamily: { regular: 'System', mono: 'Courier' },
  sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 32 },
  ...
}
```

**Fix the VALIDATION_CONSTANTS path:**
```ts
// Option A: nest inside APP_CONSTANTS
export const APP_CONSTANTS = {
  ...
  VALIDATION: { MIN_PASSWORD_LENGTH: 8, MAX_PASSWORD_LENGTH: 128 },
};

// Option B: fix the import in auth.service.ts
import { VALIDATION_CONSTANTS } from '@/core/constants';
```

---

## SUGGESTED REFACTOR PLAN

1. **Fix `Platform` import** — move to top of `constants/index.ts`.
2. **Fix `APP_CONSTANTS.VALIDATION_CONSTANTS` path** — either nest it or fix the consumer.
3. **Migrate theme colors to a proper scale** — update all component references.
4. **Replace `sizes.base`** with `sizes.md` in Button.tsx and Input.tsx.
5. **Add `fontFamily`** to typography or remove the reference from Input.tsx.
6. **Align `ThemeColors` interface** with the actual `theme.colors` shape.
7. **Derive `NotificationType`** from `NOTIFICATION_CONSTANTS` keys (single source of truth).
8. **Replace animation easing strings** with `Easing` from `react-native` for native correctness.
