---
name: Quantity Badge Sign Convention
description: The quantityConsumed badge in IngredientConsumptionLogCard uses < 0 (not > 0) as the condition for the negative-sign branch; the original code had the ternary inverted, producing "+0" for zero-quantity rows and "+N" for RETURN events.
type: project
---

The quantity badge in `src/components/organisms/IngredientConsumptionLogCard.tsx` must use:

```tsx
{item.quantityConsumed < 0
  ? `-${Math.abs(item.quantityConsumed)}`
  : String(item.quantityConsumed)}
```

**Why:** `quantityConsumed` is positive for all normal consumption triggers (PRODUCTION, MANUAL_ADJUSTMENT, WASTAGE, TRANSFER) and negative for RETURN events (stock flowing back). The original code had `> 0` in the condition, which meant the `+` prefix was incorrectly applied to the else branch — rendering "+0" for zero-quantity rows and "+N" for returns instead of "-N".

**How to apply:** Whenever rendering `quantityConsumed` in any consumption-log card or summary row, check `< 0` first and apply the minus sign explicitly. Never use the `+` prefix — the accent color and trigger label already communicate direction.
