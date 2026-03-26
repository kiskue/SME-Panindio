/**
 * roi.schema.ts
 *
 * Single-table schema for the ROI Scenarios module.
 *
 * Design principles:
 *   - `roi_scenarios` stores named snapshots of the ROI calculator state.
 *     A scenario is immutable from a ledger standpoint — the inputs, results,
 *     and insight that were true when the user saved it are preserved.
 *   - `inputs_json`, `results_json`, and `scenarios_json` store the full
 *     TypeScript objects serialised to JSON. This avoids N extra columns for
 *     each formula input and keeps the schema stable as the formula evolves.
 *   - SQLite does not enforce JSON column types — the repository is the
 *     single point responsible for serialisation and deserialisation.
 *   - `is_synced` tracks background Supabase sync status (consistent with
 *     every other table in this project).
 *   - Dates are TEXT (ISO 8601) — consistent with every other table in this
 *     project.
 */

// ─── roi_scenarios ────────────────────────────────────────────────────────────

export const roiScenariosSchema = `
  CREATE TABLE IF NOT EXISTS roi_scenarios (
    id             TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    inputs_json    TEXT    NOT NULL,
    results_json   TEXT    NOT NULL,
    scenarios_json TEXT    NOT NULL,
    insight        TEXT    NOT NULL DEFAULT '',
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL,
    is_synced      INTEGER NOT NULL DEFAULT 0
  );
`;

export const roiScenariosIndexes: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_roi_scenarios_created_at
     ON roi_scenarios (created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_roi_scenarios_name
     ON roi_scenarios (name COLLATE NOCASE);`,
  `CREATE INDEX IF NOT EXISTS idx_roi_scenarios_is_synced
     ON roi_scenarios (is_synced);`,
];

// ─── Row type (raw SQLite row — snake_case) ───────────────────────────────────

/** Raw DB row for `roi_scenarios`. */
export interface ROIScenarioRow {
  id:             string;
  name:           string;
  /** JSON-serialised ROIInputs object. */
  inputs_json:    string;
  /** JSON-serialised ROIResults object. */
  results_json:   string;
  /** JSON-serialised ROIScenarios object. */
  scenarios_json: string;
  insight:        string;
  created_at:     string;
  updated_at:     string;
  is_synced:      0 | 1;
}
