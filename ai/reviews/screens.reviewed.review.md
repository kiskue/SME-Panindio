# screens.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Screens / Pages
**Responsibility:** Renders the visual surfaces of the application — onboarding flow, authentication, home dashboard, notifications list, and user profile. Screens coordinate UI rendering with store state.
**System Fit:** Screens are the consumer-facing integration layer. They compose components, invoke store actions, and respond to navigation. Bugs here are directly user-visible.
**Files reviewed:** `onboarding.tsx`, `(auth)/login.tsx`, `(app)/(tabs)/index.tsx`, `(app)/(tabs)/notifications.tsx`, `(app)/(tabs)/profile.tsx`

---

## STRENGTHS

- **`profile.tsx` correctly handles the logout flow.** Disabling the logout button via `isLoggingOut` state, catching errors with `Alert.alert`, and allowing route guards to handle navigation afterward is the correct pattern.
- **`notifications.tsx` groups notifications by date using `useMemo`.** The grouping computation is memoized on `notifications` dependency — correct use of `useMemo` to avoid re-computing on every render cycle.
- **`login.tsx` uses `KeyboardAvoidingView` with platform-specific `behavior`.** Avoiding the keyboard on iOS with `behavior="padding"` and Android via no-op is correct.
- **`onboarding.tsx` uses `FlatList` with `scrollEnabled={false}` + programmatic scrolling.** This is a valid pattern for implementing a step-based onboarding carousel with manual control.
- **`profile.tsx` does not hardcode menu action implementations.** Menu items are data-driven with `onPress` callbacks — ready for real navigation to be wired in.
- **`login.tsx` separates demo login from normal login.** The `onDemoPress` callback fills credentials separately from `handleSubmit`, keeping the primary flow clean.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `notifications.tsx` imports non-existent store methods**
`notifications.tsx:13`:
```ts
const { notifications, markAsRead, clearAll, refreshNotifications } = useNotificationStore();
```
The `useNotificationStore` API is:
- `clearNotifications()` — not `clearAll()`
- `loadNotifications()` — not `refreshNotifications()`

Both `clearAll` and `refreshNotifications` are `undefined`. Calling them throws `TypeError: clearAll is not a function` when the user taps "Clear All", and `TypeError: refreshNotifications is not a function` on mount (via `useEffect`) and on pull-to-refresh.

**Impact:** The Notifications screen crashes on mount. This is a startup crash for any user on the notifications tab.

**2. CRITICAL: `notifications.tsx` checks `n.read` instead of `n.isRead`**
`notifications.tsx:17`:
```ts
const unreadCount = notifications.filter(n => !n.read).length;
```
The `Notification` type has `isRead: boolean`. `n.read` is `undefined` for every notification. `!undefined` is `true`. The unread count equals the total notification count — the badge always shows all notifications as unread.

**3. CRITICAL: `profile.tsx` imports `selectCurrentUser` which does not exist**
`profile.tsx:5`:
```ts
import { useAuthStore, selectCurrentUser } from '@/store';
```
`selectCurrentUser` is not exported from `auth.store.ts` or `store/index.ts`. This is `undefined`. Calling `useAuthStore(undefined)` may return the full store state object rather than the user, or throw in strict mode. The entire profile screen may render incorrectly or crash.

**4. `notifications.tsx` `useEffect` has missing dependency array entry**
`notifications.tsx:19-22`:
```ts
useEffect(() => {
  refreshNotifications(); // undefined — already crashes
}, []); // missing refreshNotifications dependency
```
Even if `refreshNotifications` existed, ESLint `react-hooks/exhaustive-deps` would flag the empty dependency array as incorrect since `refreshNotifications` is a function referenced inside.

**5. `handleDismissNotification` does nothing — silently swallows user action**
`notifications.tsx:46-49`:
```ts
const handleDismissNotification = (notification: any) => {
  console.log('Dismissing notification:', notification.id);
};
```
Swiping to dismiss a notification logs to console but does not call `deleteNotification()` from the store. The notification remains in the list. User action has no visible effect.

**Risk:** Confusing UX — dismiss gesture appears broken.

**Fix:**
```ts
const { deleteNotification } = useNotificationStore();
const handleDismissNotification = (notification: Notification) => {
  deleteNotification(notification.id);
};
```

### LOGIC PROBLEMS

**6. `onboarding.tsx` — `totalSteps` hardcoded in store but `ONBOARDING_STEPS.length` is the source of truth**
The onboarding store hardcodes `totalSteps: 4`. `ONBOARDING_STEPS` has 4 items. If a developer adds or removes steps from `ONBOARDING_STEPS`, `totalSteps` remains 4. The navigation breaks silently (last step triggers completion without the step being shown, or ghost steps appear).

**Fix:** Derive `totalSteps` from the array length:
```ts
totalSteps: ONBOARDING_STEPS.length, // initialized from the actual source
```
Or compute dynamically:
```ts
const totalSteps = ONBOARDING_STEPS.length;
```

**7. `profile.tsx` menu items use array index as `key`**
`profile.tsx:116`:
```ts
{menuItems.map((item, index) => (
  <Card key={index} ...>
```
Array index keys are unstable — if items are reordered, React cannot reconcile components correctly. Use a stable identifier:
```ts
{menuItems.map((item) => (
  <Card key={item.title} ...>
```
Or add an `id` field to the menu item objects.

