import { StyleProp, ViewStyle } from 'react-native';

// ─── Domain: Business Lookup Tables ──────────────────────────────────────────

/** Enterprise scale of the business (MSME classification). */
export type EnterpriseType = 'small' | 'medium';

/**
 * The supported business operation mode categories in the app.
 *
 * - 'production' — business manufactures, cooks, or assembles products from
 *   ingredients and raw materials (bakery, restaurant, food stall, carinderia).
 *   These businesses use BOM, ingredient tracking, raw material management,
 *   and production logs.
 *
 * - 'reseller' — business buys and resells ready-made products without any
 *   production step (sari-sari store, grocery, convenience store).
 *   These businesses use product catalog + POS + stock only.
 */
export type BusinessOperationMode = 'production' | 'reseller';

/**
 * Maps a `BusinessType.category` string to a `BusinessOperationMode`.
 * Food/beverage categories map to production; everything else (retail,
 * digital, other, services) maps to reseller. 'services' is additionally
 * unsupported and should be filtered out before the picker (see
 * `isSupportedBusinessCategory`).
 *
 * The category string is normalized first because the live backend seeds
 * capitalized values ('Food', 'Retail', 'Services', 'Other') while the
 * bundled fallback uses snake_case ('food_beverage', 'retail', ...). Both
 * naming schemes must resolve to the same mode, otherwise the live data
 * leaves the "I make my products" (production) section empty.
 */
const PRODUCTION_CATEGORIES = new Set(['food_beverage', 'food', 'food_and_beverage']);

export function getBusinessOperationMode(category: string): BusinessOperationMode {
  if (PRODUCTION_CATEGORIES.has(normalizeBusinessCategory(category))) {
    return 'production';
  }
  return 'reseller';
}

/**
 * Normalize a raw `category` string to a lower-case, underscore-delimited
 * canonical form so comparisons are insensitive to casing/spacing/hyphens
 * across the live backend and the bundled fallback data.
 *   'Food' -> 'food', 'Food & Beverage' -> 'food_beverage'
 */
export function normalizeBusinessCategory(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\s-]+/g, '_');
}

/** Categories not supported in this version (no booking/appointment flows). */
const UNSUPPORTED_BUSINESS_CATEGORIES = new Set(['services', 'service']);

/** True when a business category should be shown in the registration picker. */
export function isSupportedBusinessCategory(category: string): boolean {
  return !UNSUPPORTED_BUSINESS_CATEGORIES.has(normalizeBusinessCategory(category));
}

/**
 * Returns true when the business type requires production features:
 * BOM, ingredient tracking, raw material management, production logs.
 */
export function isProductionBusiness(mode: BusinessOperationMode): boolean {
  return mode === 'production';
}

/**
 * Returns true when the business type is a pure reseller:
 * product catalog + POS + stock only — no production features.
 */
export function isResellerBusiness(mode: BusinessOperationMode): boolean {
  return mode === 'reseller';
}

/**
 * Row shape of the `public.business_types` lookup table.
 * pos_enabled indicates whether this business type may access the POS module.
 */
export interface BusinessType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /**
   * Supported categories: 'food_beverage' | 'retail' | 'digital' | 'other'
   * 'services' category is intentionally excluded from the registration picker.
   */
  category: string;
  pos_enabled: boolean;
  sort_order: number;
  is_active: boolean;
}

/**
 * Row shape of the `public.job_roles` lookup table.
 * Describes the user's position/role within their business.
 */
export interface JobRole {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * Row shape of the `public.businesses` table.
 * Optionally includes joined business_type when fetched with a select join.
 */
export interface Business {
  id: string;
  name: string;
  business_type_id: number;
  enterprise_type: EnterpriseType;
  owner_id: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  // Joined relation (present when fetched with business_type:business_types(*))
  business_type?: BusinessType;
}

// ─── Domain: Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'user' | 'viewer';
  // Extended profile fields (optional so existing code stays compatible)
  firstName?: string;
  lastName?: string;
  username?: string;
  // Business-linked fields (replaces the old businessCategory / enterpriseType)
  businessId?: string;
  jobRoleId?: number;
  businessName?: string;
  businessTypeName?: string;
  jobRoleName?: string;
  /** Whether the user's business type has POS module access. */
  posEnabled?: boolean;
  /**
   * The raw category string from `business_types.category` (e.g. 'food_beverage', 'retail').
   * Persisted on the User so feature-gating works offline without a DB round-trip.
   */
  businessTypeCategory?: string;
  /**
   * Derived from `businessTypeCategory` via `getBusinessOperationMode()`.
   * Persisted for convenience so components can gate features with a single field check.
   */
  businessOperationMode?: BusinessOperationMode;
}

/**
 * Row shape of the `public.users` table in Supabase.
 * Column names match the DB schema (mix of camelCase legacy and snake_case new).
 * Optionally includes joined relations when fetched with a select join.
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  business_id: string | null;
  job_role_id: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  // Joined relations (present when fetched with join selects)
  business?: Business;
  job_role?: JobRole;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

export interface LoginCredentials {
  /** Login is username-based. Email is resolved server-side via RPC. */
  username: string;
  password: string;
}

