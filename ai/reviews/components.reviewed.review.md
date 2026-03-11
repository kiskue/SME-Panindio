# components.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** UI Component System (Atomic Design)
**Responsibility:** Provides a reusable, layered component library spanning atoms (`Button`, `Text`, `Input`, `Card`), molecules (`FormField`, `ErrorMessage`, `LoadingSpinner`), and organisms (`LoginForm`, `NotificationItem`).
**System Fit:** Components are the rendering surface of the entire app. Design token misuse here produces invisible or broken UI. Type mismatches at component boundaries produce runtime crashes.

---

## STRENGTHS

- **Atomic design hierarchy properly enforced.** Atoms have no inter-atom dependencies. Molecules compose atoms with logic (Controller + Input). Organisms compose molecules with domain behavior (LoginForm = FormField + Button + yup). The composition chain is sound.
- **`FormField` wraps `react-hook-form`'s `Controller`.** Correct abstraction — this prevents Controller boilerplate from leaking into every screen. Screens work with a single `<FormField control={control} name="field" />`.
- **`Input` forwards all `TextInput` props via `...textInputProps`.** Using `ComponentProps<typeof TextInput>` with `Omit<..., 'style'>` gives consumers full TextInput API surface without breaking component contract.
- **`Button` disables itself when `loading` is true.** `disabled={disabled || loading}` prevents double-submission. Correct.
- **`ErrorMessage` supports 4 semantic variants** (`error`, `warning`, `info`, `success`) with a dismissible option. Versatile molecule with clear single responsibility.
- **`LoadingSpinner` supports `fullScreen` and `overlay` modes.** Two distinct use cases (inline and modal) handled cleanly in one component.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `Button` references non-existent theme color keys**
`Button.tsx:34`: `theme.colors.primary[500]`
`Button.tsx:39`: `theme.colors.gray[500]`
`Button.tsx:90`: `theme.colors.gray[300]`

The `theme.colors` object has flat string values (`primary: '#007AFF'`), not a color scale. `theme.colors.primary[500]` evaluates to the character at string index 500 — `undefined` for a 7-character hex string.

`theme.colors.gray` does not exist at all in the theme. Every `gray[x]` access returns `undefined`.
`theme.colors.white` does not exist in the theme. The white text color on primary buttons returns `undefined`.

**Impact:** The Button component renders with no background color, no border color, and transparent text. Every variant is visually broken.

**2. CRITICAL: `Input` references non-existent theme color keys**
`Input.tsx:41`: `theme.colors.gray[50]` — undefined
`Input.tsx:47`: `theme.colors.error[500]` — `theme.colors.error` is a string `'#FF3B30'`; `[500]` is char at index 500 (undefined)
`Input.tsx:47,52`: `theme.colors.primary[500]` — undefined
`Input.tsx:47,52`: `theme.colors.gray[300]` — undefined
`Input.tsx:96`: `theme.colors.error[500]` — undefined
`Input.tsx:96`: `theme.colors.gray[700]` — undefined (also has a syntax error — mismatched bracket)
`Input.tsx:122,123`: `theme.colors.gray[900]`, `theme.colors.gray[500]` — undefined
`Input.tsx:138`: `theme.colors.gray[400]` — undefined
`Input.tsx:146`: `theme.colors.gray[500]` — undefined
`Input.tsx:156`: `theme.colors.error[500]`, `theme.colors.gray[500]` — undefined

**Impact:** Input component renders with no borders, no focus state, wrong text colors — visually degraded on every render.

**3. CRITICAL: Syntax error in `Input.tsx:96`**
```ts
color: error ? theme.colors.error[500] : theme.colors.gray[700 }]
```
There is a mismatched bracket: `[700 }]` — a `}` inside the array subscript. This is a syntax error that will fail to parse/compile.

**4. CRITICAL: `theme.typography.sizes.base` is undefined in `Button` and `Input`**
`Button.tsx:100` and `Input.tsx:71` reference `theme.typography.sizes.base`. The theme defines `xs, sm, md, lg, xl, xxl, xxxl`. `base` does not exist — resolves to `undefined`. Default case font size is unset.

**5. CRITICAL: `theme.typography.fontFamily` is undefined in `Input`**
`Input.tsx:181`:
```ts
fontFamily: theme.typography.fontFamily,
```
`theme.typography` has no `fontFamily` property. This resolves to `undefined`. React Native's `TextInput` with `fontFamily: undefined` applies the system default — inconsistency if a custom font is ever added.

**6. `Button` imports `ComponentProps` from `'../../../types'` using a relative path**
`Button.tsx:4`:
```ts
import { ComponentProps } from '../../../types';
```
All other source files use `@/types`. This relative path will break if `Button` is moved to a different depth. Inconsistent import style across the codebase.

**7. `Input.tsx:96` — label color references `theme.colors.gray[700]` not a flat key**
Even if the syntax error were fixed, `theme.colors.gray` doesn't exist. The label would render with no color (system default), not the intended medium-gray.

### LOGIC PROBLEMS

