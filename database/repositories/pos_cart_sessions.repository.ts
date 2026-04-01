/**
 * pos_cart_sessions.repository.ts
 *
 * All SQLite access for `pos_cart_sessions` and `pos_cart_items`.
 * No SQL may appear in screens, hooks, or Zustand stores — they call
 * these functions exclusively.
 *
 * Cart lifecycle:
 *   1. App boots → call `getActiveCartSession()`.
 *      - If a row is returned, resume the saved cart.
 *      - If null, call `openCartSession()` to start fresh.
 *   2. User adds/removes products → `upsertCartItem()` / `removeCartItem()`.
 *   3. User checks out → caller commits via sales.repository `createSalesOrder()`,
 *      then calls `closeCartSession(id, 'abandoned')` to mark the draft consumed.
 *      The POS flow then calls `openCartSession()` for the next transaction.
 *   4. App restarts mid-session → step 1 resumes transparently.
 *
 * Invariant: at most ONE session has status = 'active' at a time.
 *   `openCartSession()` atomically abandons any prior active session before
 *   inserting the new one, enforcing this invariant without a UNIQUE index
 *   (which would block recovery-auditing of multiple 'abandoned' rows).
 */

import { getDatabase } from '../database';
import type {
  PosCartSessionRow,
  PosCartItemRow,
} from '../schemas/pos_cart_sessions.schema';
import type { PosCartSession, PosCartItem } from '@/types';

// ─── UUID helper ──────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Column lists (never SELECT *) ───────────────────────────────────────────

const SESSION_COLS =
  'id, status, discount_amount, notes, created_at, updated_at';

const ITEM_COLS =
  'id, session_id, product_id, product_name, quantity, unit_price, subtotal, created_at, updated_at';

// ─── Domain mappers ───────────────────────────────────────────────────────────

function sessionToDomain(row: PosCartSessionRow): PosCartSession {
  return {
    id:             row.id,
    status:         row.status,
    discountAmount: row.discount_amount,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
    ...(row.notes !== null ? { notes: row.notes } : {}),
  };
}

function itemToDomain(row: PosCartItemRow): PosCartItem {
  return {
    id:          row.id,
    sessionId:   row.session_id,
    productId:   row.product_id,
    productName: row.product_name,
    quantity:    row.quantity,
    unitPrice:   row.unit_price,
    subtotal:    row.subtotal,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── Session operations ───────────────────────────────────────────────────────

/**
 * Returns the current active cart session, or null if none exists.
 * Call this on app boot to determine whether to resume or start fresh.
 */
export async function getActiveCartSession(): Promise<PosCartSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PosCartSessionRow>(
    `SELECT ${SESSION_COLS}
     FROM pos_cart_sessions
     WHERE status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [],
  );
  return row != null ? sessionToDomain(row) : null;
}

/**
 * Returns the line items for a given cart session.
 */
export async function getCartItems(sessionId: string): Promise<PosCartItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PosCartItemRow>(
    `SELECT ${ITEM_COLS}
     FROM pos_cart_items
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map(itemToDomain);
}

/**
 * Opens a new active cart session.
 * Any existing active session is atomically abandoned first to preserve the
 * single-active-session invariant. Returns the newly created session.
 */
export async function openCartSession(): Promise<PosCartSession> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  const id  = generateUUID();

  // Atomic: abandon any prior active session, then insert the new one.
  // withTransactionAsync is the correct pattern here — all SQL is inlined
  // within this single callback (no nested transaction calls).
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE pos_cart_sessions
       SET    status = 'abandoned', updated_at = ?
       WHERE  status = 'active'`,
      [now],
    );
    await db.runAsync(
      `INSERT INTO pos_cart_sessions (id, status, discount_amount, notes, created_at, updated_at)
       VALUES (?, 'active', 0, NULL, ?, ?)`,
      [id, now, now],
    );
  });

  return {
    id,
    status:         'active',
    discountAmount: 0,
    createdAt:      now,
    updatedAt:      now,
  };
}

/**
 * Marks a cart session as abandoned (used after checkout or explicit clear).
 * Items are intentionally kept in `pos_cart_items` for recovery / audit — the
 * caller is responsible for deciding whether to purge them via `clearCartItems`.
 */
export async function closeCartSession(
  sessionId: string,
  status: 'abandoned' = 'abandoned',
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE pos_cart_sessions SET status = ?, updated_at = ? WHERE id = ?`,
    [status, now, sessionId],
  );
}