export interface RegisterCredentials {
  // Supabase Auth (email required for signUp, never for login)
  email: string;
  password: string;
  // Profile
  firstName: string;
  lastName: string;
  username: string;
  /** Display name of the business being registered. */
  businessName: string;
  /** Foreign key to public.business_types.id */
  businessTypeId: number;
  /**
   * The `category` string from the selected BusinessType row (e.g. 'food_beverage', 'retail').
   * Captured at registration time so the auth service can derive `businessOperationMode`
   * without a second DB round-trip (useful when email confirmation is pending).
   */
  businessTypeCategory: string;
  // NOTE: no jobRoleId — the registering user is the business owner and is
  // auto-assigned the "CEO / Owner" job role server-side. Roles for staff are
  // set later by the owner when creating those users.
  enterpriseType: EnterpriseType;
}

// ─── Domain: Notifications ───────────────────────────────────────────────────

export type NotificationType = 'CHAT_MESSAGE' | 'ALERT' | 'INFO' | 'WARNING';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string | number | boolean>;
  isRead: boolean;
  createdAt: string; // ISO 8601
}

// ─── Domain: API ─────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: Status;
  error: ApiError | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Domain: Inventory ───────────────────────────────────────────────────────

export type InventoryCategory = 'product' | 'ingredient' | 'equipment';

export type EquipmentCondition = 'good' | 'fair' | 'poor';

export type StockUnit =
  | 'pcs'
  | 'kg'
  | 'g'
  | 'L'
  | 'mL'
  | 'box'
  | 'bag'
  | 'bottle'
  | 'pack'
  | 'dozen'
  | 'roll'
  | 'meter'
  | 'set'
  | 'cup';

/**
 * Discriminates how a 'product' category item is produced or sourced.
 *
 *   'manufactured'   — assembled or cooked from ingredients and/or raw materials.
 *                      Must have a Bill of Materials (BOM). Stock is added via
 *                      the production workflow which deducts ingredient/raw material
 *                      stock automatically.
 *
 *   'ready_to_sell'  — purchased finished good, resold without any production step.
 *                      No BOM required. Stock is added via the standard "Add Stock"
 *                      flow only.
 *
 * Only meaningful when category === 'product'. Ingredient and equipment items
 * always carry the default value ('ready_to_sell') and the UI ignores it for them.
 */
export type ProductType = 'manufactured' | 'ready_to_sell';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  description?: string;
  quantity: number;
  unit: StockUnit;
  /**
   * Type of product — only meaningful when category === 'product'.
   * Determines whether the BOM section is shown in the add/edit form and
   * whether the production workflow is used for stock additions.
   * Defaults to 'ready_to_sell' for backward compatibility with pre-025
   * rows that have no stored value.
   */
  productType: ProductType;
  /** Selling price — relevant for Products */
  price?: number;
  /** Purchase / cost price */
  costPrice?: number;
  /** Stock-Keeping Unit — relevant for Products */
  sku?: string;
  /** Quantity threshold that triggers a low-stock alert — relevant for Ingredients */
  reorderLevel?: number;
  /** Physical condition — relevant for Equipment */
  condition?: EquipmentCondition;
  /** Serial or asset number — relevant for Equipment */
  serialNumber?: string;
  /** ISO 8601 purchase date — relevant for Equipment */
  purchaseDate?: string;
  /** Local URI from image picker */
  imageUri?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /**
   * VAT treatment for this product.
   * - 'vatable'    — subject to the standard VAT rate (default 12 %)
   * - 'vat_exempt' — not subject to VAT at all
   * - 'zero_rated' — taxable at 0 % (export / special-category items)
   */
  vatType: 'vatable' | 'vat_exempt' | 'zero_rated';
  /**
   * When true the selling `price` already includes VAT; the POS must back-calculate
   * the base amount. When false the VAT is added on top of the price at checkout.
   */
  isVatInclusive: boolean;
  /** Applicable VAT rate expressed as a decimal (0.12 = 12 %). Allows future rate changes. */
  vatRate: number;
}

export interface InventoryFilter {
  category: InventoryCategory | 'all';
  searchQuery: string;
}

// ─── Domain: Product Ingredients ─────────────────────────────────────────────

/**
 * A single ingredient link between a product and an ingredient item.
 * Stored in the `product_ingredients` SQLite table.
 */
export interface ProductIngredient {
  id:           string;
  productId:    string;
  ingredientId: string;
  /** How much of the ingredient is used per 1 unit of the product. */
  quantityUsed: number;
  /** Unit of measurement for quantityUsed (e.g. 'g', 'mL', 'pcs'). */
  unit:         string;
  createdAt:    string; // ISO 8601
  updatedAt:    string; // ISO 8601
}

/**
 * `ProductIngredient` extended with denormalised ingredient details.
 * Returned by `getProductIngredients()` via a JOIN on `inventory_items`.
 */
