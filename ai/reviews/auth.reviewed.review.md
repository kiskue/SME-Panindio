# auth.reviewed.review.md
**Status:** reviewed
**Reviewer:** Senior Software Engineer
**Date:** 2026-02-20

---

## MODULE OVERVIEW

**Domain:** Authentication
**Responsibility:** Handles user identity — credential validation, token lifecycle, session persistence, and transition from login to the authenticated app.
**System Fit:** Authentication is the security perimeter of the entire application. Weaknesses here create direct attack surface. The module spans: `features/auth/services/auth.service.ts`, `store/auth.store.ts`, `app/(auth)/login.tsx`, and `components/organisms/LoginForm.tsx`.

---

## STRENGTHS

- **Service class pattern with a singleton export.** `AuthService` class with `export const authService = new AuthService()` is a clean dependency injection pattern that enables future swapping or mocking.
- **Input validation layered at the service level.** `validateLoginCredentials()` independently validates email format and password length before delegating to the mock/API layer. This is the correct placement — validation belongs in the service, not the UI.
- **Token stored in SecureStore.** The intent to use `expo-secure-store` for the token is correct — this is encrypted on-device storage.
- **Login screen uses `KeyboardAvoidingView` with `ScrollView`.** Correct UX pattern for auth forms on iOS — prevents the keyboard from covering inputs.
- **`LoginForm` decoupled from auth state.** The form receives `onSubmit`, `isLoading`, and `error` as props, making it a pure presentation component. The login screen owns the state coordination. Clean container/presentational separation.
- **`yupResolver` with typed schema.** Using `yupResolver(loginSchema)` with a typed `LoginFormData` interface provides compile-time safety on form field names.

---

## ISSUES FOUND

### BUGS

**1. CRITICAL: `APP_CONSTANTS.VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH` is `undefined`**
`auth.service.ts:68`:
```ts
if (credentials.password.length < APP_CONSTANTS.VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH) {
```
`APP_CONSTANTS` does not have a `VALIDATION_CONSTANTS` nested key — `VALIDATION_CONSTANTS` is a separate top-level export. This expression evaluates as:
```ts
credentials.password.length < undefined  // → false always
```
The password length validation **never executes**. Any password — including empty strings that slip past the prior `!credentials.password` check — that is truthy will pass length validation.

**Risk:** A password of length 1 (e.g., `"a"`) would pass service-level validation if it reaches this check. Combined with a real API, this silently allows weak passwords.

**Fix:**
```ts
import { APP_CONSTANTS, VALIDATION_CONSTANTS } from '@/core/constants';
// then:
if (credentials.password.length < VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH) {
```

**2. CRITICAL: Hardcoded credentials with passwords below minimum length**
`auth.service.ts:79-83`:
```ts
const mockUsers = [
  { email: 'user@example.com', password: 'password123', name: 'John Doe' },
  { email: 'demo@app.com', password: 'demo1234', name: 'Demo User' },
  { email: 'test@boilerplate.com', password: 'testpass', name: 'Test User' },
];
```
`testpass` is 8 characters — it matches `MIN_PASSWORD_LENGTH` only exactly. `demo1234` is 8. But the more critical issue: plaintext credentials are **shipped in the app bundle**. Anyone who decompiles the app or reads the source gets valid login credentials.

**Risk:** Credential exposure. In a production build, these mock users allow unauthorized access if the auth layer is ever connected to a real user system without cleanup.

**Fix:**
- Move mock credentials to environment variables (`process.env.EXPO_PUBLIC_DEMO_EMAIL`).
- Ideally, mock auth should be behind a build flag (`__DEV__` check) and stripped from production bundles.
- Remove test credentials from production code.

**3. Token `id` generated with `Math.random().toString(36).substr(2, 9)` — collision-prone**
`auth.service.ts:96`:
```ts
id: Math.random().toString(36).substr(2, 9),
```
`Math.random()` is not cryptographically secure. In a production context where user IDs matter, this is insufficient. Even for a mock, using `Date.now().toString()` avoids the collision risk on fast login attempts.

**4. `refreshToken` mock always returns the same hardcoded user**
`auth.service.ts:113-128`: The `mockRefreshToken` ignores the refresh token input and always returns `user@example.com` / `John Doe`. If the app ever calls `refreshToken` for a `demo@app.com` session, it switches identity silently.

