---
name: ROI Calculator Module
description: Architecture decisions for the ROI Calculator module — formula engine, persistence schema, AI insight engine, store design, and type contract.
type: project
---

The ROI Calculator module (migration 017) is a planning/forecasting tool distinct from all other ERP modules — it is NOT a ledger, it stores named scenario snapshots.

**Why:** SME owners need to evaluate equipment investment before purchasing. The module gives them breakeven projections, payback period, and AI-driven natural language insights without any external API.

**How to apply:** When extending or modifying ROI screens, always consume the store through the declared `ROIStoreState & ROIStoreActions` interface in `roi.types.ts`. The UI architect has pre-built screens against that contract.

## Type contract (roi.types.ts)

The UI architect pre-defined these shapes — they are the authoritative contract:

```
ROIInputs        — 7 fields: equipmentCost, setupCost, monthlyOverhead,
                   costPerUnit, sellingPrice, monthlyVolume, targetROIPercent
ROIResults       — breakevenUnits, breakevenMonths, breakevenDays, grossMargin,
                   contributionMargin, projectedROI (Record<1|3|6|12|24, number>),
                   paybackPeriod, riskLevel
ROIRiskLevel     — 'low' | 'medium' | 'high'
ROIScenarioItem  — label, price, roi, breakevenMonths, unitsNeeded, grossMargin, riskLevel
ROIScenarios     — current, optimistic, conservative (all ROIScenarioItem)
ROIStoreState    — inputs, results, scenarios, insight, isLoading
ROIStoreActions  — setROIInputs, computeROI, generateAIInsight, saveScenario
```

We extended the types file (without breaking the contract) to add persistence types:
```
ROIScenario            — id, name, inputs, results, scenarioCmp, insight, createdAt, updatedAt
CreateROIScenarioInput — name, inputs, results, scenarioCmp, insight
UpdateROIScenarioNameInput — name
```

## Schema (roi.schema.ts)

Single table `roi_scenarios` (migration 017). Inputs, results, and scenario comparison are stored as JSON strings (`inputs_json`, `results_json`, `scenarios_json`) to avoid wide tables and keep schema stable as formulas evolve. Hard-delete (no soft-delete needed — no ledger FK constraints).

## Formula engine

Standard SME accounting:
- contributionMargin = sellingPrice − costPerUnit
- grossMargin % = contributionMargin / sellingPrice × 100
- breakevenUnits = monthlyOverhead / contributionMargin
- monthlyProfit = monthlyVolume × contributionMargin − monthlyOverhead
- paybackPeriod = totalInvestment / monthlyProfit
- projectedROI(N) = (monthlyProfit × N − totalInvestment) / totalInvestment × 100

Risk level: high (payback > 18mo OR margin < 20%), medium (6–18mo OR 20–35%), low (<= 6mo AND >= 35%).

Three-scenario comparison: current, optimistic (+10% price), conservative (-10% price).

## Store design

`useROIStore` wraps `ROIStoreState & ROIStoreActions` with persistence extensions:
- `savedScenarios: ROIScenario[]` — loaded from SQLite on boot
- `isScenariosLoading`, `error` — persistence operation states
- `initializeROIStore()` — called by `initializeStores()` at app boot
- `removeSavedScenario(id)`, `renameSavedScenario(id, name)`, `loadSavedScenario(scenario)`, `resetInputs()`, `clearError()`

Uses `persist` middleware with AsyncStorage to survive app restarts (inputs only — results always recomputed).

## AI insight engine

Rule-based local engine in `buildInsight(inputs, results)` in roi.store.ts. No external API. Produces a single string (sentences joined by spaces) covering:
1. Primary breakeven summary with daily unit rate
2. Margin health vs 20%/35% benchmarks
3. Material cost sensitivity (10% reduction scenario — quantified in months)
4. Target ROI timeline (monthsToTarget at current volume)
5. Optimistic price note (10% price raise effect on payback)
6. Risk warning when riskLevel = 'high'

## Files

- `src/types/roi.types.ts` — extended with persistence types (ROIScenario, CreateROIScenarioInput, UpdateROIScenarioNameInput)
- `database/schemas/roi.schema.ts` — single-table schema + row type
- `database/migrations/017_add_roi_scenarios.ts` — migration
- `database/repositories/roi.repository.ts` — CRUD + listROIScenarios + countROIScenarios
- `src/store/roi.store.ts` — full store replacing the stub saveScenario with real SQLite persistence
- `database/registry/schemaRegistry.ts` — roi_scenarios registered
- `src/store/index.ts` — ROI store exported + initializeROIStore in initializeStores()
- `src/types/index.ts` — ROI types re-exported from barrel
