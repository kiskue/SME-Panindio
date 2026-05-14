# Suki (Loyal Customer) Module — Implementation TODO

> **Blueprint version:** 2026-05-15
> **Author:** Senior RN Engineer / ERP Architect
> **Stack:** Expo SDK 54, React Native 0.81.5, React 19, TypeScript strict, Expo Router v6, Zustand v5, Supabase, SQLite

---

## Reading this file

- Tasks are ordered by dependency — complete phases sequentially.
- Each task is a single atomic unit of work (one PR or one commit set).
- `[SUPABASE]` = cloud-only (Supabase/PostgreSQL).
- `[SQLite]` = local offline database (SQLite via expo-sqlite).
- `[UI]` = component or screen work.
- `[STORE]` = Zustand store work.
- `[LIB]` = third-party library integration.

---

## Phase 0 — Library Installation

> Install all third-party dependencies before any code is written.

- [ ] **[LIB-01]** Install QR code generator: `npx expo install react-native-qrcode-svg react-native-svg`
- [ ] **[LIB-02]** Install camera/QR/barcode scanner: `npx expo install expo-camera` (expo-camera v15 ships with barcode scanning built in for SDK 54; no separate expo-barcode-scanner needed)
- [ ] **[LIB-03]** Install secure random token generation: `npx expo install expo-crypto` (already available in Expo SDK 54)
- [ ] **[LIB-04]** Install image picker + camera capture for selfie/ID: `npx expo install expo-image-picker` (already in most Expo projects; confirm it is in package.json)
- [ ] **[LIB-05]** Install face detection: `npx expo install expo-face-detector` (SDK 54 compatible; note: uses MLKit on Android, Vision on iOS)
- [ ] **[LIB-06]** Install secure storage for customer session token: `npx expo install expo-secure-store` (confirm already present)
- [ ] **[LIB-07]** Install Supabase JS v2 client: already present — confirm `@supabase/supabase-js` version is ^2.39.0+
- [ ] **[LIB-08]** Install ID card OCR: `npx expo install @react-native-ml-kit/text-recognition` — this is the recommended open-source option (Google MLKit TextRecognition, free, offline, works on SDK 54). CAVEAT: adds ~6 MB to binary; requires Expo development build (not Expo Go).
- [ ] **[LIB-09]** Add required permissions to `app.json`:
  - `android.permissions`: `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
  - `ios.infoPlist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSFaceIDUsageDescription`
- [ ] **[LIB-10]** Rebuild the development client after library installs: `eas build --profile development --platform all`

---

## Phase 1 — Supabase Schema & Storage Setup

> All SQL from `SUPABASE_SUKI_SCHEMA.md`. Run in the Supabase SQL editor in order.

- [ ] **[DB-01]** Run Migration 025 — `customers` table (core profile, credentials, verification status, business_owner_id FK)
- [ ] **[DB-02]** Run Migration 026 — `customer_qr_tokens` table (one-time-use tokens with expiry and consumed_at)
- [ ] **[DB-03]** Run Migration 027 — `customer_sessions` table (login audit trail, device fingerprint)
- [ ] **[DB-04]** Run Migration 028 — `customer_id_documents` table (Supabase Storage object references for ID front/back, selfie, liveness frames)
- [ ] **[DB-05]** Run Migration 029 — `online_catalog` table (business-curated subset of inventory products available for customer ordering)
- [ ] **[DB-06]** Run Migration 030 — `online_orders` table (header: customer, business, status, payment_method, total)
- [ ] **[DB-07]** Run Migration 031 — `online_order_items` table (line items: product, qty, unit_price, barcode lookup FK)
- [ ] **[DB-08]** Enable RLS on all new tables (see SUPABASE_SUKI_SCHEMA.md for per-table policies)
- [ ] **[DB-09]** Create Supabase Storage bucket `customer-documents` (private, 10 MB max file size, allowed MIME: image/jpeg, image/png)
- [ ] **[DB-10]** Create Supabase Storage bucket `online-catalog-images` (public, 5 MB max, image/*)
- [ ] **[DB-11]** Write Edge Function `generate-customer-qr` (see schema doc — generates token, inserts row, returns signed QR payload)
- [ ] **[DB-12]** Write Edge Function `consume-customer-qr` (validates token, marks consumed_at, returns customer_id — atomic with SELECT FOR UPDATE)
- [ ] **[DB-13]** Write Edge Function `verify-customer-liveness` (stub: accepts base64 frames array, calls external liveness API or falls back to manual review flag)
- [ ] **[DB-14]** Write Edge Function `ocr-customer-id` (stub: accepts base64 image, calls MLKit result from client or Google Vision API fallback)
- [ ] **[DB-15]** Add `updated_at` trigger function (reuse existing pattern from other migrations) on all new tables
- [ ] **[DB-16]** Add indexes as specified in schema (customer phone/email, business_owner_id, token value, online_order status+created_at)

---

## Phase 2 — Login Screen Redesign (Business / Customer Toggle)

> Modify `src/app/(auth)/login.tsx` and `src/components/organisms/LoginForm.tsx`.
> The existing business login path must not break.

- [ ] **[UI-01]** Add `LoginModeToggle` atom — a pill toggle with two options: "Business" (briefcase icon) and "Customer" (person icon). Use `theme.colors.primary[500]` for active state, `theme.colors.neutral[200]` for inactive.
- [ ] **[UI-02]** Modify `login.tsx` — add `loginMode: 'business' | 'customer'` local state (default `'business'`). Render `LoginModeToggle` below the logo in the header section.
- [ ] **[UI-03]** When `loginMode === 'business'` — render existing `LoginForm` unchanged (username/password). No regression.
- [ ] **[UI-04]** When `loginMode === 'customer'` — render new `CustomerLoginSheet` organism (see Phase 4).
- [ ] **[UI-05]** Update header copy dynamically:
  - Business: "Welcome back" / "Sign in to manage your business"
  - Customer: "Customer Portal" / "Scan your Suki QR code to enter"
- [ ] **[UI-06]** Update card title dynamically:
  - Business: "Sign in" / "Enter your credentials to continue"
  - Customer: "Scan QR Code" / "Point your camera at the QR code from registration"
- [ ] **[UI-07]** Preserve the existing navy/amber/green brand stripe — it is the brand identity, do not remove it.
- [ ] **[UI-08]** Add "New customer? Register here" link below customer login view → navigates to `/(auth)/customer-register`.
- [ ] **[UI-09]** Write Storybook story `LoginModeToggle.stories.tsx` for both states.

---

## Phase 3 — Customer Registration + QR Code Generation

> New route: `/(auth)/customer-register.tsx`
> New route: `/(auth)/customer-qr-result.tsx` (shows generated QR)

- [ ] **[UI-10]** Create `/(auth)/customer-register.tsx` screen — registration form with fields:
  - Full Name (required)
  - Phone Number (required, +63 format validation)
  - Email (optional)
  - Username (required, min 4 chars, alphanumeric + underscore only)
  - Password (required, min 8 chars)
  - Confirm Password (required, must match)
  - Business Code (required — the 6-digit code that ties this customer to a specific business owner; displayed on the business owner's AppDrawer profile section)
- [ ] **[UI-11]** Use React Hook Form + Yup schema for all validation. Follow the existing `FormField` atom pattern.
- [ ] **[UI-12]** On submit: call Supabase Edge Function `generate-customer-qr`. Insert customer row + generate token atomically in the edge function.
- [ ] **[UI-13]** On success: navigate to `/(auth)/customer-qr-result` passing `customerId` and `token` as route params (use `router.push` with params — do NOT put sensitive token in URL; use a temporary in-memory store or SecureStore).
- [ ] **[UI-14]** Create `/(auth)/customer-qr-result.tsx` screen:
  - Display the generated QR code using `react-native-qrcode-svg` (value = token string).
  - Show instruction: "Show this QR code to scan when you first log in. This QR can only be scanned once."
  - Show a countdown timer (15 minutes — QR expiry). When timer hits 0, show "QR expired — tap to regenerate".
  - "Download / Share QR" button using `expo-sharing` to save/share the QR image.
  - "Back to Login" button.
- [ ] **[UI-15]** Add `/(auth)/_layout.tsx` Stack screen entries for `customer-register` and `customer-qr-result`.
- [ ] **[STORE-01]** Create `src/store/suki.store.ts` — customer-side Zustand store:
  - `currentCustomer: Customer | null`
  - `isCustomerLoggedIn: boolean`
  - `pendingQrToken: string | null` (cleared after scan)
  - `loginCustomer(customer: Customer): void`
  - `logoutCustomer(): void`
  - `setPendingQrToken(token: string): void`
  - `clearPendingQrToken(): void`
  - Persist `currentCustomer` and `isCustomerLoggedIn` to AsyncStorage under key `suki-customer-session`.
- [ ] **[STORE-02]** Add `Customer` type to `src/types/index.ts` (see schema doc for full field list).
- [ ] **[STORE-03]** Add `CustomerQrToken` type to `src/types/index.ts`.

---

## Phase 4 — Customer Login via QR Scanner (One-Time Token)

> New organism: `src/components/organisms/CustomerLoginSheet.tsx`
> This is the customer-mode panel shown in the redesigned login screen.

- [ ] **[UI-16]** Create `CustomerLoginSheet` organism:
  - Renders a full-width `expo-camera` preview (CameraView component, SDK 54 API).
  - Camera mode: `barCodeScannerSettings={{ barCodeTypes: ['qr'] }}`.
  - Overlay: semi-transparent viewfinder frame (square cutout) centered on screen.
  - Corner accent marks (standard QR scanner UI chrome).
  - Animated scan-line sweeping top to bottom using `Animated.loop`.
  - Status text below camera: "Align QR code within the frame".
- [ ] **[UI-17]** On successful QR scan:
  1. Pause camera (`CameraView.ref.pausePreview()`).
  2. Show loading overlay ("Verifying...").
  3. Call Supabase Edge Function `consume-customer-qr` with `{ token: scannedValue }`.
  4. On success: store customer in `suki.store` → navigate to `/(customer)/home`.
  5. On error (`TOKEN_ALREADY_USED`): show error sheet "This QR code has already been used. Please log in with your username and password." with a "Log in with credentials" CTA.
  6. On error (`TOKEN_EXPIRED`): show "QR code expired. Return to registration to generate a new one."
  7. On network error: show generic error with retry button (re-enable camera).
- [ ] **[UI-18]** After first QR scan success, customer has active credentials — add a "returning customer" tab/toggle in CustomerLoginSheet:
  - Tab 1: "Scan QR" (camera view, for first-time login)
  - Tab 2: "Username & Password" (for returning customers who already completed first login)
- [ ] **[UI-19]** "Username & Password" tab — standard form using `FormField` atoms, submit calls `authenticateCustomer()` store action which queries `customers` table (check password_hash via Supabase auth or bcrypt on edge function — see security notes in architecture section).
- [ ] **[STORE-04]** Add `authenticateCustomer(username: string, password: string): Promise<void>` action to `suki.store.ts`.
- [ ] **[STORE-05]** Add `consumeQrToken(token: string): Promise<void>` action to `suki.store.ts` — calls edge function, handles all error codes.

---

## Phase 5 — Customer Route Group + Profile Screen

> New route group: `src/app/(customer)/`
> This is a completely separate Stack from `/(app)/` — customers never see the business UI.

- [ ] **[UI-20]** Create `src/app/(customer)/_layout.tsx` — Stack wrapper with `headerShown: false`. Guard: if `!isCustomerLoggedIn` redirect to `/(auth)/login`.
- [ ] **[UI-21]** Create `src/app/(customer)/home.tsx` — customer home screen:
  - Greeting: "Hello, [name]!" with loyalty tier badge.
  - "Browse Products" CTA card.
  - "My Orders" CTA card.
  - "My Profile" CTA card.
  - Verification status banner: if not verified → amber banner "Complete your profile to unlock Pay Later orders." with "Verify Now" button.
- [ ] **[UI-22]** Create `src/app/(customer)/profile.tsx` — customer profile:
  - Display name, username, phone, email, profile picture (selfie thumbnail).
  - "Edit Credentials" section — change username and/or password form.
  - "Verification" section — shows current status (UNVERIFIED / PENDING / VERIFIED) with step indicators.
  - Verification steps: (1) Upload ID → (2) Selfie with liveness → (3) Awaiting business approval.
  - Each completed step shows a green checkmark.
- [ ] **[UI-23]** Create `src/app/(customer)/verify-id.tsx` — ID scanning screen:
  - Instruction card: "Take a photo of your Philippine national ID (front side)".
  - "Open Camera" button → `expo-image-picker` in camera mode.
  - On capture: run `@react-native-ml-kit/text-recognition` locally to extract text from the ID image.
  - Parse extracted text: look for patterns matching LNAME, FNAME, birthdate (regex for `dd Month YYYY` or `YYYY-MM-DD`), PCN number (16-digit string).
  - Pre-fill a confirmation form with extracted fields — user can correct them before submitting.
  - Upload ID image to Supabase Storage bucket `customer-documents` path: `{business_id}/{customer_id}/id_front.jpg`.
  - Insert/update `customer_id_documents` row in Supabase.
  - On success: navigate to `/(customer)/verify-liveness`.
- [ ] **[UI-24]** Create `src/app/(customer)/verify-liveness.tsx` — face liveness detection screen:
  - Use `expo-face-detector` with `expo-camera` in front-camera mode.
  - Detection sequence with animated instructions:
    1. "Look straight at the camera" → detect face centered, both eyes open.
    2. "Turn your head LEFT slowly" → detect face `rollAngle` or `yawAngle` deviation >= 25°.
    3. "Turn your head RIGHT slowly" → same, opposite direction.
    4. "Tilt your head DOWN slightly" → detect `pitchAngle` deviation.
    5. "Look straight — hold still — taking selfie!" → capture frame as selfie.
  - Each step has a circular progress indicator and a timeout (8 seconds per step; if timeout reached, restart sequence).
  - On all steps complete: capture final frame, upload selfie to `customer-documents/{business_id}/{customer_id}/selfie.jpg`.
  - Update `customer_id_documents.selfie_url` and set `liveness_passed = true`.
  - Navigate back to profile with success toast.
- [ ] **[UI-25]** Create `VerificationStepCard` molecule — reusable step indicator (icon, title, status chip, CTA button). Used in profile verification section.
- [ ] **[UI-26]** Create `LivenessInstructionOverlay` organism — the on-screen instruction display during liveness check (large text, animated arrow, progress dots).

---

## Phase 6 — Customer Order Screen (Online Ordering)

> New routes under `/(customer)/`:
> `src/app/(customer)/products.tsx`
> `src/app/(customer)/cart.tsx`
> `src/app/(customer)/order-confirm.tsx`
> `src/app/(customer)/orders.tsx`
> `src/app/(customer)/orders/[id].tsx`

- [ ] **[UI-27]** Create `/(customer)/products.tsx` — online product catalog browser:
  - Fetches `online_catalog` rows (Supabase query, joined with product name/price/image).
  - Grid layout (2 columns) with product cards: image, name, price, "Add to Cart" button.
  - Search bar at top (filter by product name).
  - Category filter chips (if products have categories).
  - Barcode scan FAB button — opens camera in barcode mode (see Phase 10).
  - Empty state: "No products available right now."
- [ ] **[UI-28]** Create `OnlineCatalogProductCard` molecule — product card for the customer browsing view (image, name, price, quantity stepper, "Add to Cart").
- [ ] **[UI-29]** Create `/(customer)/cart.tsx` — customer cart:
  - List of cart items (product name, qty stepper, line total, remove button).
  - Order summary: subtotal, VAT (if business has VAT enabled), total.
  - Payment method selector: "Pay Now" (cash on delivery / online) vs "Pay Later" (credit — only enabled if customer is VERIFIED).
  - If Pay Later is selected and customer is NOT verified: show inline banner "Verification required for Pay Later orders." with "Verify Now" link.
  - "Place Order" CTA.
- [ ] **[UI-30]** Create `/(customer)/order-confirm.tsx` — order placed success screen:
  - Order number, summary, expected processing time.
  - "Continue Shopping" and "View Order Status" buttons.
- [ ] **[UI-31]** Create `/(customer)/orders.tsx` — order history list.
- [ ] **[UI-32]** Create `/(customer)/orders/[id].tsx` — order detail with status timeline.
- [ ] **[STORE-06]** Create `src/store/online_orders.store.ts`:
  - `customerCart: OnlineCartItem[]`
  - `addToCart(catalogItem: OnlineCatalogItem, qty: number): void`
  - `removeFromCart(catalogItemId: string): void`
  - `updateCartQty(catalogItemId: string, qty: number): void`
  - `clearCart(): void`
  - `placeOrder(customerId: string, paymentMethod: 'pay_now' | 'pay_later'): Promise<OnlineOrder>`
  - `customerOrders: OnlineOrder[]`
  - `loadCustomerOrders(customerId: string): Promise<void>`
  - NOTE: `placeOrder()` must also call `reduceProductStockFromOnlineOrder()` in SQLite (see Phase 11).
- [ ] **[STORE-07]** Add `OnlineCatalogItem`, `OnlineOrder`, `OnlineOrderItem`, `OnlineCartItem` types to `src/types/index.ts`.

---

## Phase 7 — Business Side: Loyal Customer List + Verification UI

> New tab or screen under `/(app)/(tabs)/`.
> Accessible only to the business owner (existing auth guard).

- [ ] **[UI-33]** Add "Suki" entry to `AppDrawer.tsx` navigation list — icon: heart or user-group, navigates to `/(app)/(tabs)/suki`.
- [ ] **[UI-34]** Create `src/app/(app)/(tabs)/suki/_layout.tsx` — Stack with screens: index, `[id]`, verify.
- [ ] **[UI-35]** Create `src/app/(app)/(tabs)/suki/index.tsx` — loyal customer list:
  - Tabs: "All" | "Unverified" | "Verified" | "Pending".
  - Each customer row: avatar (selfie thumbnail), name, phone, verification badge, registration date, total orders.
  - Tap row → navigate to `/(app)/(tabs)/suki/[id]`.
  - Pull-to-refresh.
  - Business code display section at top (the 6-digit code customers use to register under this business) — tap to copy.
- [ ] **[UI-36]** Create `src/app/(app)/(tabs)/suki/[id].tsx` — customer detail:
  - Full profile: name, photo, phone, email, username, verification status.
  - ID document viewer: show uploaded ID image (from Supabase Storage signed URL).
  - Selfie viewer: show uploaded selfie.
  - Verification action: "Approve" / "Reject" buttons (only shown when status is PENDING).
  - Order history tab: list of this customer's online orders.
  - "Toggle Pay Later Access" switch — manual override for verified customers.
- [ ] **[UI-37]** Create `SukiCustomerCard` molecule — list row card for the loyal customer list.
- [ ] **[UI-38]** Create `CustomerVerificationPanel` organism — the ID + selfie reviewer with approve/reject actions.
- [ ] **[STORE-08]** Create `src/store/suki_business.store.ts` — business-side store for managing loyal customers:
  - `loyalCustomers: CustomerSummary[]`
  - `selectedCustomer: CustomerDetail | null`
  - `loadLoyalCustomers(businessId: string): Promise<void>`
  - `loadCustomerDetail(customerId: string): Promise<void>`
  - `approveCustomer(customerId: string): Promise<void>`
  - `rejectCustomer(customerId: string, reason: string): Promise<void>`
  - `togglePayLater(customerId: string, enabled: boolean): Promise<void>`
  - `businessCode: string` — the 6-digit code for this business (derived from business owner's user ID, stored in `customers.business_owner_id` lookup).
- [ ] **[STORE-09]** Add `CustomerSummary`, `CustomerDetail`, `CustomerVerificationStatus` types to `src/types/index.ts`.
- [ ] **[UI-39]** Add inventory item to `/(app)/(tabs)/_layout.tsx` Tabs: `suki` screen with appropriate icon.

---

## Phase 8 — Available Products Screen (Online Catalog Management)

> Business owner manages which products are visible to customers for online ordering.
> Separate from the offline POS product catalog — but sourced from the same `products` table.

- [ ] **[UI-40]** Create `src/app/(app)/(tabs)/suki/catalog.tsx` — online catalog management screen:
  - Header: "Online Store Catalog"
  - List of ALL business products (from SQLite `products` table).
  - Each row: product name, price, current stock, barcode, toggle switch ("Available for online orders").
  - Toggle writes to `online_catalog` table in Supabase (insert if enabling, set `is_available = false` if disabling).
  - Search bar at top.
  - "Manage Catalog" button in the suki index screen header navigates here.
- [ ] **[UI-41]** Create `OnlineCatalogToggleCard` molecule — product row with availability toggle for the catalog management screen.
- [ ] **[STORE-10]** Add catalog management actions to `suki_business.store.ts`:
  - `catalogItems: OnlineCatalogItem[]`
  - `loadCatalog(businessId: string): Promise<void>`
  - `toggleCatalogItem(productId: string, isAvailable: boolean): Promise<void>`
  - `addProductToCatalog(productId: string, customPrice?: number): Promise<void>`
  - `removeProductFromCatalog(catalogItemId: string): Promise<void>`

---

## Phase 9 — Pay Later / Credit Ledger Integration Gating

> The existing credit/receivables module (migration 016) must gate Pay Later behind customer verification.
> This phase bridges online orders with the existing `credit_sales` and `credit_customers` tables.

- [ ] **[LOGIC-01]** Define the gating rule in `src/types/index.ts`:
  - `canUsePayLater(customer: Customer): boolean` — returns `true` only when `customer.verification_status === 'VERIFIED'` AND `customer.pay_later_enabled === true`.
- [ ] **[LOGIC-02]** In `online_orders.store.ts` `placeOrder()`: if `paymentMethod === 'pay_later'`:
  1. Check `canUsePayLater(currentCustomer)` — throw `UNAUTHORIZED` if false.
  2. After inserting the online order in Supabase, call the existing `createCreditSaleFromPOS()` repository function to create a credit ledger entry for this customer.
  3. The `credit_customers` table references the `customers` table via `customer_suki_id` FK (added in Migration 025b — see schema doc).
- [ ] **[LOGIC-03]** In `/(customer)/cart.tsx`: Pay Later option must be visually disabled (greyed out, with tooltip) when `canUsePayLater` returns false.
- [ ] **[LOGIC-04]** In `suki/[id].tsx` business detail screen: show the credit balance (from `credit.store`) for any verified customer who has used Pay Later.
- [ ] **[LOGIC-05]** Write integration test (manual checklist): unverified customer → Pay Later → blocked; verified customer → Pay Later → credit ledger row created; business owner → see balance.

---

## Phase 10 — Barcode Scanner on Customer Product Selection

> Customer browses the online catalog and can scan a product barcode to quickly find and add it to cart.

- [ ] **[UI-42]** Add a barcode scan FAB to `/(customer)/products.tsx` (floating action button, camera icon, positioned bottom-right).
- [ ] **[UI-43]** On FAB tap: open a modal with `expo-camera` in barcode scanning mode (`barCodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'qr']`).
- [ ] **[UI-44]** On barcode scan:
  1. Query `online_catalog` (Supabase) where `product.barcode = scannedValue` AND `business_id = currentBusinessId` AND `is_available = true`.
  2. If found: close camera, scroll catalog to matched product, highlight it for 2 seconds with a border animation, pre-fill qty = 1.
  3. If not found: show toast "Product not in online catalog" with a "Dismiss" action.
- [ ] **[UI-45]** Reuse the existing `BarcodeScannerModal` molecule (already in `src/components/molecules/BarcodeScannerModal/`) — extend it to accept an `onBarcodeScanned` prop that returns the raw string instead of the resolved `InventoryItem`. The catalog lookup happens in the screen, not inside the modal.

---

## Phase 11 — Offline POS Stock Reduction via SQLite When Online Order Placed

> When a customer places an online order, the business's LOCAL SQLite stock must also be reduced
> so the offline POS never oversells an item that was already committed to an online order.

- [ ] **[SQLite-01]** Create `src/database/repositories/online_order.repository.ts`:
  - `reduceProductStockFromOnlineOrder(orderId: string, items: OnlineOrderItem[]): Promise<void>`
  - This function iterates each order item and calls the existing `addInventoryMovement()` function (or equivalent) with `movement_type = 'OUT'` and `reference_type = 'ONLINE_ORDER'`, `reference_id = orderId`.
  - This is a SQLite transaction (`db.withTransactionAsync`) — all items reduce atomically or none do.
  - This mirrors the existing `createSalesOrder` POS pattern.
- [ ] **[SQLite-02]** Call `reduceProductStockFromOnlineOrder()` inside `placeOrder()` in `online_orders.store.ts` AFTER the Supabase insert succeeds.
- [ ] **[SQLite-03]** Handle the edge case where the Supabase insert succeeds but the SQLite reduction fails:
  - Log the failure to an `offline_sync_queue` table with `type = 'STOCK_REDUCTION'` and `payload = JSON(orderItems)`.
  - On next app boot, the sync process processes this queue.
  - Show a non-blocking warning toast: "Stock sync pending — inventory will update shortly."
- [ ] **[SQLite-04]** In `/(customer)/cart.tsx` before placing order: pre-check stock availability by querying SQLite `products` table (or inventory_movements sum) to show an inline warning if any item qty exceeds available stock. This is a soft check — it does NOT block order placement, it only warns.
- [ ] **[SQLite-05]** After `reduceProductStockFromOnlineOrder()` succeeds, call `useInventoryStore.getState().initializeInventory()` to refresh the in-memory store so POS screen reflects updated stock immediately.

---

## Phase 12 — Business Code Generation & Display

> Each business needs a unique 6-character alphanumeric code that customers enter during registration
> to link themselves to the correct business.

- [ ] **[DB-16]** Add `business_code` column to the existing `users` table (or a `business_profiles` table if one exists): `VARCHAR(8) UNIQUE NOT NULL DEFAULT generate_business_code()`. Write the SQL function `generate_business_code()` that produces a random 6-char uppercase alphanumeric string and retries on collision.
- [ ] **[UI-46]** In `AppDrawer.tsx`: add a "Your Business Code" section below the user name — display the code in a large monospace font with a copy-to-clipboard icon button. Tap copies code; show "Copied!" toast for 2 seconds.
- [ ] **[UI-47]** In `/(app)/(tabs)/suki/index.tsx`: also show business code at the top of the screen as a persistent banner (for easy sharing during face-to-face customer registration).

---

## Phase 13 — Notifications & Polish

> Connect the module to the existing notification store and add final UX polish.

- [ ] **[NOTIF-01]** Push notification (via existing notification store): when a customer places an online order → send push notification to business owner "New Suki order from [name] — ₱[total]".
- [ ] **[NOTIF-02]** Push notification: when business owner approves/rejects verification → send push to customer "Your Suki account has been [approved/rejected]".
- [ ] **[NOTIF-03]** Add order status badge to the Suki tab icon in the business owner's tab bar (shows count of pending orders needing attention).
- [ ] **[UI-48]** Add skeleton loading states to all new list screens (reuse existing `Skeletons` molecule).
- [ ] **[UI-49]** Add empty states to all new list screens (reuse existing `EmptyState` molecule).
- [ ] **[UI-50]** Add pull-to-refresh on all new list screens.
- [ ] **[UI-51]** Ensure all new screens handle no-network state gracefully (offline banner from existing utilities).
- [ ] **[I18N-01]** Add all new strings to `src/i18n/locales/en.ts` and `src/i18n/locales/tl.ts`.

---

## Phase 14 — Security Hardening

> Complete before production release.

- [ ] **[SEC-01]** QR token: verify `expires_at` server-side in the `consume-customer-qr` edge function even if the client already showed an expiry UI.
- [ ] **[SEC-02]** QR token: use `SELECT ... FOR UPDATE` in the consume transaction to prevent race-condition double-scans.
- [ ] **[SEC-03]** Customer passwords: hash with bcrypt (cost factor 12) in the edge function — NEVER store plaintext. Use Supabase Auth custom user flow or a separate `password_hash` column with bcrypt.
- [ ] **[SEC-04]** Rate limit `consume-customer-qr` edge function: max 5 attempts per IP per minute (use Supabase edge function + upstash redis rate limiter or a counter in the DB).
- [ ] **[SEC-05]** Supabase Storage: all `customer-documents` bucket objects must only be accessible via signed URLs (1-hour expiry) — never public URLs. Enforce this in the bucket policy.
- [ ] **[SEC-06]** RLS: the `customers` table `business_owner_id` FK ensures a business owner can only see their own customers. Verify the RLS policy covers all SELECT paths.
- [ ] **[SEC-07]** Customer session: store the session token in `expo-secure-store` (encrypted keychain), never in AsyncStorage plain text.
- [ ] **[SEC-08]** Audit log: every verification action (approve/reject) must write to a `customer_verification_audit` table with `actor_id`, `action`, `timestamp`, `reason`.

---

## Dependency Map

```
Phase 0 (libs) → Phase 1 (DB) → Phase 2 (login redesign)
                              → Phase 3 (customer register)
                                        → Phase 4 (QR login)
                                                  → Phase 5 (customer profile + liveness)
                                                            → Phase 6 (ordering)
                                                                       → Phase 11 (stock reduction)
                                                                       → Phase 9 (pay later gating)
Phase 1 → Phase 7 (business side)
        → Phase 8 (catalog management)
        → Phase 10 (barcode scan on catalog) — depends on Phase 6 catalog screen
Phase 12 (business code) — depends on Phase 1 DB
Phase 13 (polish) — last, after all feature phases
Phase 14 (security) — run concurrently with Phase 4+, finalize before release
```

---

## Definition of Done

A phase is "done" when:
1. TypeScript compiles with zero errors (`npx tsc --noEmit`).
2. No `any` types introduced.
3. All `exactOptionalPropertyTypes` violations resolved (conditional spread pattern used).
4. All `noUncheckedIndexedAccess` violations resolved (`??` fallbacks on array access).
5. New screens have loading, empty, and error states.
6. New Supabase tables have RLS enabled and tested.
7. New i18n strings added to both `en.ts` and `tl.ts`.
8. Manual smoke test on both iOS and Android (or simulators).
