---
name: CategoryNavCard count badge wiring
description: The Consumption Logs CategoryNavCard in inventory/index.tsx had count={0} hardcoded; must use selectConsumptionTotalCount from the store.
type: project
---

The `CategoryNavCard` for "Consumption Logs" in `src/app/(app)/(tabs)/inventory/index.tsx` originally had `count={0}` hardcoded at line ~562. Every other card (Products, Ingredients, Equipment, Production) derives its count from a live store selector. This one was never wired up.

**Fix:** import `useIngredientConsumptionStore` and `selectConsumptionTotalCount` from `@/store`, call the selector in the component body, and pass `consumptionTotalCount` to the card's `count` prop.

**Why:** Developer added the card as a placeholder and forgot to wire the count. The store (`ingredient_consumption.store.ts`) and its `selectConsumptionTotalCount` selector already existed and were already called correctly on the ingredient-logs screen itself — the inventory overview screen just never consumed them.

**How to apply:** Any time a new CategoryNavCard is added to the inventory overview, ensure its `count` prop is sourced from the relevant store selector — never a literal number.
