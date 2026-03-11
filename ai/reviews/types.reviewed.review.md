# types.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Type Definitions
**Responsibility:** Provides shared TypeScript interfaces and types used across components, stores, services, and screens.
**System Fit:** The type system is the contract enforcement layer. Weak or incorrect types propagate silent bugs across every module that consumes them.

---

## STRENGTHS

- **`ApiResponse<T>` is generic.** Correctly parameterized for reuse across different response shapes.
- **`PaginatedResponse<T>` and `PaginationMeta` are well-modeled.** Standard pagination envelope is defined, even if unused currently. These are the right shapes for scaling to real API integration.
- **`AsyncState<T>` with `Status` union.** `'idle' | 'loading' | 'success' | 'error'` is a clean finite state machine for async operations — better than using bare `isLoading: boolean` everywhere.
- **`AppRoute` as a string literal union.** Constraining route strings to known values enables compile-time route safety instead of stringly-typed navigation calls.

---

## ISSUES FOUND

### BUGS

**1. `ThemeColors` interface is incomplete — 4 properties missing**
`types/index.ts:60-71`:
```ts
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  error: string;
  success: string;
  warning: string;
  info: string;
}
```
The actual `theme.colors` object has 14 keys. `ThemeColors` only defines 10. Missing: `border`, `disabled`, `placeholder`. When cast `as ThemeColors`, TypeScript silently drops the extra keys from type awareness. Code accessing `theme.colors.border` has no type safety because the interface doesn't include it.

**2. `User` type has no `role` field but `profile.tsx` accesses `user?.role`**
`profile.tsx:104` accesses `user?.role` which resolves to `undefined` always. The `role` property is not in the `User` interface. TypeScript strict mode should flag this, but may not if `user` is typed as `User | null` and optional chaining silences the error.

**Fix:** Add role to User:
```ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'user' | 'viewer'; // or whatever the app's RBAC model requires
}
```

**3. `ButtonProps` size type is inconsistent with `Button.tsx` component**
`types/index.ts:94`:
```ts
size?: 'small' | 'medium' | 'large';
```
`Button.tsx:10`:
```ts
size?: 'sm' | 'md' | 'lg';
```
Two different size vocabularies for the same component. If a consumer imports `ButtonProps` from types and passes `size="small"`, the Button component will not match it to any case in its `getSizeStyles()` switch and fall through to the default. No TypeScript error is raised because the component defines its own local interface.

**4. `ComponentProps.style` is typed as `any`**
`types/index.ts:74`:
```ts
export interface ComponentProps {
  className?: string;
  style?: any;
  testID?: string;
}
```
`style?: any` removes all type checking on the style prop. Every component extending `ComponentProps` can receive any value for `style` without compile-time validation. The correct type is `StyleProp<ViewStyle>` from `react-native`.

**Fix:**
```ts
import { StyleProp, ViewStyle } from 'react-native';
export interface ComponentProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  // Remove className — this is React Native, not React DOM
}
```

**5. `className` in `ComponentProps` is a React DOM concept — invalid in React Native**
`ComponentProps.className` is unused in React Native. No RN component accepts `className`. This is dead surface area that misleads developers coming from React web.

**6. `FormFieldProps` is defined but unused — replaced by react-hook-form Controller integration**
`types/index.ts:79-89`: `FormFieldProps` defines `value`, `onChangeText`, and other controlled input props. But `FormField.tsx` uses `UseControllerProps` from `react-hook-form` — not `FormFieldProps`. This type is orphaned and misleads developers about how the form system works.

**7. `AppRoute` paths are inconsistent with actual Expo Router file structure**
```ts
type AppRoute =
  | '/app/(tabs)/home'       // actual file: src/app/(app)/(tabs)/index.tsx
  | '/app/(tabs)/profile'    // actual file: src/app/(app)/(tabs)/profile.tsx
  | '/app/(tabs)/notifications';  // actual file: src/app/(app)/(tabs)/notifications.tsx
```
The route group in the filesystem is `(app)`, not `app`. And the home tab is `index.tsx`, not `home.tsx`. These route strings may not resolve to valid Expo Router destinations.

### CODE SMELLS