export interface ProductIngredientWithDetails extends ProductIngredient {
  ingredientName:     string;
  ingredientUnit:     string;
  /** Cost per unit of the ingredient — undefined when not set on the item. */
  ingredientCostPrice?: number;
  /** Current stock quantity of the ingredient. */
  ingredientQuantity: number;
  /** quantityUsed × ingredientCostPrice (0 when costPrice is unset). */
  lineCost:           number;
}

/**
 * `ProductIngredient` enriched with ingredient details AND UOM conversion data.
 * Returned by `getProductIngredients()` — a superset of `ProductIngredientWithDetails`
 * that additionally carries `stockUnit` and `convertedQuantity`.
 *
 * `convertedQuantity` is `quantityUsed` after converting from `unit` to
 * `stockUnit` via `convertUnit()`. When both units are identical (or
 * `stockUnit` is not set for pre-migration rows), `convertedQuantity` equals
 * `quantityUsed`.
 */
export interface ProductIngredientDetail extends ProductIngredientWithDetails {
  /** The unit the ingredient is stocked in (e.g. 'kg'). */
  stockUnit:         string;
  /** `quantityUsed` converted to `stockUnit` — ready to deduct from inventory. */
  convertedQuantity: number;
}

/**
 * Per-ingredient deduction record returned by `calculateStockDeductions()`.
 * All quantities have already been converted to the ingredient's stock unit
 * so the caller can pass `amountToDeduct` directly to `adjustItemQuantity()`.
 */
export interface StockDeduction {
  ingredientId:   string;
  ingredientName: string;
  /** The amount to subtract from inventory, expressed in `stockUnit`. */
  amountToDeduct: number;
  /** The unit that `amountToDeduct` is expressed in (equals the stock unit). */
  stockUnit:      string;
}

/**
 * Transient UI state for an ingredient row being built in the add/edit form.
 * Not persisted until the user saves the product.
 */
export interface SelectedIngredient {
  ingredientId:   string;
  ingredientName: string;
  quantityUsed:   number;
  unit:           string; // recipe unit — what the user entered (e.g. 'g')
  stockUnit:      string; // ingredient's native stock unit (e.g. 'kg')
  costPrice?:     number; // per-stock-unit cost from the ingredient inventory item
  lineCost:       number; // convertedQty × (costPrice ?? 0), where convertedQty is in stockUnit
}

// ─── Domain: BOM Validation ───────────────────────────────────────────────────

/**
 * A single ingredient or raw material whose available stock is insufficient
 * to satisfy the requested production quantity.
 */
export interface BomShortageItem {
  ingredientId:   string;
  ingredientName: string;
  /** Amount required per unit, expressed in the stock unit. */
  required:       number;
  /** Current stock available, expressed in the stock unit. */
  available:      number;
  /** required * requestedQty - available */
  shortage:       number;
  unit:           string;
  /** false = ingredient (inventory_items), true = raw_material */
  isRawMaterial:  boolean;
}

/**
 * Result returned by `validateStockAddition()` in bomValidation.ts.
 * `isValid` is true when `requestedQty <= maxProducible`.
 */
export interface BomValidationResult {
  isValid:       boolean;
  /** 0 means nothing can be produced with current stock. */
  maxProducible: number;
  shortages:     BomShortageItem[];
  requestedQty:  number;
}

// ─── Domain: Production Tracking ─────────────────────────────────────────────

/** Header record for a single production run. */
export interface ProductionLog {
  id:            string;
  productId:     string;
  unitsProduced: number;
  totalCost:     number;
  notes?:        string;
  producedAt:    string; // ISO 8601
  createdAt:     string;
}

/** Ingredient consumed in a production run — snapshot of cost at that time. */
export interface ProductionLogIngredient {
  id:               string;
  productionLogId:  string;
  ingredientId:     string;
  quantityConsumed: number;
  unit:             string;
  costPrice?:       number; // snapshot at time of production
  lineCost:         number;
  createdAt:        string;
}

/** `ProductionLogIngredient` with the ingredient's display name. */
export interface ProductionLogIngredientDetail extends ProductionLogIngredient {
  ingredientName: string;
}

/** `ProductionLog` with product name and full ingredient line items. */
export interface ProductionLogWithDetails extends ProductionLog {
  productName:  string;
  ingredients:  ProductionLogIngredientDetail[];
  rawMaterials: RawMaterialConsumedDetail[];
}

/** A raw material consumed during a production run (joined with name/unit). */
export interface RawMaterialConsumedDetail {
  rawMaterialId:   string;
  rawMaterialName: string;
  quantityUsed:    number;
  unit:            string;
  totalCost:       number;
}

// ─── Domain: Ingredient Consumption Logs ─────────────────────────────────────

/**
 * What business event triggered the ingredient consumption.
 * RETURN is the only type that may carry a negative quantity_consumed.
 */
export type IngredientConsumptionTrigger =
  | 'PRODUCTION'
  | 'MANUAL_ADJUSTMENT'
  | 'WASTAGE'
  | 'RETURN'
  | 'TRANSFER';

