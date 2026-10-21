// The rules of the stock history, kept free of the database so they can be tested on their own.

// One row per item in a warehouse: the option's id, or "-" for a product without options.
export const itemKey = (optionId: string | null) => optionId ?? "-";

export interface Shelf { warehouseId: string; quantity: number }

// Where units come out of: the main warehouse first (it holds whatever the others do not), then the others, biggest stock first.
// A warehouseId of null is the main warehouse.
export function planOut(mainAvailable: number, others: Shelf[], quantity: number): { warehouseId: string | null; quantity: number }[] {
  const parts: { warehouseId: string | null; quantity: number }[] = [];
  let left = quantity;
  const fromMain = Math.min(Math.max(mainAvailable, 0), left);
  if (fromMain > 0) parts.push({ warehouseId: null, quantity: fromMain });
  left -= fromMain;
  for (const shelf of [...others].sort((a, b) => b.quantity - a.quantity)) {
    if (left <= 0) break;
    const take = Math.min(shelf.quantity, left);
    if (take > 0) { parts.push({ warehouseId: shelf.warehouseId, quantity: take }); left -= take; }
  }
  // Anything the shelves cannot account for is charged to the main warehouse, so the movements always add up to what changed.
  if (left > 0) {
    const main = parts.find((p) => p.warehouseId === null);
    if (main) main.quantity += left; else parts.unshift({ warehouseId: null, quantity: left });
  }
  return parts;
}

export interface StockItem { productId: string; optionId: string | null; productName: string; optionLabel: string | null; stock: number }
export type Snapshot = Map<string, StockItem>
export const snapKey = (productId: string, optionId: string | null) => `${productId}:${itemKey(optionId)}`;

export interface StockChange { item: StockItem; delta: number; balanceAfter: number; removed: boolean }

// What changed between two looks at the stock: new items count from zero, items that disappeared (a removed option) go to zero.
export function diffSnapshots(before: Snapshot, after: Snapshot): StockChange[] {
  const changes: StockChange[] = [];
  for (const [key, now] of after) {
    const delta = now.stock - (before.get(key)?.stock ?? 0);
    if (delta !== 0) changes.push({ item: now, delta, balanceAfter: now.stock, removed: false });
  }
  for (const [key, was] of before) if (!after.has(key) && was.stock > 0) changes.push({ item: was, delta: -was.stock, balanceAfter: 0, removed: true });
  return changes;
}

// Units a warehouse holds: the main one holds the total minus what the others hold.
export const mainQuantity = (total: number, others: number[]) => Math.max(0, total - others.reduce((n, q) => n + q, 0));
