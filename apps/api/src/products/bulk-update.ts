import type { Prisma } from "@prisma/client";

export interface BulkChanges {
  status?: "PUBLISHED" | "DRAFT";
  featured?: boolean;
  // Empty string removes the label.
  dealLabel?: string;
  pricePaise?: number;
  priceChangePercent?: number;
  mrpPaise?: number;
  clearMrp?: boolean;
  // Keeps the price before this change as the struck-through MRP, so the discount shows.
  mrpFromOldPrice?: boolean;
  // The fields below only exist on our own products.
  stock?: number;
  showRating?: boolean;
  showAddToCart?: boolean;
  deliveryDays?: number;
  clearDelivery?: boolean;
  freeDelivery?: boolean;
}

export interface BulkRow { productType: "OWN" | "AFFILIATE"; pricePaise: number; mrpPaise: number | null }

export interface BulkPlan {
  patch: Prisma.ProductUpdateInput;
  skipReason?: string;
  mrpDropped?: boolean;
}

const OWN_ONLY: (keyof BulkChanges)[] = ["stock", "showAddToCart", "deliveryDays", "clearDelivery", "freeDelivery"];

// Checks the request as a whole; per-product problems are reported when planning each row.
export function validateBulkChanges(c: BulkChanges): string[] {
  const errors: string[] = [];
  if (!Object.values(c).some((v) => v !== undefined)) errors.push("Choose at least one change");
  if (c.pricePaise !== undefined && c.priceChangePercent !== undefined) errors.push("Set a price or change it by a percentage, not both");
  if (c.mrpPaise !== undefined && c.clearMrp) errors.push("Set the MRP or remove it, not both");
  if (c.mrpFromOldPrice && (c.mrpPaise !== undefined || c.clearMrp)) errors.push("Choose one way to set the MRP");
  if (c.mrpFromOldPrice && c.pricePaise === undefined && c.priceChangePercent === undefined) errors.push("Keeping the old price as MRP needs a price change");
  if (c.deliveryDays !== undefined && c.clearDelivery) errors.push("Set the delivery days or remove them, not both");
  if (c.pricePaise !== undefined && c.mrpPaise !== undefined && c.mrpPaise < c.pricePaise) errors.push("MRP cannot be lower than the selling price");
  return errors;
}

export function planBulkPatch(row: BulkRow, c: BulkChanges): BulkPlan {
  const patch: Prisma.ProductUpdateInput = {};
  const own = row.productType === "OWN";

  if (c.status !== undefined) patch.status = c.status;
  if (c.featured !== undefined) patch.featured = c.featured;
  if (c.dealLabel !== undefined) patch.dealLabel = c.dealLabel.trim() || null;
  if (c.showRating !== undefined) patch.showRating = c.showRating;

  const newPrice = c.pricePaise ?? (c.priceChangePercent !== undefined ? Math.max(0, Math.round(row.pricePaise * (1 + c.priceChangePercent / 100))) : undefined);
  const finalPrice = newPrice ?? row.pricePaise;
  if (newPrice !== undefined) patch.pricePaise = newPrice;

  let mrp: number | null | undefined;
  if (c.mrpPaise !== undefined) mrp = c.mrpPaise;
  else if (c.clearMrp) mrp = null;
  else if (c.mrpFromOldPrice && newPrice !== undefined) mrp = Math.max(row.mrpPaise ?? 0, row.pricePaise);
  if (mrp !== undefined) patch.mrpPaise = mrp;

  // A struck-through price below the selling price makes no sense. An explicit MRP skips the product; an inherited one is dropped.
  let mrpDropped = false;
  const finalMrp = mrp !== undefined ? mrp : row.mrpPaise;
  if (finalMrp !== null && finalMrp < finalPrice) {
    if (c.mrpPaise !== undefined) return { patch: {}, skipReason: "The new MRP is lower than this product's price" };
    patch.mrpPaise = null;
    mrpDropped = true;
  }

  if (own) {
    if (c.stock !== undefined) patch.stock = c.stock;
    if (c.showAddToCart !== undefined) patch.showAddToCart = c.showAddToCart;
    if (c.deliveryDays !== undefined) patch.deliveryDays = c.deliveryDays;
    if (c.clearDelivery) { patch.deliveryDays = null; patch.freeDelivery = false; }
    if (c.freeDelivery !== undefined && !c.clearDelivery) patch.freeDelivery = c.freeDelivery;
  } else if (Object.keys(patch).length === 0 && OWN_ONLY.some((k) => c[k] !== undefined)) {
    return { patch: {}, skipReason: "Partner products have no stock, delivery or cart settings" };
  }

  return { patch, mrpDropped };
}