/** Domain model for a single ingredient consumption event. */
export interface IngredientConsumptionLog {
  id:               string;
  ingredientId:     string;
  quantityConsumed: number;
  unit:             string;
  triggerType:      IngredientConsumptionTrigger;
  /** ID of the source document (e.g. production_log id). */
  referenceId?:     string;
  /** Type name of the source document (e.g. 'production_log'). */
  referenceType?:   string;
  notes?:           string;
  /** Snapshot of cost_price at the time of consumption. */
  costPrice?:       number;
  /** quantity_consumed × costPrice (0 when costPrice is unset). */
  totalCost:        number;
  /** User ID (or display name) of who performed the action. */
  performedBy?:     string;
  consumedAt:       string; // ISO 8601
  createdAt:        string; // ISO 8601
  cancelledAt?:     string; // ISO 8601 — set when voided
  /** FK to inventory_items.id — the finished product this ingredient was consumed for. */
  productId?:       string;
  /** Denormalized snapshot of the product name at time of consumption. */
  productName?:     string;
}

/** `IngredientConsumptionLog` enriched with ingredient display name. */
export interface IngredientConsumptionLogDetail extends IngredientConsumptionLog {
  ingredientName: string;
}

/** Per-ingredient aggregate for summary views. */
export interface IngredientConsumptionSummary {
  ingredientId:      string;
  ingredientName:    string;
  totalConsumed:     number;
  unit:              string;
  totalCost:         number;
  /** Number of consumption events (excluding cancelled). */
  eventCount:        number;
}

// ─── Domain: Production Dashboard ────────────────────────────────────────────

/** Per-product production total for the current calendar day. */
export interface TodayProductionSummary {
  productId:   string;
  productName: string;
  totalUnits:  number;
  totalCost:   number;
}

/** Single-day aggregate across all products — used for trend charts. */
export interface DailyProductionTrend {
  /** Calendar date in 'YYYY-MM-DD' format. */
  date:       string;
  totalUnits: number;
  totalCost:  number;
}

// ─── Domain: POS / Sales ─────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'card' | 'credit';

export type SalesOrderStatus = 'pending' | 'completed' | 'cancelled';

/**
 * Header row for a completed sale.
 * Price fields are snapshots — they do not change if the product price changes later.
 */
export interface SalesOrder {
  id:              string;
  /** Zero-padded sequential number, e.g. "ORD-0001". */
  orderNumber:     string;
  status:          SalesOrderStatus;
  subtotal:        number;
  discountAmount:  number;
  totalAmount:     number;
  paymentMethod:   PaymentMethod;
  /** Only meaningful for cash payments — amount the customer handed over. */
  amountTendered?: number;
  /** Only meaningful for cash payments — change given back. */
  changeAmount?:   number;
  /** Total VAT component of this order (0 when no vatable items were sold). */
  vatAmount:       number;
  notes?:          string;
  createdAt:       string; // ISO 8601
  updatedAt:       string; // ISO 8601
  isSynced:        boolean;
}

/** A single product line within a sales order. */
export interface SalesOrderItem {
  id:           string;
  salesOrderId: string;
  productId:    string;
  /** Snapshot of `inventory_items.name` at time of sale. */
  productName:  string;
  quantity:     number;
  /** Snapshot of `inventory_items.price` at time of sale. */
  unitPrice:    number;
  subtotal:     number;
  createdAt:    string; // ISO 8601
}

/** `SalesOrder` with its line items — used for the order detail view. */
export interface SalesOrderDetail extends SalesOrder {
  items: SalesOrderItem[];
}

/**
 * A single item in the POS cart.
 * Transient UI state — not persisted to SQLite until checkout.
 */
export interface CartItem {
  product:   InventoryItem;
  quantity:  number;
  unitPrice: number;
  subtotal:  number;
}

// ─── Domain: POS Cart (persisted draft) ──────────────────────────────────────

/**
 * A persisted POS cart session.
 * Represents an in-progress sale that survives app restarts.
 * Distinct from `SalesOrder`, which records a COMPLETED transaction.
 */
export interface PosCartSession {
  id:              string;
  /** 'active' — the current working cart; 'abandoned' — closed without checkout. */
  status:          'active' | 'abandoned';
  discountAmount:  number;
  notes?:          string;
  createdAt:       string; // ISO 8601
  updatedAt:       string; // ISO 8601
}

/**
 * A single product line within a persisted POS cart session.
 * `productName` and `unitPrice` are price-point snapshots captured when the
 * item was added — they do not update if the product is re-priced mid-session.
 */
export interface PosCartItem {
  id:          string;
  sessionId:   string;
  productId:   string;
  /** Snapshot of inventory_items.name at time of addition. */
  productName: string;
  quantity:    number;
  /** Snapshot of inventory_items.price at time of addition. */
  unitPrice:   number;
  subtotal:    number;
  createdAt:   string; // ISO 8601
  updatedAt:   string; // ISO 8601
}

// ─── Domain: Utilities Consumption ───────────────────────────────────────────

