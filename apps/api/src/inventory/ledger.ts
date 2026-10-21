import type { Prisma, StockReason } from "@prisma/client";
import { diffSnapshots, itemKey, planOut, snapKey, type Snapshot, type StockItem } from "./ledger-rules";

type Tx = Prisma.TransactionClient;

// The warehouse every shop starts with; it holds all the stock that is not moved to another one.
export const MAIN_WAREHOUSE_ID = "wh_main";

export interface Cause { reason: StockReason; orderId?: string | null; note?: string | null; actorId?: string | null }
type ItemName = Pick<StockItem, "productId" | "optionId" | "productName" | "optionLabel">;

export async function writeMovement(tx: Tx, m: ItemName & { warehouseId: string; delta: number; balanceAfter: number } & Cause) {
  const actor = m.actorId ? await tx.user.findUnique({ where: { id: m.actorId }, select: { name: true } }) : null;
  await tx.stockMovement.create({
    data: {
      productId: m.productId, productName: m.productName, optionId: m.optionId, optionLabel: m.optionLabel, warehouseId: m.warehouseId, delta: m.delta, balanceAfter: m.balanceAfter,
      reason: m.reason, note: m.note ?? null, orderId: m.orderId ?? null, actorId: m.actorId ?? null, actorName: actor?.name ?? null,
    },
  });
}

// The item as it is now: its names and the units in all warehouses.
export async function readItem(tx: Tx, productId: string, optionId: string | null): Promise<StockItem | null> {
  if (optionId) {
    const o = await tx.productOption.findFirst({ where: { id: optionId, productId }, select: { label: true, stock: true, product: { select: { name: true } } } });
    return o ? { productId, optionId, productName: o.product.name, optionLabel: o.label, stock: o.stock } : null;
  }
  const p = await tx.product.findUnique({ where: { id: productId }, select: { name: true, stock: true } });
  return p ? { productId, optionId: null, productName: p.name, optionLabel: null, stock: p.stock ?? 0 } : null;
}

// Writes down a change that has already been made to an item's total. More units go to the main warehouse; fewer come out of the
// main warehouse first and then the others, which is also what leaves their shelves right.
export async function recordChange(tx: Tx, item: ItemName, balanceAfter: number, delta: number, cause: Cause, allocate = true) {
  if (delta === 0) return;
  if (delta > 0 || !allocate) {
    await writeMovement(tx, { ...item, warehouseId: MAIN_WAREHOUSE_ID, delta, balanceAfter, ...cause });
    return;
  }
  const key = itemKey(item.optionId);
  const rows = await tx.warehouseStock.findMany({ where: { productId: item.productId, itemKey: key, quantity: { gt: 0 } } });
  const kept = rows.reduce((n, r) => n + r.quantity, 0);
  const parts = planOut(balanceAfter - delta - kept, rows.map((r) => ({ warehouseId: r.warehouseId, quantity: r.quantity })), -delta);
  for (const part of parts) {
    if (part.warehouseId) await tx.warehouseStock.updateMany({ where: { warehouseId: part.warehouseId, productId: item.productId, itemKey: key }, data: { quantity: { decrement: part.quantity } } });
    await writeMovement(tx, { ...item, warehouseId: part.warehouseId ?? MAIN_WAREHOUSE_ID, delta: -part.quantity, balanceAfter, ...cause });
  }
}

// Writes down a change that has just been made to an item, reading the units it has now.
export async function recordItemChange(tx: Tx, productId: string, optionId: string | null, delta: number, cause: Cause) {
  const item = await readItem(tx, productId, optionId);
  if (item) await recordChange(tx, item, item.stock, delta, cause);
}

// The units of every item of our own products, a product with options counting per option.
export async function snapshotStock(tx: Tx, productIds: string[]): Promise<Snapshot> {
  const products = await tx.product.findMany({ where: { id: { in: productIds }, productType: "OWN" }, select: { id: true, name: true, stock: true, options: { select: { id: true, label: true, stock: true } } } });
  const out: Snapshot = new Map();
  for (const p of products) {
    if (p.options.length) for (const o of p.options) out.set(snapKey(p.id, o.id), { productId: p.id, optionId: o.id, productName: p.name, optionLabel: o.label, stock: o.stock });
    else out.set(snapKey(p.id, null), { productId: p.id, optionId: null, productName: p.name, optionLabel: null, stock: p.stock ?? 0 });
  }
  return out;
}

// Records whatever changed between two snapshots (a product saved, a sheet imported).
export async function recordDifferences(tx: Tx, before: Snapshot, after: Snapshot, cause: Cause) {
  for (const change of diffSnapshots(before, after)) await recordChange(tx, change.item, change.balanceAfter, change.delta, cause, !change.removed);
}
