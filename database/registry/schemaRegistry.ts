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
import {
  salesOrdersSchema,
  salesOrdersIndexes,
  salesOrderItemsSchema,
  salesOrderItemsIndexes,
} from '../schemas/sales_orders.schema';
import {
  utilityTypesSchema,
  utilityTypesIndexes,
  utilityLogsSchema,
  utilityLogsIndexes,
} from '../schemas/utilities.schema';
import {
  rawMaterialsSchema,
  rawMaterialsIndexes,
} from '../schemas/raw_materials.schema';
import {
  productRawMaterialsSchema,
  productRawMaterialsIndexes,
} from '../schemas/product_raw_materials.schema';
import {
  rawMaterialConsumptionLogsSchema,
  rawMaterialConsumptionLogsIndexes,
} from '../schemas/raw_material_consumption_logs.schema';

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
  {
    name:    'sales_orders',
    schema:  salesOrdersSchema,
    indexes: salesOrdersIndexes,
  },
  {
    name:    'sales_order_items',
    schema:  salesOrderItemsSchema,
    indexes: salesOrderItemsIndexes,
  },
  {
    name:    'utility_types',
    schema:  utilityTypesSchema,
    indexes: utilityTypesIndexes,
  },
  {
    name:    'utility_logs',
    schema:  utilityLogsSchema,
    indexes: utilityLogsIndexes,
  },
  {
    name:    'raw_materials',
    schema:  rawMaterialsSchema,
    indexes: rawMaterialsIndexes,
  },
  {
    name:    'product_raw_materials',
    schema:  productRawMaterialsSchema,
    indexes: productRawMaterialsIndexes,
  },
  {
    name:    'raw_material_consumption_logs',
    schema:  rawMaterialConsumptionLogsSchema,
    indexes: rawMaterialConsumptionLogsIndexes,
  },
  // REGISTER NEW SCHEMAS HERE
];
