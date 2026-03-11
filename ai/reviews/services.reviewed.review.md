# services.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Service Layer (Auth & Notifications)
**Responsibility:** Abstracts external system interactions — authentication APIs and push notification infrastructure — behind clean interfaces consumable by the store layer.
**System Fit:** Services are the boundary between the app's domain logic and the outside world. They should be the only place that handles HTTP, device APIs, and token management. Everything above them (stores, screens) should be ignorant of implementation details.

---

## STRENGTHS

- **Class-based service pattern with singleton export.** `export const authService = new AuthService()` and `export const notificationService = new NotificationService()` create module-level singletons. This is the correct pattern for stateful services without requiring a DI container.
- **Clear method visibility.** `AuthService` separates public API (`login`, `logout`, `refreshToken`, `validateToken`) from private implementation (`mockLogin`, `generateMockToken`, etc.) using `private`. The interface is clean.
- **`validateLoginCredentials` at the service layer.** Input validation belongs in the service, not the UI. Having it as a private method called before the API call is the right architecture for defense-in-depth.
- **`NotificationService.createNotificationChannels()` is idempotent.** Calling `setNotificationChannelAsync` multiple times with the same ID does not duplicate channels on Android — correct behavior.
- **`handleNotificationResponse` is a separate public method.** Notification routing is extracted from the listener registration, making it independently testable. Good separation.
- **Permission re-use in `registerForPushNotifications`.** Calling `requestPermissions()` internally before getting the push token avoids race conditions with direct permission checks.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `initializeNotifications()` called in `NotificationService` constructor — async side effect in constructor**
`notification.service.ts:10-29`:
```ts
constructor() {
  this.initializeNotifications(); // async method, not awaited
}
```
The constructor cannot `await` the async `initializeNotifications()`. The notification handler is set up and permissions are requested as a fire-and-forget. If the module is imported before the device is ready or before permissions can be requested, this silently fails with no error propagation.

**Risk:** Notification initialization failure is swallowed. The app continues without notifications silently. There is also a second initialization path: `notificationService.createNotificationChannels()` is called from `_layout.tsx` — double initialization with no deduplication.

**Fix:** Remove initialization from the constructor. Expose an explicit `initialize()` method called from the app startup orchestration:
```ts
class NotificationService {
  // No constructor initialization
  async initialize(): Promise<void> {
    Notifications.setNotificationHandler({ ... });
    await this.requestPermissions();
    await this.createNotificationChannels();
  }
}
```

**2. CRITICAL: `projectId` is hardcoded placeholder — push tokens will not register**
`notification.service.ts:80`:
```ts
const projectId = 'your-project-id'; // Replace with your Expo project ID
```
`Notifications.getExpoPushTokenAsync({ projectId })` will throw or return an invalid token when `projectId` is not a real Expo project ID. All users on physical devices will fail to register for push notifications.

**Risk:** Push notification delivery is completely broken on physical devices for anyone running this code with the placeholder.

**Fix:**
```ts
const projectId = Constants.expoConfig?.extra?.eas?.projectId
  ?? process.env.EXPO_PUBLIC_PROJECT_ID;
if (!projectId) throw new Error('Expo project ID not configured');
```
And add to `app.json`:
```json
"extra": { "eas": { "projectId": "your-actual-uuid" } }
```

**3. `NotificationService` has its own local `pushToken` state separate from the store**
`notification.service.ts:8`:
```ts
private pushToken: string | null = null;
```
`notification.store.ts` also stores `pushToken`. When `registerForPushNotifications()` runs, it sets `this.pushToken` locally AND the store calls `registerPushToken()` which also stores it. Two sources of truth that can diverge if the service is called without going through the store action.

**Risk:** `notificationService.getPushToken()` and `useNotificationStore().pushToken` can return different values.

**Fix:** Remove the local `pushToken` from the service. The service should be stateless — the store owns the state.

**4. `routeNotification` uses `console.log` instead of actual navigation**
`notification.service.ts:234-246`:
```ts
private routeNotification(type: string, data: Record<string, any>): void {
  switch (type) {
    case NOTIFICATION_CONSTANTS.CHAT_MESSAGE:
      console.log('Routing to chat:', data); // no actual navigation
      break;
  }
}
```
The notification response handler does nothing observable to the user. Tapping a notification has no effect.

**Risk:** Notifications are decorative — they display but never navigate. This breaks user expectations for notification deep-linking.

**Fix:** The service should not own navigation. Extract notification routing to a hook that has access to the Expo Router `useRouter`:
```ts
// hooks/useNotificationRouting.ts
export const useNotificationRouting = () => {
  const router = useRouter();
  return useCallback((response: NotificationResponse) => {
    const { type, route } = response.notification.request.content.data ?? {};
    if (route) router.push(route);
  }, [router]);
};
```

**5. `lightColor: '#FF231F7C'` is an invalid hex color**
`notification.service.ts:47` (permission request):
```ts
lightColor: '#FF231F7C',
```
Also `notification.service.ts:199` (channel creation):
```ts
lightColor: '#FF231F7C',
```
A valid hex color is either 6 or 8 characters (with alpha) preceded by `#`. `#FF231F7C` is 8 characters — technically a valid hex with alpha (`#RRGGBBAA`). However, Android notification LED light colors should use standard 6-char hex. The `7C` alpha suffix may cause the LED to display transparent or be ignored. This appears to be a copy-paste error (it looks like an incomplete hash/ID).

