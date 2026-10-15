import type { OrderStatus } from "@prisma/client";

export interface StatsOrder {
  id: string;
  status: OrderStatus;
  totalPaise: number;
  refundedPaise: number;
  items: { productId: string; name: string; slug: string; quantity: number; pricePaise: number }[];
}

// Unpaid and cancelled orders were never bought, so they do not count as purchases.
const NOT_BOUGHT: OrderStatus[] = ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"];

export const isPurchase = (o: Pick<StatsOrder, "status">) => !NOT_BOUGHT.includes(o.status);
// Money went back to the customer.
export const isReturn = (o: Pick<StatsOrder, "status" | "refundedPaise">) => o.status === "REFUNDED" || o.refundedPaise > 0;

export function summariseOrders(orders: StatsOrder[]) {
  const bought = orders.filter(isPurchase);
  const returned = orders.filter(isReturn);
  const count = (list: StatsOrder[]) => list.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);

  const products = new Map<string, { productId: string; name: string; slug: string; quantity: number; spentPaise: number; returnedQuantity: number }>();
  const row = (i: StatsOrder["items"][number]) => {
    const existing = products.get(i.productId);
    if (existing) return existing;
    const fresh = { productId: i.productId, name: i.name, slug: i.slug, quantity: 0, spentPaise: 0, returnedQuantity: 0 };
    products.set(i.productId, fresh);
    return fresh;
  };
  for (const o of bought) for (const i of o.items) { const r = row(i); r.quantity += i.quantity; r.spentPaise += i.pricePaise * i.quantity; }
  for (const o of returned) for (const i of o.items) row(i).returnedQuantity += i.quantity;

  return {
    orders: bought.length,
    items: count(bought),
    spentPaise: bought.reduce((n, o) => n + o.totalPaise, 0),
    returnedOrders: returned.length,
    returnedItems: count(returned),
    refundedPaise: returned.reduce((n, o) => n + o.refundedPaise, 0),
    cancelledOrders: orders.filter((o) => o.status === "CANCELLED").length,
    products: [...products.values()].sort((a, b) => b.spentPaise - a.spentPaise),
  };
}

export interface AddressParts { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; pincode?: string | null }

export const formatAddress = (a: AddressParts | null | undefined) =>
  a ? [a.line1, a.line2, a.city, a.state, a.pincode].map((p) => p?.toString().trim()).filter(Boolean).join(", ") : "";

// The number and address a customer gave us: a saved address first (default one preferred), else the latest order's delivery details.
export function pickContact(
  saved: ({ phone: string; isDefault: boolean; createdAt: Date } & AddressParts)[],
  latestOrderShipping: unknown,
): { phone: string; address: string } {
  const best = [...saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (best) return { phone: best.phone, address: formatAddress(best) };
  const s = (latestOrderShipping ?? {}) as AddressParts & { phone?: string };
  return { phone: s.phone ?? "", address: formatAddress(s) };
}
