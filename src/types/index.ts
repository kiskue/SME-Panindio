import { StyleProp, ViewStyle } from 'react-native';

// ─── Domain: Business Lookup Tables ──────────────────────────────────────────

/** Enterprise scale of the business (MSME classification). */
export type EnterpriseType = 'small' | 'medium';

/**
 * Row shape of the `public.business_types` lookup table.
 * pos_enabled indicates whether this business type may access the POS module.
 */
export interface BusinessType {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /** 'food_beverage' | 'retail' | 'services' | 'digital' | 'other' */
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
  /** Foreign key to public.job_roles.id */
  jobRoleId: number;
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

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  description?: string;
  quantity: number;
  unit: StockUnit;
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
 * Transient UI state for an ingredient row being built in the add/edit form.
 * Not persisted until the user saves the product.
 */
export interface SelectedIngredient {
  ingredientId:   string;
  ingredientName: string;
  quantityUsed:   number;
  unit:           string;
  costPrice?:     number; // per-unit cost from the ingredient inventory item
  lineCost:       number; // quantityUsed * (costPrice ?? 0)
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
