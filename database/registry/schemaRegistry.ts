/**
 * schemaRegistry.ts
 *
 * Central registry of every SQLite table managed by this app.
 * `initDatabase.ts` iterates this array to create tables and indexes
 * in the correct order on every app launch.
 *
 * RULES:
 *   - Never add a table here without a corresponding migration file.
 *   - Maintain insertion order to respect foreign-key constraints.
 *   - Table names must be globally unique — no silent overwrites.
 */

import {
  inventoryItemsSchema,
  inventoryItemsIndexes,
} from '../schemas/inventory_items.schema';
import {
  productIngredientsSchema,
  productIngredientsIndexes,
} from '../schemas/product_ingredients.schema';
import {
  productionLogsSchema,
  productionLogsIndexes,
  productionLogIngredientsSchema,
  productionLogIngredientsIndexes,
} from '../schemas/production_logs.schema';
import {
  ingredientConsumptionLogsSchema,
  ingredientConsumptionLogsIndexes,
} from '../schemas/ingredient_consumption_logs.schema';

// ADD NEW SCHEMA IMPORTS HERE

export interface SchemaEntry {
  /** Exact table name as declared in the CREATE TABLE statement. */
  name: string;
  /** Full CREATE TABLE IF NOT EXISTS SQL string. */
  schema: string;
  /** Array of CREATE INDEX IF NOT EXISTS SQL strings. */
  indexes: string[];
}

export const schemaRegistry: SchemaEntry[] = [
  {
    name:    'inventory_items',
    schema:  inventoryItemsSchema,
    indexes: inventoryItemsIndexes,
  },
  {
    name:    'product_ingredients',
    schema:  productIngredientsSchema,
    indexes: productIngredientsIndexes,
  },
  {
    name:    'production_logs',
    schema:  productionLogsSchema,
    indexes: productionLogsIndexes,
  },
  {
    name:    'production_log_ingredients',
    schema:  productionLogIngredientsSchema,
    indexes: productionLogIngredientsIndexes,
  },
  {
    name:    'ingredient_consumption_logs',
    schema:  ingredientConsumptionLogsSchema,
    indexes: ingredientConsumptionLogsIndexes,
  },
  // REGISTER NEW SCHEMAS HERE
];