/**
 * A utility category (electricity, water, gas, internet, rent, or custom).
 * Built-in types have isCustom = false; user-created types have isCustom = true.
 */
export interface UtilityType {
  id:        string;
  name:      string;
  /** Icon name from the icon library, e.g. "Zap", "Droplets", "Flame". */
  icon:      string;
  /** Unit of consumption measurement, e.g. "kWh", "m³", "Mbps". */
  unit:      string;
  /** Hex color used in the UI, e.g. "#F59E0B". */
  color:     string;
  isCustom:  boolean;
  createdAt: string; // ISO 8601
}

/**
 * A monthly billing record for a single utility type.
 * Includes denormalised utility_type fields (name, icon, color, unit)
 * so callers never need a second query.
 */
export interface UtilityLog {
  id:               string;
  utilityTypeId:    string;
  /** Denormalised from utility_types at query time. */
  utilityTypeName:  string;
  utilityTypeIcon:  string;
  utilityTypeColor: string;
  utilityTypeUnit:  string;
  periodYear:       number;
  /** 1–12 */
  periodMonth:      number;
  /** Metered consumption reading — absent for flat-rate utilities (e.g. Rent). */
  consumption?:     number;
  /** Peso amount of the bill. */
  amount:           number;
  /** ISO 8601 date the bill is due. */
  dueDate?:         string;
  /** ISO 8601 timestamp when the bill was paid; absent when unpaid. */
  paidAt?:          string;
  notes?:           string;
  createdAt:        string; // ISO 8601
  updatedAt:        string; // ISO 8601
}

// ─── Domain: Dashboard ───────────────────────────────────────────────────────
// Authoritative definitions live in dashboard.types.ts — re-exported here so
// all code can import from the single '@/types' barrel as usual.

export type { DashboardPeriod, DashboardPeriodState, DashboardKPIs, DashboardTrendPoint, DashboardData, DashboardDateRange, DashboardMetrics } from './dashboard.types';
export type {
  RawMaterial,
  CreateRawMaterialInput,
  UpdateRawMaterialInput,
  ProductRawMaterial,
  ProductRawMaterialInput,
  RawMaterialConsumptionLog,
  CreateRawMaterialConsumptionLogInput,
  RawMaterialUnit,
  RawMaterialCategory,
  RawMaterialReason,
  SelectedRawMaterial,
  RawMaterialConsumptionLogDetail,
  RawMaterialConsumptionSummary,
  RawMaterialConsumptionTrend,
  GetRawMaterialLogsOptions,
} from './raw_materials.types';
export type {
  StockReductionReason,
  StockReductionItemType,
  StockReductionLog,
  CreateProductStockReductionInput,
  CreateIngredientStockReductionInput,
  CreateStockReductionLogInput,
  GetStockReductionLogsOptions,
} from './stock_reduction_logs.types';

export type {
  OverheadCategory,
  OverheadFrequency,
  OverheadExpense,
  CreateOverheadExpenseInput,
  GetOverheadExpensesOptions,
  OverheadExpenseSummary,
  MonthlyOverheadPoint,
} from './overhead_expenses.types';

// ─── Domain: Receivables (Credit Sales / Utang) ──────────────────────────────

/**
 * A customer who is allowed to buy on credit.
 * Master data — mutated by updateCreditCustomer only.
 * Soft-deleted via status = 'inactive' so ledger history remains intact.
 */