**8. Domain types, UI types, and API types all in one file**
`User`, `Notification` (domain), `ButtonProps`, `CardProps` (UI), `ApiResponse`, `PaginationMeta` (API/data) are all exported from `types/index.ts`. This creates an artificially wide import surface. Any module needing `User` imports from the same file as `ButtonProps`, creating implicit coupling between the auth domain and the UI layer.

**9. `Notification.data` typed as `Record<string, any>`**
```ts
data?: Record<string, any>;
```
`any` in the type hierarchy cascades into unsafe access patterns wherever notification data is destructured. Use a discriminated union based on `NotificationType`:
```ts
type NotificationData =
  | { type: 'CHAT_MESSAGE'; chatId: string; senderId: string }
  | { type: 'ALERT'; alertId: string; severity: 'low' | 'high' }
  | { type: 'INFO'; infoId: string }
  | { type: 'WARNING'; warningId: string };
```

**10. `Notification.createdAt` typed as `Date` but stored in AsyncStorage as string**
`Notification.createdAt: Date` — but when persisted through Zustand to AsyncStorage (JSON serialization), `Date` objects become strings. On deserialization, `createdAt` is a string `"2026-02-20T..."`, not a `Date`. Code doing `new Date(notification.createdAt)` works, but `notification.createdAt instanceof Date` returns `false` for persisted notifications.

**Fix:** Type as `string` (ISO 8601) and parse to `Date` when needed:
```ts
createdAt: string; // ISO 8601, e.g. "2026-02-20T10:00:00Z"
// Usage: new Date(notification.createdAt)
```

---

## ANTI-PATTERNS IDENTIFIED

- **God type barrel** — all types in one file, no domain organization.
- **`style?: any`** — negates type safety on the most-used prop in the component system.
- **Duplicate size vocabulary** — `'sm'|'md'|'lg'` vs `'small'|'medium'|'large'` for the same component.
- **`className` in a React Native type** — web concept leaked into native codebase.
- **`Date` in persisted type** — serialization mismatch between declared type and runtime value.
- **`any` in `NotificationData`** — removes safety throughout the notification handling path.

---

## BEST-PRACTICE RECOMMENDATIONS

**Organize types by domain:**
```
src/types/
  auth.types.ts        ← User, AuthResponse, LoginCredentials, ApiError
  notification.types.ts ← Notification, NotificationType, NotificationData
  api.types.ts         ← ApiResponse<T>, PaginatedResponse<T>, PaginationMeta, AsyncState<T>
  ui.types.ts          ← ComponentProps, Status
  navigation.types.ts  ← AppRoute, NavigationItem
```

**Fix `ComponentProps`:**
```ts
import { StyleProp, ViewStyle } from 'react-native';
export interface ComponentProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
```

**Fix `Notification.createdAt`:**
```ts
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: NotificationData;
  isRead: boolean;
  createdAt: string; // ISO 8601
}
```

**Unify `ButtonProps.size`:**
```ts
// Either in types/ui.types.ts:
type ComponentSize = 'sm' | 'md' | 'lg';
// And use consistently everywhere
```

**Strongly type `NotificationData`:**
```ts
export type NotificationData =
  | { type: 'CHAT_MESSAGE'; chatId: string }
  | { type: 'ALERT'; severity: string }
  | { type: 'INFO' }
  | { type: 'WARNING'; message: string };
```

---

## SUGGESTED REFACTOR PLAN

1. **Split `types/index.ts`** into domain-specific files (`auth.types.ts`, `notification.types.ts`, etc.).
2. **Fix `ComponentProps.style`** — change `any` to `StyleProp<ViewStyle>`.
3. **Remove `className`** from `ComponentProps`.
4. **Add `role` to `User`** — unblocks profile screen rendering and enables RBAC.
5. **Align `ButtonProps.size`** with the actual Button component's size strings (`sm/md/lg`).
6. **Change `Notification.createdAt`** from `Date` to `string` (ISO 8601).
7. **Replace `Record<string, any>` in `Notification.data`** with a discriminated union.
8. **Fix `AppRoute` paths** to match actual Expo Router file structure.
9. **Delete orphaned `FormFieldProps`** — it is not used by the actual `FormField` component.
10. **Update `ThemeColors`** to include all 14 theme color keys.