**Fix:** Use a proper 6-character hex: `lightColor: '#FF231F'` (red) or brand primary `'#007AFF'`.

### LOGIC PROBLEMS

**6. `mockRefreshToken` ignores the `refreshToken` input and returns a hardcoded user**
`auth.service.ts:113-128`: The function accepts a `refreshToken: string` but uses it for nothing. It always returns `user@example.com`. If a `demo@app.com` session calls refresh, the user becomes `John Doe`. Silent identity switch.

**7. `scheduleLocalNotification` sets `badge: 1` always, ignoring current badge count**
`notification.service.ts:109`:
```ts
badge: 1,
```
Every scheduled notification resets the badge to 1, regardless of how many unread notifications exist. The badge count should reflect the actual unread count from the store.

**Fix:**
```ts
const currentBadge = await this.getBadgeCountAsync();
badge: currentBadge + 1,
```

**8. `isNotificationsEnabled` is redundant with `requestPermissions`**
Both query `Notifications.getPermissionsAsync()`. `isNotificationsEnabled()` is useful as a read-only check, but it overlaps conceptually with `requestPermissions()`. Having both can lead to callers using the wrong one (requesting when they only intend to check).

**9. `simulator_token_` return value is a fake token but is stored in the store**
`notification.service.ts:70`:
```ts
return 'simulator_token_' + Date.now();
```
This string is then stored in `notification.store.ts` as `pushToken`. Any code that sends notifications using the push token would attempt to deliver to `'simulator_token_1234567890'` — an invalid Expo push token. The store check `hasPushToken()` will return `true` incorrectly for simulator environments.

**Fix:** Return `null` for simulator environments instead of a fake token, and handle `null` in the store gracefully.

### CODE SMELLS

**10. 7 `console.log` statements across `notification.service.ts`**
Logging push token registration success, channel creation, notification scheduling, etc. at `console.log` level. These are operational events that should be logged at `debug` level or removed from production builds. They also leak device information (push tokens) to console logs.

**11. `AuthService.mockLogin` uses `setTimeout` delays that inflate test time**
`auth.service.ts:76`: 1000ms delay. `mockLogout`: 500ms. `mockRefreshToken`: 800ms. `mockValidateToken`: 300ms. Any test that calls these methods will take seconds. When real API calls are substituted, these delays disappear — but until then, the dev and test loop is unnecessarily slow.

**12. `generateMockToken` uses `Math.random()` — not cryptographically secure**
`auth.service.ts:138-141`. Acceptable for a mock, but this function is public (via the token it generates being stored in SecureStore). The pattern should not be carried into production.

---

## ANTI-PATTERNS IDENTIFIED

- **Async side effect in constructor.** Silent failure mode for initialization errors.
- **Service owns mutable state.** `this.pushToken` creates a second, divergent source of truth.
- **Navigation responsibility inside a service.** Services should not know about routing.
- **Hardcoded `projectId` placeholder.** Will break on first physical device test.
- **Mock delays that slow CI/test loops.**
- **Badge count set to constant `1` regardless of actual unread count.**

---

## BEST-PRACTICE RECOMMENDATIONS

**Stateless service design:**
```ts
class NotificationService {
  // No constructor side effects
  // No local state (pushToken)
  async initialize(): Promise<void> { ... }
  async registerForPushNotifications(): Promise<string> { ... }
  // Returns token, does not store it
}
```

**Navigation via event emitter or hook (not service):**
```ts
// The service emits an event:
import { EventEmitter } from 'events';
const notificationEmitter = new EventEmitter();

// The hook subscribes and navigates:
useEffect(() => {
  const handler = ({ route }) => router.push(route);
  notificationEmitter.on('navigate', handler);
  return () => notificationEmitter.off('navigate', handler);
}, [router]);
```

**Real token registration with proper projectId:**
```ts
import Constants from 'expo-constants';
const projectId = Constants.expoConfig?.extra?.eas?.projectId;
if (!projectId) throw new Error('Missing EAS projectId in app.json extra');
const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
```

---

## SUGGESTED REFACTOR PLAN

1. **Remove async initialization from `NotificationService` constructor** — add explicit `initialize()` method.
2. **Fix `projectId` placeholder** — read from `Constants.expoConfig.extra.eas.projectId`.
3. **Remove `this.pushToken`** from the service — the store owns push token state.
4. **Return `null` from `registerForPushNotifications`** on simulator instead of a fake token.
5. **Fix `lightColor`** to a valid 6-char hex in both permission request and channel creation.
6. **Extract notification routing** from the service into a `useNotificationRouting` hook.
7. **Fix badge count** in `scheduleLocalNotification` to use current unread count + 1.
8. **Remove mock delays** or reduce them significantly for faster development feedback.
9. **Gate mock auth** behind `__DEV__` environment check.
10. **Align `mockRefreshToken`** to use the current user's data, not a hardcoded user.
