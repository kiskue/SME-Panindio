---
name: Overhead Expenses Module
description: Architecture, schema, and wiring decisions for the overhead_expenses module (migration 014)
type: project
---

Overhead Expenses is an immutable append-only ledger for occupancy and operational fixed costs (rent, renovation, utilities, insurance, maintenance, other). Migration 014, registered in schemaRegistry and initDatabase.

**Key architectural decisions:**

- Entries are immutable. No UPDATE path. Corrections are new entries with corrective notes.
- `frequency` field (`one_time | monthly | quarterly | annual`) is informational only — the app never auto-generates future entries (MVP constraint).
- `is_recurring` (INTEGER 0/1) is a flag for the owner to identify fixed monthly obligations.
- `expense_date` is the business event timestamp; `created_at` is the DB write timestamp.
- Dashboard KPIs `overheadThisMonth` / `overheadThisYear` come from `getOverheadExpenseSummary()` which uses CASE aggregation with `LIKE '%Y-MM-%'` prefix matching on the TEXT `expense_date` column — one DB round-trip for all three buckets (thisMonth, thisYear, allTime).
- The dashboard screen reads overhead KPIs from `kpis.overheadThisMonth/Year` (populated by `getDashboardData → getOverheadExpenseSummary` in the repository's Promise.all). No separate overhead store subscription on the dashboard.
- The overhead screen (`overhead.tsx`) uses `useOverheadExpensesStore` with store-side `setFilters` for category filtering (repository-side SQL WHERE) — not client-side array filtering.

**Files:**
- `database/schemas/overhead_expenses.schema.ts` — table DDL + OverheadExpenseRow type
- `database/migrations/014_add_overhead_expenses.ts` — migration (version 14)
- `database/repositories/overhead_expenses.repository.ts` — createOverheadExpense, getOverheadExpenses, getOverheadExpenseCount, getOverheadExpenseSummary, getMonthlyOverheadBreakdown
- `src/types/overhead_expenses.types.ts` — OverheadExpense, CreateOverheadExpenseInput, GetOverheadExpensesOptions, OverheadExpenseSummary, MonthlyOverheadPoint
- `src/store/overhead_expenses.store.ts` — paginated store with summary, setFilters, logExpense

**Stale files deleted (linter-generated drafts):**
- `src/types/overhead.types.ts` — wrong `frequency: 'one-time'` (hyphen), had `updatedAt` field, missing `isSynced`
- `src/store/overhead.store.ts` — AsyncStorage stub with mutable updateExpense/deleteExpense (violated immutability rule)

**Why:** frequency underscore (`one_time`) is the correct value matching the DB column constraint — the stale file used a hyphen which would not match the TypeScript union type.
