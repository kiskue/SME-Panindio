---
name: login-screen
description: Login screen dual-mode UX (customer default / business toggle) patterns and architecture decisions
metadata:
  type: project
---

## Login Screen Dual-Mode Architecture

**File:** `src/app/(auth)/login.tsx`

### Mode system
- `LoginMode = 'customer' | 'business'` — `customer` is the default on mount
- `CustomerLoginContent` is a private function component defined in the same file (not a separate organism) — it embeds the full QR-scan + username/password flow from `CustomerLoginSheet` inline, since `CustomerLoginSheet` was designed as a bottom-sheet child and doesn't work standalone
- `CustomerLoginSheet` at `src/components/organisms/CustomerLoginSheet.tsx` remains unchanged — used in bottom-sheet contexts inside the customer app

### Animated mode toggle
- `toggleAnim: Animated.Value(0)` — 0 = customer, 1 = business
- Sliding pill: `Animated.View` with `left` interpolated `0%→50%`, `width: 48%`
- `contentOpacity: Animated.Value(1)` — fade-out (120ms) → set state → fade-in + spring pill (200ms) in parallel
- Pattern: `Animated.timing(opacity, {toValue: 0}).start(() => { setMode(next); Animated.parallel([spring, fade-in]).start(); })`

### Mode toggle pill floating above the card
- `toggleContainer` has `marginTop: -20` to overlap the navy header bottom — creates a floating card-on-header effect
- `zIndex: 10` required so it renders above the card
- Background: `#FFFFFF` with `elevation: 8` shadow

### Accent bar per mode
- Customer mode: green-heavy (green:3, amber:1, navy:2)
- Business mode: navy-heavy (navy:3, amber:1, green:2)
- Achieved via inline conditional JSX rendering different `accentSegment` children

### CustomerLoginContent specifics
- Props: `isDark: false` (literal type) — auth screen is always light; prefixed `_props` to satisfy noUnusedParameters
- QR frame: `FRAME_SIZE = Math.min(width - 96, 240)` — slightly smaller than the standalone sheet version
- Business search picker: same debounced 300ms pattern as `CustomerLoginSheet`; uses `searchBusinesses` from `useBusinessSearchStore`
- Login button: `backgroundColor: GREEN` (not NAVY) — visually differentiates the customer form from the business form
- Register link at bottom of password form navigates to `/(auth)/customer-register`

### i18n keys added
Both `en.ts` and `tl.ts` had these keys added under `auth.login`:
- `customerMode`, `businessMode` — toggle labels
- `customerSubtitle`, `businessSubtitle`, `customerTitle`, `businessTitle`
- `searchBusiness`, `searchPlaceholder`, `username`, `usernamePlaceholder`, `passwordPlaceholder`
- `loginBtn`, `newCustomer`, `registerHere`, `signingInOverlay`

### What was removed from original login.tsx
- The `customerPortalBtn` pill in the header that navigated to `/(auth)/customer-register` — replaced by the mode toggle + inline form

### LoadingSpinner overlay guard
- Only shown in business mode: `{isLoading && mode === 'business' && <LoadingSpinner ... />}`
- Customer loading state is shown inline via `ActivityIndicator` inside `CustomerLoginContent`
