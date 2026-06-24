/**
 * roi.repository.ts
 *
 * All SQL for the ROI Scenarios module lives here.
 * No SQL may appear in screens, hooks, or stores — this is the sole
 * data-access boundary for the `roi_scenarios` table.
 *
 * Table:
 *   roi_scenarios — named snapshots of ROI calculator state
 *
 * Design decisions:
 *   - Inputs, results, and scenario comparisons are stored as JSON strings.
 *     The repository owns serialisation (→ JSON.stringify) and deserialisation
 *     (→ JSON.parse with typed assertions). No caller ever sees raw JSON.
 *   - JSON.parse failures are caught and wrapped in typed errors so the store
 *     always receives a clean exception message rather than a raw SyntaxError.
 *   - `listROIScenarios` returns scenarios ordered by created_at DESC so the
 *     most recent scenario is always first in the list.
 *   - There is no soft-delete — scenarios are hard-deleted. A scenario that is
 *     no longer needed can simply be removed; there is no ledger integrity
 *     constraint that requires preserving old rows.
 *   - TypeScript strict mode enforced throughout:
 *       exactOptionalPropertyTypes:  conditional spread for optional fields
 *       noUncheckedIndexedAccess:    ?? fallbacks on all row field access
 *       noUnusedLocals/Parameters:   unused params prefixed with _
 */

import { getDatabase } from '../database';
import type { ROIScenarioRow } from '../schemas/roi.schema';
import type {
  ROIScenario,
  ROIInputs,
  ROIResults,
  ROIScenarios,
  CreateROIScenarioInput,
} from '@/types';

// ─── ID helper ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function parseInputs(json: string): ROIInputs {
  try {
    return JSON.parse(json) as ROIInputs;
  } catch {
    throw new Error(`roi_scenarios: failed to parse inputs_json — ${json.slice(0, 80)}`);
  }
}

function parseResults(json: string): ROIResults {
  try {
    return JSON.parse(json) as ROIResults;
  } catch {
    throw new Error(`roi_scenarios: failed to parse results_json — ${json.slice(0, 80)}`);
  }
}

function parseScenarios(json: string): ROIScenarios {
  try {
    return JSON.parse(json) as ROIScenarios;
  } catch {
    throw new Error(`roi_scenarios: failed to parse scenarios_json — ${json.slice(0, 80)}`);
  }
}

// ─── Row → Domain mapper ──────────────────────────────────────────────────────

function rowToDomain(row: ROIScenarioRow): ROIScenario {
  return {
    id:          row.id,
    name:        row.name,
    inputs:      parseInputs(row.inputs_json),
    results:     parseResults(row.results_json),
    scenarioCmp: parseScenarios(row.scenarios_json),
    insight:     row.insight,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Inserts a new ROI scenario and reads it back.
 *
 * @throws If the insert fails or the readback returns null.
 */
export async function createROIScenario(
  input: CreateROIScenarioInput,
): Promise<ROIScenario> {
  const db  = await getDatabase();
  const id  = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO roi_scenarios
       (id, name, inputs_json, results_json, scenarios_json, insight, created_at, updated_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.name,
      JSON.stringify(input.inputs),
      JSON.stringify(input.results),
      JSON.stringify(input.scenarioCmp),
      input.insight,
      now,
      now,
    ],
  );

  const row = await db.getFirstAsync<ROIScenarioRow>(
    'SELECT * FROM roi_scenarios WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`roi_scenarios: readback after insert failed for id=${id}`);
  }

  return rowToDomain(row);
}

/**
 * Updates the name of an existing ROI scenario.
 * Only the name is mutable after creation — the snapshot data is immutable.
 *
 * @throws If the scenario does not exist.
 */
export async function renameROIScenario(
  id:   string,
  name: string,
): Promise<ROIScenario> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE roi_scenarios
     SET name       = ?,
         updated_at = ?,
         is_synced  = 0
     WHERE id = ?`,
    [name, now, id],
  );

  const row = await db.getFirstAsync<ROIScenarioRow>(
    'SELECT * FROM roi_scenarios WHERE id = ?',
    [id],
  );

  if (row == null) {
    throw new Error(`roi_scenarios: scenario not found after rename for id=${id}`);
  }

  return rowToDomain(row);
}

/**
 * Permanently deletes an ROI scenario.
 * Hard delete — no soft-delete needed (scenarios carry no ledger relationships).
 */
export async function deleteROIScenario(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM roi_scenarios WHERE id = ?', [id]);
}

/**
 * Returns a single ROI scenario by ID, or null if not found.
 */
export async function getROIScenarioById(id: string): Promise<ROIScenario | null> {
  const db  = await getDatabase();
  const row = await db.getFirstAsync<ROIScenarioRow>(
    'SELECT * FROM roi_scenarios WHERE id = ?',
    [id],
  );

  return row != null ? rowToDomain(row) : null;
}

/**
 * Returns all saved ROI scenarios, newest first.
 * This is the list shown on the Saved Scenarios screen.
 *
 * @param limit  Maximum number of rows to return. Default: 50.
 * @param offset Row offset for pagination. Default: 0.
 */
export async function listROIScenarios(
  limit  = 50,
  offset = 0,
): Promise<ROIScenario[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ROIScenarioRow>(
    `SELECT * FROM roi_scenarios
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return rows.map(rowToDomain);
}

/**
 * Returns the total count of saved ROI scenarios.
 * Used for pagination — combine with listROIScenarios(limit, offset).
 */
export async function countROIScenarios(): Promise<number> {
  const db = await getDatabase();

  interface CountRow { total: number }
  const row = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) AS total FROM roi_scenarios',
  );

  return row?.total ?? 0;
}