/**
 * Updates the discount amount or notes on an active cart session.
 */
export async function updateCartSession(
  sessionId: string,
  patch: { discountAmount?: number; notes?: string | null },
): Promise<void> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[]            = ['updated_at = ?'];
  const params: (string | number | null)[] = [now];

  if (patch.discountAmount !== undefined) {
    fields.push('discount_amount = ?');
    params.push(patch.discountAmount);
  }
  if (patch.notes !== undefined) {
    fields.push('notes = ?');
    params.push(patch.notes);
  }

  params.push(sessionId);

  await db.runAsync(
    `UPDATE pos_cart_sessions SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
}

// ─── Item operations ──────────────────────────────────────────────────────────

/**
 * Adds a product to the cart or increments its quantity if it is already present.
 *
 * "Upsert" semantics:
 *   - If no row exists for (session_id, product_id) → INSERT.
 *   - If a row already exists → UPDATE quantity, subtotal, updated_at.
 *
 * The caller must pass the NEW desired quantity (not a delta). This keeps the
 * caller in control of clamping/rounding and avoids race conditions on repeated
 * fast taps.
 */
export async function upsertCartItem(input: {
  sessionId:   string;
  productId:   string;
  productName: string;
  quantity:    number;
  unitPrice:   number;
}): Promise<PosCartItem> {
  const db  = await getDatabase();
  const now = new Date().toISOString();

  const subtotal = parseFloat((input.quantity * input.unitPrice).toFixed(2));

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM pos_cart_items WHERE session_id = ? AND product_id = ?`,
    [input.sessionId, input.productId],
  );

  if (existing != null) {
    await db.runAsync(
      `UPDATE pos_cart_items
       SET    quantity = ?, subtotal = ?, updated_at = ?
       WHERE  id = ?`,
      [input.quantity, subtotal, now, existing.id],
    );

    // Read back the full updated row to return a consistent domain object.
    const updated = await db.getFirstAsync<PosCartItemRow>(
      `SELECT ${ITEM_COLS} FROM pos_cart_items WHERE id = ?`,
      [existing.id],
    );
    // updated is guaranteed non-null because we just wrote to it.
    return itemToDomain(updated!);
  }

  const id = generateUUID();
  await db.runAsync(
    `INSERT INTO pos_cart_items
       (id, session_id, product_id, product_name, quantity, unit_price, subtotal, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.sessionId, input.productId, input.productName, input.quantity, input.unitPrice, subtotal, now, now],
  );

  return {
    id,
    sessionId:   input.sessionId,
    productId:   input.productId,
    productName: input.productName,
    quantity:    input.quantity,
    unitPrice:   input.unitPrice,
    subtotal,
    createdAt:   now,
    updatedAt:   now,
  };
}

/**
 * Removes a single line item from the cart by its item id.
 */
export async function removeCartItem(itemId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM pos_cart_items WHERE id = ?`,
    [itemId],
  );
}

/**
 * Removes all line items for a given cart session.
 * Useful when the operator taps "Clear Cart" without starting a new session.
 */
export async function clearCartItems(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM pos_cart_items WHERE session_id = ?`,
    [sessionId],
  );
}

/**
 * Purges all abandoned cart sessions and their items older than `olderThanDays`.
 * Call this from a background maintenance task to prevent unbounded growth.
 * Active sessions are never purged.
 */
export async function purgeAbandonedCarts(olderThanDays = 7): Promise<void> {
  const db        = await getDatabase();
  const cutoff    = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();

  // Delete items first (FK reference to sessions).
  await db.runAsync(
    `DELETE FROM pos_cart_items
     WHERE session_id IN (
       SELECT id FROM pos_cart_sessions
       WHERE  status = 'abandoned' AND updated_at < ?
     )`,
    [cutoff],
  );
  await db.runAsync(
    `DELETE FROM pos_cart_sessions
     WHERE status = 'abandoned' AND updated_at < ?`,
    [cutoff],
  );
}
