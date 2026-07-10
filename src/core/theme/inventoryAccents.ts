/**
 * inventoryAccents — single source of truth for inventory category accents and
 * stock-health colors.
 *
 * Consolidates the neon-accent hex + stock-health palettes that were previously
 * duplicated across:
 *   - inventory/index.tsx              (category nav + stat accents)
 *   - CategoryInventoryScreen.tsx      (CATEGORY_CONFIG)
 *   - InventoryItemCard.tsx            (DARK/LIGHT_CATEGORY_CONFIG + getHealthColors)
 * and matching the values used in production / consumption / raw-materials screens
 * (those screens are out of scope for the redesign but can consume this later).
 *
 * Dark accents for product/ingredient/equipment are sourced from the theme's
 * `tint*` tokens so brand identity stays in one place; the extra categories that
 * have no theme token are defined here.
 */

import { theme, darkTheme } from './index';
import {
  Package,
  Wheat,
  Wrench,
  Factory,
  ClipboardList,
  Layers,
} from 'lucide-react-native';
import type { InventoryItem } from '@/types';

// ─── Keys ──────────────────────────────────────────────────────────────────────

export type InventoryAccentKey =
  | 'product'
  | 'ingredient'
  | 'equipment'
  | 'production'
  | 'consumption'
  | 'rawMaterials';

type LucideIcon = React.ComponentType<{ size: number; color: string }>;

export interface ResolvedAccent {
  /** Primary accent color (icon, value text, border seed). */
  accent:  string;
  /** Subtle tinted background for hero/section surfaces. */
  heroBg:  string;
  /** Tinted background for icon chips. */
  iconBg:  string;
  /** Slightly stronger tint for glow borders. */
  glow:    string;
  /** Category icon. */
  Icon:    LucideIcon;
  /** Singular category label. */
  label:   string;
}

// ─── Base accent colors ─────────────────────────────────────────────────────────
// Dark: brand tints come from the theme; the 3 extras are defined here.
const DARK_ACCENTS: Record<InventoryAccentKey, string> = {
  product:      darkTheme.colors.tintPrimary,   // #4F9EFF
  ingredient:   darkTheme.colors.tintAccent,    // #3DD68C
  equipment:    darkTheme.colors.tintHighlight, // #FFB020
  production:   '#C084FC',
  consumption:  '#FB923C',
  rawMaterials: '#38BDF8',
};

const LIGHT_ACCENTS: Record<InventoryAccentKey, string> = {
  product:      theme.colors.primary[500],
  ingredient:   theme.colors.success[500],
  equipment:    theme.colors.highlight[400],
  production:   theme.colors.secondary[500],
  consumption:  theme.colors.warning[500],
  rawMaterials: '#0EA5E9',
};

const ICONS: Record<InventoryAccentKey, LucideIcon> = {
  product:      Package,
  ingredient:   Wheat,
  equipment:    Wrench,
  production:   Factory,
  consumption:  ClipboardList,
  rawMaterials: Layers,
};

const LABELS: Record<InventoryAccentKey, string> = {
  product:      'Product',
  ingredient:   'Ingredient',
  equipment:    'Equipment',
  production:   'Production',
  consumption:  'Consumption',
  rawMaterials: 'Raw Material',
};

/** Append an 8-digit-hex alpha to a `#RRGGBB` color. */
const withAlpha = (hex: string, alpha: string): string => `${hex}${alpha}`;

/**
 * Resolve the accent bundle for a category in the active mode.
 * Tints are derived from the accent via alpha so light and dark stay consistent.
 */
export function getInventoryAccent(key: InventoryAccentKey, isDark: boolean): ResolvedAccent {
  const accent = (isDark ? DARK_ACCENTS[key] : LIGHT_ACCENTS[key]);
  return {
    accent,
    heroBg: withAlpha(accent, isDark ? '14' : '12'),
    iconBg: withAlpha(accent, isDark ? '24' : '1A'),
    glow:   withAlpha(accent, isDark ? '33' : '2B'),
    Icon:   ICONS[key],
    label:  LABELS[key],
  };
}

// ─── Stock health ───────────────────────────────────────────────────────────────

export type StockHealth = 'out' | 'low' | 'healthy';

export interface StockHealthColors {
  text:   string;
  bg:     string;
  border: string;
  bar:    string;
  barBg:  string;
}

/** Classify an item's stock health (out → low → healthy). */
export function getStockHealth(
  item: Pick<InventoryItem, 'quantity' | 'reorderLevel'>,
): StockHealth {
  if (item.quantity === 0) return 'out';
  if (item.reorderLevel !== undefined && item.quantity <= item.reorderLevel) return 'low';
  return 'healthy';
}

const DARK_HEALTH: Record<StockHealth, StockHealthColors> = {
  out:     { text: '#FF6B6B', bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.35)', bar: '#FF6B6B', barBg: 'rgba(255,107,107,0.12)' },
  low:     { text: '#FFB020', bg: 'rgba(255,176,32,0.15)',  border: 'rgba(255,176,32,0.35)',  bar: '#FFB020', barBg: 'rgba(255,176,32,0.12)' },
  healthy: { text: '#3DD68C', bg: 'rgba(61,214,140,0.13)',  border: 'rgba(61,214,140,0.30)',  bar: '#3DD68C', barBg: 'rgba(61,214,140,0.10)' },
};

const LIGHT_HEALTH: Record<StockHealth, StockHealthColors> = {
  out:     { text: theme.colors.error[500],   bg: theme.colors.error[50],   border: theme.colors.error[200],   bar: theme.colors.error[500],   barBg: theme.colors.error[100] },
  low:     { text: theme.colors.warning[600], bg: theme.colors.warning[50], border: theme.colors.warning[200], bar: theme.colors.warning[500], barBg: theme.colors.warning[100] },
  healthy: { text: theme.colors.success[600], bg: theme.colors.success[50], border: theme.colors.success[200], bar: theme.colors.success[500], barBg: theme.colors.success[100] },
};

/** Resolve the stock-health palette for the active mode. */
export function getStockHealthColors(health: StockHealth, isDark: boolean): StockHealthColors {
  return isDark ? DARK_HEALTH[health] : LIGHT_HEALTH[health];
}