**5. `validateToken` checks if token contains `'mock'` string**
`auth.service.ts:135`:
```ts
return token.length > 10 && token.includes('mock');
```
This is a logic bomb: when a real API token is introduced, all existing tokens in SecureStore will fail validation (they won't contain `'mock'`) and users will be logged out on upgrade. This also means any real token is rejected, making token validation always `false` in a production context.

### LOGIC PROBLEMS

**6. Double validation in `LoginForm` — yup schema AND inline `rules` prop are both active**
`LoginForm.tsx` uses `yupResolver(loginSchema)` which validates on submit. The `loginSchema` sets `min(6)` for password. It also passes `rules` to `FormField`:
```ts
rules={{ required: 'Password is required', minLength: { value: 6, ... } }}
```
When using `yupResolver`, the `rules` prop in `Controller` is redundant — the resolver takes precedence. However, the duplication creates confusion about which rule applies and can lead to divergent error messages.

**Additionally:** The yup schema says min 6 characters. The `VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH` says 8. The `auth.service.ts` also intends 8. Three different validation thresholds for the same field: 6 (yup), 6 (rules), 8 (intended service). A user could set a 7-character password that passes the UI but should fail service validation.

**Fix:** Define one canonical password minimum (`VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH = 8`) and reference it everywhere:
```ts
// loginSchema
password: yup.string().min(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH, `Min ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} chars`)
```

**7. No error clearing on input change**
When the auth store sets an error after a failed login, the error persists in state. The login screen does not call `clearError()` when the user starts typing. The error message stays visible even after the user corrects the credentials and before the next submit.

**Fix:**
```tsx
// login.tsx — pass clearError to FormField onChange handlers or use watch()
```

**8. `initializeAuth` sets token without validating it**
`auth.store.ts:173-184`:
```ts
const token = await SecureStore.getItemAsync(APP_CONSTANTS.TOKEN_KEY);
if (token) {
  useAuthStore.getState().setToken(token);
  // You might want to validate the token here
}
```
The comment acknowledges the gap. The token is set without checking if it's expired or valid. `isAuthenticated` could remain `false` (not set here), but `authToken` is non-null, creating an inconsistent state: token present but not authenticated.

**Fix:**
```ts
if (token) {
  const isValid = await authService.validateToken(token);
  if (isValid) {
    useAuthStore.setState({ authToken: token, isAuthenticated: true });
  } else {
    await SecureStore.deleteItemAsync(APP_CONSTANTS.TOKEN_KEY);
  }
}
```

---

## ANTI-PATTERNS IDENTIFIED

- **Mock implementation leaked into production service.** The `AuthService` class method `mockLogin()` is `private` — good — but called unconditionally from `login()`. There is no production code path.
- **Hardcoded credentials in source code.** Never acceptable even in a boilerplate.
- **Inconsistent validation thresholds across layers.** Yup (6), VALIDATION_CONSTANTS (8), service (8 — currently broken).
- **`validateToken` implementation tied to mock format.** Token validation uses mock-specific string pattern, ensuring it always fails for real tokens.
- **Side-effect in service constructor (notification service does this too).** The `NotificationService` calls `this.initializeNotifications()` in the constructor — `AuthService` avoids this, which is correct.

---

## BEST-PRACTICE RECOMMENDATIONS

**Real auth service structure (when connecting a backend):**
```ts
class AuthService {
  private http: AxiosInstance; // injected or created

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.validateLoginCredentials(credentials);
    const { data } = await this.http.post<AuthResponse>('/auth/login', credentials);
    return data;
  }

  async refreshToken(): Promise<string> {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    const { data } = await this.http.post<{ token: string }>('/auth/refresh', { refreshToken });
    return data.token;
  }
}
```

**Remove mock credentials from production code:**
```ts
// Only in __DEV__:
if (__DEV__) {
  const DEMO_CREDENTIALS = { email: 'demo@app.com', password: 'demo1234' };
}
```

**Single validation source:**
```ts
// constants
export const VALIDATION_CONSTANTS = { MIN_PASSWORD_LENGTH: 8 };

// yup schema — import and reference
const loginSchema = yup.object({
  password: yup.string().min(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH),
});

// service — same import, same constant
```

---

## SUGGESTED REFACTOR PLAN

1. **Fix `VALIDATION_CONSTANTS` import** in `auth.service.ts` — critical correctness bug.
2. **Consolidate password minimum** to `VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH` in yup schema and service.
3. **Gate mock credentials** behind `__DEV__` and move to environment variables.
4. **Remove redundant `rules` prop** from `FormField` in `LoginForm` when `yupResolver` is active.
5. **Add `clearError` on user input** in `login.tsx` to improve UX on retry.
6. **Fix `initializeAuth`** to set `isAuthenticated: true` when a valid token is found.
7. **Implement real token validation** (API call or JWT expiry check) replacing mock string check.
8. **Add retry logic** on 401 responses using the refresh token mechanism (axios interceptor).