export interface CreditCustomer {
  id:        string;
  name:      string;
  phone?:    string;
  notes?:    string;
  /** 'active' | 'inactive' */
  status:    'active' | 'inactive';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * A single credit transaction — appended to the ledger when a POS sale
 * is charged to a customer, or when a manual credit is recorded.
 * Rows are NEVER updated after insert.
 */
export interface CreditSale {
  id:               string;
  customerId:       string;
  /** FK to sales_orders.id — absent when recorded manually without a POS receipt. */
  posTransactionId?: string;
  totalAmount:      number;
  notes?:           string;
  /** ISO 8601 date the credit was extended. */
  saleDate:         string;
  createdAt:        string; // ISO 8601
}

/** A single line-item snapshot on a credit sale — sourced from sales_order_items. */
export interface CreditSaleItem {
  productName: string;
  quantity:    number;
  unitPrice:   number;
  subtotal:    number;
}

/** CreditSale enriched with its POS line items (empty array when no posTransactionId). */
export interface CreditSaleWithItems extends CreditSale {
  items: CreditSaleItem[];
}

/**
 * A single payment recorded against a customer's credit balance.
 * Partial payments are stored as individual rows.
 * Rows are NEVER updated after insert.
 */
export interface CreditPayment {
  id:         string;
  customerId: string;
  amount:     number;
  notes?:     string;
  /** ISO 8601 timestamp when the payment was received. */
  paidAt:     string;
  createdAt:  string; // ISO 8601
}

/**
 * Computed summary for a single customer.
 * balance = totalCredit - totalPaid (always >= 0 in the UI).
 * Returned by getCustomerSummaries() — not persisted.
 */
export interface CustomerCreditSummary {
  customer:    CreditCustomer;
  totalCredit: number;
  totalPaid:   number;
  /** totalCredit - totalPaid, floored at 0. */
  balance:     number;
  /** True when totalCredit > 0 and balance === 0. */
  isFullyPaid: boolean;
}

// ─── Input types for the repository ──────────────────────────────────────────

export interface CreateCreditCustomerInput {
  name:   string;
  phone?: string;
  notes?: string;
}

export interface UpdateCreditCustomerInput {
  name:    string;
  phone?:  string;
  notes?:  string;
  status?: 'active' | 'inactive';
}

export interface CreateCreditSaleInput {
  customerId:        string;
  posTransactionId?: string;
  totalAmount:       number;
  notes?:            string;
  /** Defaults to now() if omitted. */
  saleDate?:         string;
}

export interface CreateCreditPaymentInput {
  customerId: string;
  amount:     number;
  notes?:     string;
  /** Defaults to now() if omitted. */
  paidAt?:    string;
}

// ─── Domain: ROI Calculator ───────────────────────────────────────────────────
// Authoritative definitions live in roi.types.ts — re-exported here so all
// code can import from the single '@/types' barrel as usual.

export type {
  ROIInputs,
  ROIRiskLevel,
  ROIResults,
  ROIScenarioItem,
  ROIScenarios,
  ROIStoreState,
  ROIStoreActions,
  ROIScenario,
  CreateROIScenarioInput,
  UpdateROIScenarioNameInput,
} from './roi.types';

// ─── Domain: Business ROI Overview ───────────────────────────────────────────
// Authoritative definitions live in business_roi.types.ts.

export type {
  ProductROIBreakdown,
  BusinessROIRiskLevel,
  BusinessROIData,
} from './business_roi.types';

// ─── Domain: Stock Movements ──────────────────────────────────────────────────

export type {
  StockMovementType,
  StockMovement,
  CreateStockMovementInput,
  GetStockMovementsOptions,
} from '@/database/schemas/stock_movements.schema';

// ─── Domain: Product Stock Addition audit row ─────────────────────────────────

/**
 * Domain representation of a `product_stock_additions` audit row.
 * Matches the camelCase shape expected by the UI and Zustand store.
 */
export interface ProductStockAddition {
  id:               string;
  productId:        string;
  productName:      string;
  unitsAdded:       number;
  notes?:           string;
  performedBy?:     string;
  ingredientsUsed?: Array<{
    ingredientId:   string;
    ingredientName: string;
    amountDeducted: number;
    unit:           string;
  }>;
  rawMaterialsUsed?: Array<{
    rawMaterialId:    string;
    rawMaterialName:  string;
    amountDeducted:   number;
    unit:             string;
  }>;
  addedAt:   string;
  createdAt: string;
  isSynced:  boolean;
}

// ─── Domain: Sales Target ────────────────────────────────────────────────────

/**
 * Persisted sales target configuration.
 * A single singleton row is stored in the `sales_targets` SQLite table (id = 1).
 * `target_product_id` is optional: when set, units_needed is derived from that
 * specific product's net income per unit; when absent the store uses the
 * blended contribution margin across all historical sales.
 */
export interface SalesTarget {
  id:                number;
  daily_target:      number;
  /** Optional FK by value to inventory_items.id */
  target_product_id?: string;
  created_at:        string; // ISO 8601
  updated_at:        string; // ISO 8601
}

/**
 * Period-level progress snapshot for the sales target feature.
 * `units_needed` is the forward-looking target (how many units to sell).
 * `units_sold` is the actual count in that period (from completed orders).
 * `percentage` is capped at 100 for progress-bar display purposes.
 */
export interface SalesTargetProgressPeriod {
  target:       number;
  actual:       number;
  percentage:   number;
  units_needed: number;
  units_sold:   number;
}

export interface SalesTargetProgress {
  daily:   SalesTargetProgressPeriod;
  weekly:  SalesTargetProgressPeriod;
  monthly: SalesTargetProgressPeriod;
}

// ─── Domain: Target Sales (normalised DB records) ─────────────────────────────

/**
 * Domain representation of a `target_sales_plans` row.
 * One record per calendar date — the header for a daily unit allocation plan.
 */
export interface TargetSalesPlanRecord {
  id:               string;
  /** Calendar date this plan covers — "YYYY-MM-DD". */
  planDate:         string;
  totalTargetUnits: number;
  strategy:         'EVEN' | 'WEIGHTED' | 'SMART_NEXT_DAY';
  status:           'DRAFT' | 'ACTIVE' | 'COMPLETED';
  createdAt:        string; // ISO 8601
  updatedAt:        string; // ISO 8601
  isSynced:         0 | 1;
  /** Set when soft-deleted; omitted when the row is live. */
  deletedAt?:       string;
}

/**
 * Domain representation of a `target_sales_items` row.
 * Per-product allocation within a `target_sales_plans` record.
 */
export interface TargetSalesItemRecord {
  id:              string;
  planId:          string;
  productId:       string;
  /** Snapshot of inventory_items.name at plan creation time. */
  productName:     string;
  allocatedUnits:  number;
  actualUnitsSold: number;
  /** 0.0–1.0; all items within a plan sum to 1.0. */
  weight:          number;
  createdAt:       string; // ISO 8601
  updatedAt:       string; // ISO 8601
}

/**
 * Domain representation of a `daily_sales_summary` row.
 * One row per (calendar date, product) pair — used by the weighted allocation
 * algorithm to determine each product's sales velocity.
 */
export interface DailySalesSummaryRecord {
  id:          string;
  summaryDate: string; // YYYY-MM-DD
  productId:   string;
  /** Snapshot of inventory_items.name at summary write time. */
  productName: string;
  unitsSold:   number;
  revenue:     number;
  createdAt:   string; // ISO 8601
  updatedAt:   string; // ISO 8601
  isSynced:    0 | 1;
}

// ─── Domain: Target Sales Allocation ─────────────────────────────────────────

/**
 * Identifies which allocation algorithm was used to produce a set of
 * `ProductTarget` records. Stored on `TargetSalesPlan` so the UI can surface
 * the strategy to the user and so future syncs can re-verify the logic.
 *
 *   'even'       — units divided equally across all selected products
 *                  (base case when no prior-day sales exist).
 *   'weighted'   — units distributed proportionally to each product's
 *                  previous-day sales volume (products that sold more get
 *                  a higher unit target for the coming day).
 *   'smart'      — weighted allocation with an additional day-of-week
 *                  multiplier applied before the largest-remainder round
 *                  (e.g. +10 % on weekends for fast movers).
 */
export type AllocationStrategy = 'even' | 'weighted' | 'smart';

/**
 * The unit target assigned to a single product within a `TargetSalesPlan`.
 * All quantities are whole-number units (not pesos) — the caller decides how
 * to convert to revenue using each product's price.
 */
export interface ProductTarget {
  /** FK to `inventory_items.id`. */
  productId:   string;
  /** Snapshot of `inventory_items.name` at plan-creation time. */
  productName: string;
  /** Units this product must sell to contribute its share of the total target. */
  targetUnits: number;
  /**
   * Previous-day units sold — used as the weight for 'weighted' and 'smart'
   * strategies. Zero when no prior sales exist (causes even fallback).
   */
  previousDayUnits: number;
  /**
   * The multiplier applied by the 'smart' strategy (day-of-week adjustment).
   * Always 1.0 for 'even' and 'weighted' strategies.
   */
  multiplier: number;
}

/**
 * A saved target sales plan — the full record written to `target_sales_plans`
 * SQLite table by the store and displayed in the Target Sales screen.
 *
 * Design notes:
 *   - `totalTargetUnits` is the user-entered integer (e.g. 200 units for the day).
 *   - `products` is a JSON-serialised array of `ProductTarget` records.
 *   - The sum of `products[].targetUnits` is guaranteed to equal `totalTargetUnits`
 *     (enforced by the allocation algorithm's largest-remainder rounding).
 */
export interface TargetSalesPlan {
  id:               string;
  /** Calendar date this plan applies to — "YYYY-MM-DD" local time. */
  targetDate:       string;
  totalTargetUnits: number;
  strategy:         AllocationStrategy;
  products:         ProductTarget[];
  createdAt:        string; // ISO 8601
  updatedAt:        string; // ISO 8601
}

/**
 * Zustand state shape for the Target Sales Allocation store.
 * Extends the existing income-based `SalesTargetState` (which handles ₱ targets)
 * with per-product unit allocation planning.
 */
export interface TargetSalesAllocationState {
  // ── Setup inputs ──────────────────────────────────────────────────────────
  /** Products the user has selected for this plan. */
  selectedProducts:  InventoryItem[];
  /** Total units the user wants to sell across all selected products. */
  totalTargetUnits:  number;
  /** Local "YYYY-MM-DD" date this plan is targeting. */
  targetDate:        string;