**8. `LoginForm` applies both `yupResolver` and inline `rules` — double validation**
`LoginForm.tsx:45-51` uses `yupResolver(loginSchema)`. The same fields also receive `rules` props:
```tsx
rules={{ required: 'Password is required', minLength: { value: 6, ... } }}
```
When a resolver is active, `rules` passed to `Controller` are ignored — the resolver takes full ownership. The inline rules provide false documentation of what validation is actually running. The yup schema says min 6; `VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH` says 8. The schema is wrong.

**9. `Input.tsx` — `minHeight` uses string `'auto'` as a React Native style value**
`Input.tsx:107`:
```ts
minHeight: multiline ? ... : 'auto',
```
React Native `StyleSheet` does not support `'auto'` as a dimension value for `minHeight`. This will produce a style warning on native and may cause layout issues.

**Fix:** Use `undefined` or simply omit the property when not multiline:
```ts
...(multiline ? { minHeight: size === 'sm' ? 80 : size === 'md' ? 100 : 120 } : {})
```

**10. `Button` does not prevent `onPress` when `loading` is true via `Pressable`**
The `Pressable` has `disabled={disabled || loading}` which prevents interaction. However, if the parent passes `onPress` that mutates state, and `loading` becomes `true` mid-press, there's a brief window. This is minor but noted.

### CODE SMELLS

**11. `Button` renders loading spinner without accessibility label**
`Button.tsx:126-128`: `<ActivityIndicator>` has no `accessibilityLabel`. Screen readers will announce nothing during loading state. Add `accessibilityLabel={`Loading ${title}`}`.

**12. `Input` password visibility toggle uses emoji as icons**
`Input.tsx:147-149`:
```ts
{isPasswordVisible ? '👁️' : '👁️‍🗨️'}
```
Emoji are rendered differently across platforms and OS versions. Use a proper icon library (`lucide-react-native` is already in the project dependencies) for consistency and accessibility.

**13. `FormField` has `rules?: any` — loses type safety**
`FormField.tsx` passes a `rules` prop typed as `any` to `Controller`. This discards all type checking on validation rule objects. Use `RegisterOptions` from `react-hook-form`:
```ts
import { RegisterOptions } from 'react-hook-form';
rules?: Omit<RegisterOptions, 'valueAsNumber' | 'valueAsDate' | 'setValueAs'>;
```

**14. `NotificationItem` (not read in detail) — type mismatch between `notification.body` and template**
The `Notification` type in `types/index.ts` uses `body: string` for the message content. The notification screen's `notifications.tsx` checks `n.read` but the type uses `isRead`. Type contract violations between the store type and screen consumption.

---

## ANTI-PATTERNS IDENTIFIED

- **Theme color scale assumed but not implemented.** Every component operates on the assumption of a color scale (e.g., `primary[500]`), but the theme provides flat strings. The entire component system is built on a broken foundation.
- **Relative path imports in atoms.** `Button.tsx` uses `../../../types` instead of `@/types`.
- **`'auto'` as a native style value.** Not a valid React Native dimension.
- **Emoji as icon components.** Platform inconsistency, no accessibility support.
- **Double validation (resolver + rules).** Gives false confidence; actual behavior differs from apparent intent.

---

## BEST-PRACTICE RECOMMENDATIONS

**Migrate to a color scale in theme, or fix all component references:**

Option A — Fix theme to provide a scale (recommended for a design system):
```ts
// theme/colors.ts
export const colors = {
  primary: { 50: '#EBF5FF', 500: '#007AFF', 700: '#005EC2' },
  gray: { 50: '#F9FAFB', 300: '#D1D5DB', 500: '#6B7280', 700: '#374151', 900: '#111827' },
  error: { 500: '#FF3B30' },
  white: '#FFFFFF',
} as const;
```

Option B — Fix components to use flat keys (faster short-term fix):
```ts
// Button.tsx
backgroundColor: theme.colors.primary,  // instead of primary[500]
color: '#FFFFFF',                        // hardcode white until theme has it
```

**Replace emoji toggles with icons:**
```tsx
import { Eye, EyeOff } from 'lucide-react-native';
{isPasswordVisible ? <Eye size={20} color={theme.colors.textSecondary} /> : <EyeOff size={20} />}
```

**Type the `rules` prop properly in `FormField`:**
```ts
import type { RegisterOptions, FieldValues, Path } from 'react-hook-form';
rules?: Omit<RegisterOptions<FieldValues, Path<FieldValues>>, 'valueAsNumber' | 'valueAsDate'>;
```

---

## SUGGESTED REFACTOR PLAN

1. **Fix the syntax error in `Input.tsx:96`** — mismatched bracket causes compile failure.
2. **Resolve the theme color scale mismatch** — either expand the theme or fix all component references.
3. **Replace `sizes.base` with `sizes.md`** in Button and Input.
4. **Add `fontFamily` to theme** or remove the reference from Input.
5. **Fix `minHeight: 'auto'`** in Input — use `undefined` for single-line inputs.
6. **Standardize imports** to use `@/types` path alias everywhere.
7. **Replace emoji password toggle** with `lucide-react-native` icons.
8. **Type `rules` prop** in `FormField` with `RegisterOptions`.
9. **Remove duplicate inline `rules`** from `LoginForm` — rely on yup schema exclusively.
10. **Add accessibility labels** to `ActivityIndicator` in `Button`.
