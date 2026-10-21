import type { Prisma } from "@prisma/client";
import { recordItemChange, type Cause } from "../inventory/ledger";

// Puts units of a bought item back on the shelf. A size that has since been removed no longer counts towards the product's stock.
export async function restock(tx: Prisma.TransactionClient, item: { productId: string; optionId: string | null }, quantity: number, cause?: Cause) {
  if (quantity <= 0) return;
  if (item.optionId) {
    const back = await tx.productOption.updateMany({ where: { id: item.optionId, productId: item.productId }, data: { stock: { increment: quantity } } });
    if (back.count === 0) return;
  }
  await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: quantity } } });
  if (cause) await recordItemChange(tx, item.productId, item.optionId, quantity, cause);
}

// "Basmati Rice (25 kg)" for an item bought in a size, otherwise just the name.
export const itemName = (name: string, optionLabel?: string | null) => (optionLabel ? `${name} (${optionLabel})` : name);
