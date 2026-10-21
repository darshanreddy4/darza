import type { OrderStatus } from "@prisma/client";
import { readTracking } from "./tracking";

// Most orders one print or bulk action may cover.
export const MAX_BULK = 50;

// Orders that are paid for or confirmed for cash and waiting to be packed.
const READY: OrderStatus[] = ["PLACED", "PAID"];
export const readyToShip = (status: OrderStatus) => READY.includes(status);

const WHY_NOT: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment", PLACED: "", PAID: "", SHIPPED: "Already shipped", DELIVERED: "Already delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded",
};

// Cash the courier collects at the door: all of a pay on delivery order, the balance of a part-paid one, nothing for a prepaid one.
export function collectPaise(o: { paymentMethod: string; totalPaise: number; advancePaise: number }): number {
  if (o.paymentMethod === "COD") return o.totalPaise;
  return o.advancePaise > 0 ? Math.max(0, o.totalPaise - o.advancePaise) : 0;
}

// Which of the asked-for orders can be marked shipped, and why each of the others cannot.
export function planBulkShip(found: { id: string; status: OrderStatus }[], ids: string[]): { ready: string[]; skipped: { id: string; reason: string }[] } {
  const byId = new Map(found.map((o) => [o.id, o.status]));
  const ready: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of new Set(ids)) {
    const status = byId.get(id);
    if (!status) skipped.push({ id, reason: "Order not found" });
    else if (readyToShip(status)) ready.push(id);
    else skipped.push({ id, reason: WHY_NOT[status] });
  }
  return { ready, skipped };
}

// Ids from a comma-separated query, keeping only plausible ones and the first MAX_BULK.
export function parseIds(raw: string): string[] {
  return [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{10,40}$/.test(s)))].slice(0, MAX_BULK);
}

export interface BulkTracking { id: string; trackingNumber: string }

const LINK_TEMPLATE = /^https:\/\/\S*\{number\}\S*$/;

// A courier's tracking page for one parcel, from a link with {number} where the tracking number goes.
export function trackingLink(template: string | undefined, trackingNumber: string | undefined): string | undefined {
  const t = template?.trim();
  return t && trackingNumber ? t.replace(/\{number\}/g, encodeURIComponent(trackingNumber)) : undefined;
}

// Why the tracking numbers typed for a bulk shipment cannot be used, or null when they are fine.
export function bulkTrackingError(courierName: string | undefined, numbers: BulkTracking[], template: string | undefined): string | null {
  const t = template?.trim();
  if (t && !LINK_TEMPLATE.test(t)) return "The tracking link must start with https:// and contain {number} where the tracking number goes";
  if (t && !courierName?.trim()) return "Enter the courier name with the tracking link";
  const used = new Map<string, string>();
  for (const { id, trackingNumber } of numbers) {
    const ref = `#${id.slice(-8).toUpperCase()}`;
    const n = trackingNumber.trim();
    if (!n) continue;
    if (!courierName?.trim()) return "Enter the courier name to add tracking numbers";
    const { error } = readTracking({ courierName, trackingNumber: n });
    if (error) return `${ref}: ${error}`;
    const other = used.get(n.toLowerCase());
    if (other) return `The tracking number ${n} is on both ${other} and ${ref}`;
    used.set(n.toLowerCase(), ref);
  }
  return null;
}
