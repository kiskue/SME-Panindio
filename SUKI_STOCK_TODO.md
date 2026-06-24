# Suki Catalog — Stock-Aware Ordering — Change Tracker

> **Goal:** When a business owner adds a product to the online catalog, capture its
> on-hand stock. Customers see the stock and can never add to cart / order more
> than is available. Stock is validated again server-side at checkout.
>
> **Status:** Code complete. **One manual DB step is required** on every existing
> environment (see "⚠️ Schema change" below) because the backend runs with
> TypeORM `synchronize: false` — the schema is the hand-written
> `Sme-Server/database/schema.sql`, applied manually (DBeaver).

---

## ⚠️ Schema change (MUST be applied manually to each DB)

A new column was added to `online_catalog`:

```sql
-- New / freshly-seeded databases: already included in database/schema.sql.
-- EXISTING databases: run this once (idempotent-safe to run on a DB without it).
ALTER TABLE online_catalog
  ADD COLUMN stock_quantity INT NOT NULL DEFAULT 0 AFTER is_available;
```

- [x] `Sme-Server/database/schema.sql` — column added to the `CREATE TABLE`.
- [x] `Sme-Server/src/entities/online-catalog.entity.ts` — `stockQuantity` column mapped.
- [ ] **Run the `ALTER TABLE` above on each existing MySQL database** (dev / staging / prod).
      Until this runs, the API will error on catalog reads/writes against an old schema.

Rollback (if ever needed): `ALTER TABLE online_catalog DROP COLUMN stock_quantity;`

---

## Backend (Sme-Server) — DONE

- [x] `entities/online-catalog.entity.ts` — add `stockQuantity` (`stock_quantity INT NOT NULL DEFAULT 0`).
- [x] `dto/upsert-catalog-item.dto.ts` — optional `stockQuantity` (`@IsInt @Min(0)`). Omitted on update → stock preserved.
- [x] `dto/set-availability.dto.ts` — optional `stockQuantity` so re-enabling a product refreshes stock.
- [x] `catalog.service.ts`
  - [x] `OnlineCatalogItem` interface + `toItem()` expose `stockQuantity`.
  - [x] `upsert()` persists stock (new row) / preserves it when omitted (existing row).
  - [x] `setAvailability()` updates stock when supplied.
- [x] `orders.service.ts` `placeOrder()` — stock guard: total requested qty per product
      must be `<= stock_quantity`, else `400 INSUFFICIENT_STOCK { detail: productId, available, requested }`.
      Quantities are aggregated per product so split lines can't bypass the check.

### New API error code
- `INSUFFICIENT_STOCK` — returned by `POST /orders` when a line exceeds available stock.

---

## Frontend (SME-Panindio) — DONE

- [x] `types/index.ts` — `OnlineCatalogItem.stockQuantity: number` (required).
- [x] `features/business-suki/services/business_suki.service.ts`
  - [x] `normalizeCatalogItem()` coerces `stockQuantity` to a number.
  - [x] `upsertCatalogItem()` sends `stockQuantity`.
  - [x] `setCatalogItemAvailability()` accepts + sends optional `stockQuantity`.
- [x] `store/suki_business.store.ts` — `addProductToCatalog` / `toggleCatalogItem` thread `stockQuantity`.
- [x] `app/(app)/(tabs)/suki/catalog.tsx` (owner) — pushes the product's current local
      stock (`product.quantity`) on add **and** on availability toggle.
- [x] `app/(customer)/products.tsx` — maps `stockQuantity`; shows "N in stock" /
      "Only N left" (≤5) / "Out of stock"; disables **Add to Cart** when 0; blocks adding
      past stock (accounting for what's already in the cart).
- [x] `store/online_orders.store.ts` — `addToCart` / `updateCartQty` clamp to `stockQuantity`.
- [x] `app/(customer)/cart.tsx` — shows per-item stock, disables "+" at the cap, and maps
      `INSUFFICIENT_STOCK` / `CATALOG_ITEM_UNAVAILABLE` / `PAY_LATER_NOT_ALLOWED` to alerts.

---

## Known limitations / future work

- [ ] **Stock freshness:** the catalog stock is a *snapshot* pushed from the owner
      device on add / toggle. It does not auto-decrement as in-store POS sales happen,
      nor when an online order is placed. Follow-ups to consider:
  - [ ] Decrement `online_catalog.stock_quantity` inside the `placeOrder` transaction
        (the order-items table already has `stock_reduced` / `stock_reduced_at` flags).
  - [ ] Re-sync stock from the owner device on catalog-screen focus (or a periodic push).
- [ ] **Per-unit display:** customer UI shows a raw count; consider showing the unit
      (e.g. "12 pcs") by also syncing `InventoryItem.unit` to the catalog row.
