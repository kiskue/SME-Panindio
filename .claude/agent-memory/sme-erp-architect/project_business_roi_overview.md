---
name: Business ROI Overview Module
description: Architecture decisions for the auto-aggregating Business ROI Overview store — data sources, computation model, and wiring conventions.
type: project
---

The Business ROI Overview module auto-aggregates real data from existing stores to compute an executive ROI picture without manual input. Distinct from the manual ROI Calculator (roi.store.ts).

**Files created:**
- `src/types/business_roi.types.ts` — ProductROIBreakdown, BusinessROIRiskLevel, BusinessROIData
- `src/store/business_roi.store.ts` — useBusinessROIStore, selectors
- Types re-exported from `src/types/index.ts`
- Store exported from `src/store/index.ts`

**Key architectural decisions:**

1. Read-only projection store — never writes to any SQLite table or creates a migration.

2. Data sources and how they are read:
   - Inventory value/equipment: `useInventoryStore.getState().items` (in-memory array)
   - Overhead summary: `useOverheadExpensesStore.getState().summary` (allTime, thisYear, thisMonth)
   - Utilities all-time: direct `getDatabase()` query (SUM all utility_logs); yearly via `getYearlySummary(year)` from utilities.repository
   - All-time sales totals + unit counts: direct SQLite queries on sales_orders + sales_order_items
   - All-time COGS: direct SQLite queries on ingredient_consumption_logs + raw_material_consumption_logs
   - Top products: direct SQLite query grouping sales_order_items by product_name, ORDER BY revenue DESC

3. `OverheadCategory` does NOT include 'equipment'. Equipment cost comes from inventory items with `category = 'equipment'` valued at `costPrice × quantity`.

4. NOT added to `initializeStores()` — computation requires all other stores to be fully hydrated. Call `computeBusinessROI()` explicitly from the screen's useEffect after `initializeStores()` resolves.

5. Monthly averages use `elapsedMonthsThisYear()` = `max(1, currentMonth)` to avoid divide-by-zero in January.

6. Top product contribution margin = revenue - (costPrice × unitsSold), where costPrice is looked up by matching product name (lowercased) against in-memory inventory items.

7. Risk thresholds: low = ROI >= 25% AND payback <= 12mo; high = ROI < 10% OR payback > 24mo OR netProfit < 0; medium = everything else.

8. AI insight covers: ROI vs SME benchmark, payback period, top product callout, breakeven gap, overhead-as-%-of-revenue health, burn rate vs revenue warning, gross margin note, high-risk flag.

**Why:** The user wanted a zero-input dashboard metric showing whether the business is ROI-positive. The manual calculator requires projections; this store uses actual ledger data.

**How to apply:** When adding new transaction types (e.g. purchase orders), consider whether their costs should feed into totalCOGS or totalOverheadAllTime in the aggregation queries. The COGS query currently sums ingredient_consumption_logs + raw_material_consumption_logs.