  // ── Computed outputs ──────────────────────────────────────────────────────
  /** Allocation results — one entry per `selectedProducts` element. */
  allocations:       ProductTarget[];
  /** Which strategy produced the current `allocations`. */
  strategy:          AllocationStrategy;

  // ── Persisted plans ───────────────────────────────────────────────────────
  /** All saved plans, ordered by targetDate DESC. Loaded on store init. */
  savedPlans:        TargetSalesPlan[];

  // ── Status ────────────────────────────────────────────────────────────────
  isLoading:  boolean;
  isSaving:   boolean;
  error:      string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setSelectedProducts: (products: InventoryItem[]) => void;
  setTotalTargetUnits: (units: number) => void;
  setTargetDate:       (date: string) => void;
  /** Runs the allocation algorithm and updates `allocations` + `strategy`. */
  computeAllocations:  () => Promise<void>;
  /** Persists the current plan to SQLite. Calls `computeAllocations` first if allocations are stale. */
  saveTargetSales:     () => Promise<void>;
  /** Loads all saved plans from SQLite into `savedPlans`. */
  loadTargetSales:     () => Promise<void>;
  /** Deletes a saved plan by id. */
  deletePlan:          (id: string) => Promise<void>;
}

// ─── Domain: Suki (Loyal Customer) ───────────────────────────────────────────

export type CustomerVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Customer {
  id: string;
  businessOwnerId: string;
  username: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  profilePictureUrl?: string;
  verificationStatus: CustomerVerificationStatus;
  verifiedAt?: string;
  rejectionReason?: string;
  payLaterEnabled: boolean;
  firstLoginCompleted: boolean;
  firstLoginAt?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQrToken {
  id: string;
  customerId: string;
  token: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface CustomerSummary {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  profilePictureUrl?: string;
  verificationStatus: CustomerVerificationStatus;
  payLaterEnabled: boolean;
  firstLoginCompleted: boolean;
  createdAt: string;
  totalOrders?: number;
}

export interface CustomerDetail extends CustomerSummary {
  username: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  firstLoginAt?: string;
  idDocument?: CustomerIdDocument;
}

export interface CustomerIdDocument {
  id: string;
  customerId: string;
  idFrontPath?: string;
  idBackPath?: string;
  selfiePath?: string;
  ocrFullName?: string;
  ocrBirthDate?: string;
  ocrIdNumber?: string;
  ocrIdType?: 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'SSS' | 'PHILHEALTH' | 'PASSPORT' | 'OTHER';
  ocrRawText?: string;
  livenessPassed: boolean;
  livenessAt?: string;
  livenessFrames?: number;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineCatalogItem {
  id: string;
  businessOwnerId: string;
  productId: string;
  productName: string;
  productBarcode?: string;
  productImageUrl?: string;
  customPrice?: number;
  isAvailable: boolean;
  /** Owner's on-hand stock snapshot; customers cannot order beyond this. */
  stockQuantity: number;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineOrder {
  id: string;
  businessOwnerId: string;
  customerId: string;
  orderNumber: string;
  orderDate: string;
  orderStatus: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  paymentMethod: 'PAY_NOW' | 'PAY_LATER';
  paymentStatus: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID';
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  customerNotes?: string;
  confirmedAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineOrderItem {
  id: string;
  orderId: string;
  catalogItemId?: string;
  productId: string;
  productName: string;
  productBarcode?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockReduced: boolean;
  createdAt: string;
}

/** Order lifecycle (business-owner workflow). COMPLETED / CANCELLED are terminal. */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIALLY_PAID';

/** A line item as returned to the business owner (GET /orders/business[/:id]). */
export interface BusinessOrderItem {
  id: string;
  productId: string;
  productName: string;
  productBarcode?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  catalogItemId?: string | null;
}

/**
 * An online order from the business owner's perspective, with line items and the
 * placing customer's name/phone. Money fields are normalized to numbers in the
 * service layer (the API serializes DECIMALs as strings).
 */
export interface BusinessOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  businessOwnerId: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: 'PAY_NOW' | 'PAY_LATER';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  customerNotes?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderDate: string;
  confirmedAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BusinessOrderItem[];
}

export interface OnlineCartItem {
  catalogItem: OnlineCatalogItem;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function canUsePayLater(customer: Customer): boolean {
  return customer.verificationStatus === 'VERIFIED' && customer.payLaterEnabled;
}

/**
 * Input payload when a business owner registers a customer on their behalf.
 * Passed to the `register-customer` Edge Function.
 * The business owner's authenticated JWT supplies `business_owner_id` server-side —
 * no businessCode field is needed because the owner is already identified by auth.uid().
 */
export interface BusinessRegisterCustomerInput {
  fullName: string;
  phoneNumber: string;
  username: string;
  password: string;
  email?: string;
}

/**
 * A trimmed, publicly safe view of a business used for the customer-side store search.
 * Exposes business_id (UUID) so registration can link by UUID — the 8-char code stays server-side.
 */
export interface BusinessSearchResult {
  businessId: string;
  businessCode: string;
  businessName: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type AppRoute =
  | '/onboarding'
  | '/(auth)/login'
  | '/(app)/(tabs)'
  | '/(app)/(tabs)/notifications'
  | '/(app)/(tabs)/profile'
  | '/(app)/(tabs)/inventory'
  | '/(app)/(tabs)/inventory/add'
  | '/(app)/(tabs)/inventory/production'
  | '/(app)/(tabs)/inventory/ingredient-logs';

export interface NavigationItem {
  name: string;
  href: AppRoute;
  icon: string;
  label: string;
}

// ─── UI Primitives ───────────────────────────────────────────────────────────

export interface ComponentProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface ButtonProps extends ComponentProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}

export interface CardProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onPress?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: Record<number, string>;
  secondary: Record<number, string>;
  gray: Record<number, string>;
  error: Record<number, string>;
  warning: Record<number, string>;
  success: Record<number, string>;
  info: Record<number, string>;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  disabled: string;
  placeholder: string;
  white: string;
  black: string;
}
