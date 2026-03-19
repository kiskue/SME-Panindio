---
name: Consumption Summary Reason Filter
description: getRawMaterialConsumptionSummary must accept an optional reason filter; without it the per-material totals always include all reasons even when the UI is filtered to waste-only, making the cost figures misleading.
type: project
---

`getRawMaterialConsumptionSummary(reason?)` in `database/repositories/raw_materials.repository.ts` accepts an optional reason to filter the per-material aggregates. Without this, the "By Material" summary section and the filtered "Total Cost" pill would always show all-reason totals regardless of which filter chip the user has active.

**Why:** When only one raw material has ever been wasted, `summary.reduce(totalCost)` equalled that single material's all-reason cost — which looked like "only one item's waste cost" instead of the true waste total across all materials and events. The fix passes `filters.reason` from `fetchSupportingData(filters)` in the store so per-material summary totals always match the active filter.

**How to apply:**
- `fetchSupportingData(filters)` in `raw_material_consumption_logs.store.ts` passes `filters.reason` to `getRawMaterialConsumptionSummary`.
- `getWasteRawMaterialCost()` is intentionally NOT filtered — it always returns the global waste total regardless of the active filter chip.
- The "Total Cost" pill label in `logs.tsx` is dynamic: "Waste Cost", "Adjustment Cost", etc. when a filter is active; "Total Cost" when no filter is active.
- Follow the `pattern_expo_sqlite_empty_params` convention: use spread `...(params.length > 0 ? [params] : [])` to avoid passing `[]` to `getAllAsync` when SQL has no bind markers.