**8. `profile.tsx` accesses `user?.role` but `User` type has no `role` field**
`profile.tsx:104`:
```ts
<Text variant="body-sm" weight="medium">{user?.role || 'User'}</Text>
```
The `User` interface in `types/index.ts` is: `{ id, email, name, avatar? }`. No `role` property. `user?.role` is always `undefined`, always showing `'User'`. TypeScript strict mode should flag this as `Property 'role' does not exist on type 'User'`.

**Fix:** Add `role` to the `User` interface, or remove the role display from the profile until roles are modeled.

**9. `notifications.tsx` — `ScrollView` with `.map()` for all notifications — no virtualization**
All notifications are rendered unconditionally via `ScrollView + map`. For users with many notifications (capped at 100 in the store), this renders 100 `NotificationItem` components simultaneously. No virtualization means 100+ layout calculations on mount.

**Fix:** Replace with `FlatList`:
```tsx
<FlatList
  data={Object.entries(groupedNotifications).flatMap(([group, items]) => [
    { type: 'header', title: group },
    ...items.map(n => ({ type: 'item', notification: n }))
  ])}
  keyExtractor={(item) => item.type === 'header' ? item.title : item.notification.id}
  renderItem={({ item }) => item.type === 'header'
    ? <GroupHeader title={item.title} />
    : <NotificationItem notification={item.notification} />
  }
/>
```

**10. `login.tsx` — no error clearing on navigation away and back**
If login fails, the error is set in the store. If the user leaves the login screen and returns, the previous error is still displayed. The error should be cleared on unmount:
```tsx
useEffect(() => () => clearError(), []);
```

### CODE SMELLS

**11. `handleNotificationPress` uses `any` type**
`notifications.tsx:35`:
```ts
const handleNotificationPress = (notification: any) => {
```
The `Notification` type is defined and imported. This should be:
```ts
const handleNotificationPress = (notification: Notification) => {
```

**12. `handleDismissNotification` also uses `any` type** (same file, line 46). Same fix as above.

**13. `profile.tsx` menu items defined inline inside the component**
The `menuItems` array is defined inside `ProfileScreen()` on every render. Since it contains `onPress` callbacks with `console.log`, it creates a new array reference on every render, causing unnecessary re-renders of any memoized child components. Move to module-level constant or `useMemo`.

**14. Hardcoded version strings in `profile.tsx`**
`profile.tsx:158-160`:
```tsx
Enterprise Expo RN Boilerplate v1.0.0
Expo SDK 54 • React Native 0.81.5
```
These should read from `Constants.expoConfig?.version`, `Constants.expoConfig?.sdkVersion`, etc. Hardcoded strings will be stale after the first version bump.

**15. `login.tsx` uses `ScrollView` with `contentContainerStyle={styles.scrollContent}`**
The scroll view for the login form may allow scrolling even on large screens where the form fits. Add `bounces={false}` on iOS to prevent elastic scroll when content fits. Better: use `<KeyboardAwareScrollView>` from `react-native-keyboard-aware-scroll-view` or the Expo-compatible equivalent.

---

## ANTI-PATTERNS IDENTIFIED

- **Calling undefined store methods.** `clearAll()` and `refreshNotifications()` do not exist — screens written against a non-existent API.
- **Wrong field name for type check (`n.read` vs `n.isRead`).** Contract mismatch between type and consumer.
- **`any` type in event handlers.** Type safety disabled where it matters most (user interaction).
- **Array index as `key`.** Unstable render identity.
- **`ScrollView + map` for potentially long lists.** Unvirtualized rendering.
- **Hardcoded metadata strings** that diverge from the actual version over time.
- **Menu items recreated on every render.** Missing `useMemo` or module-level extraction.

---

## BEST-PRACTICE RECOMMENDATIONS

**Notifications screen — use typed store destructuring:**
```ts
const {
  notifications,
  markAsRead,
  clearNotifications,    // ← correct name
  loadNotifications,     // ← correct name
  deleteNotification,
} = useNotificationStore();
```

**Add `selectCurrentUser` to fix profile screen:**
```ts
// auth.store.ts
export const selectCurrentUser = (state: AuthState) => state.user;
// then in profile.tsx:
const user = useAuthStore(selectCurrentUser);
```

**Read version from Expo config:**
```ts
import Constants from 'expo-constants';
const appVersion = Constants.expoConfig?.version ?? '1.0.0';
const rnVersion = Constants.expoConfig?.sdkVersion ?? 'Unknown';
```

**Typed notification handlers:**
```ts
import type { Notification } from '@/types';
const handleNotificationPress = (notification: Notification) => { ... };
const handleDismissNotification = (notification: Notification) => {
  deleteNotification(notification.id);
};
```

---

## SUGGESTED REFACTOR PLAN

1. **Fix `notifications.tsx` store method names** (`clearNotifications`, `loadNotifications`) — prevents crash on mount.
2. **Fix `n.read` → `n.isRead`** in unread count computation.
3. **Fix `profile.tsx` selector** — add `selectCurrentUser` export to auth store.
4. **Implement `handleDismissNotification`** to call `deleteNotification()`.
5. **Add `role` field to `User` type** or remove the role display from the profile.
6. **Replace `any` types** with `Notification` in notification handlers.
7. **Fix menu item `key`** from index to `item.title` or add stable IDs.
8. **Replace `ScrollView + map`** with `FlatList` for the notifications list.
9. **Move `menuItems`** to module-level or `useMemo` to avoid per-render recreation.
10. **Clear auth error on `login.tsx` unmount** to prevent stale errors on re-entry.
11. **Replace hardcoded version strings** with values from `Constants.expoConfig`.
12. **Derive `totalSteps`** from `ONBOARDING_STEPS.length` instead of hardcoding 4.
