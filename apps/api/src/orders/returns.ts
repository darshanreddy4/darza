export const RETURN_REASONS = [
  "Damaged or defective",
  "Wrong item received",
  "Item not as described",
  "Size or fit issue",
  "Changed my mind",
  "Other",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// The last moment a customer can ask for a return, or null when returns are off or the order was not delivered.
export function returnDeadline(order: { status: string; deliveredAt: Date | null }, windowDays: number): Date | null {
  if (order.status !== "DELIVERED" || !order.deliveredAt || windowDays <= 0) return null;
  return new Date(order.deliveredAt.getTime() + windowDays * DAY_MS);
}

export type ReturnCheck = { ok: true } | { ok: false; reason: string };

export interface ReturnLine { quantity: number; returnedQty: number; pendingQty: number }

// Units of an order line that can still be put in a new request.
export const returnableQty = (l: ReturnLine) => Math.max(0, l.quantity - l.returnedQty - l.pendingQty);

export function canRequestReturn(order: { status: string; deliveredAt: Date | null }, windowDays: number, lines: ReturnLine[], now = new Date()): ReturnCheck {
  if (windowDays <= 0) return { ok: false, reason: "This store is not accepting return requests right now." };
  if (order.status !== "DELIVERED") return { ok: false, reason: "Returns can only be requested after an order has been delivered." };
  if (!lines.some((l) => returnableQty(l) > 0)) return { ok: false, reason: "Every item in this order has already been returned or is being returned." };
  const deadline = returnDeadline(order, windowDays);
  if (!deadline || deadline.getTime() < now.getTime()) return { ok: false, reason: `The ${windowDays}-day return window for this order has ended.` };
  return { ok: true };
}

export interface RefundOrder {
  items: { id: string; quantity: number; pricePaise: number; returnedQty: number }[];
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  // Money already sent back for earlier returns of this order.
  alreadyRefundedPaise: number;
}

// What a return of the picked units (order line id to quantity) refunds. The coupon discount is shared out by value, and delivery is only refunded when the last items come back.
export function returnRefund(o: RefundOrder, picks: Record<string, number>): { totalPaise: number; completesOrder: boolean } {
  const completesOrder = o.items.every((i) => i.returnedQty + (picks[i.id] ?? 0) >= i.quantity);
  const remaining = Math.max(0, o.totalPaise - o.alreadyRefundedPaise);
  if (completesOrder) return { totalPaise: remaining, completesOrder };

  const subtotal = o.items.reduce((n, i) => n + i.pricePaise * i.quantity, 0);
  const gross = o.items.reduce((n, i) => n + i.pricePaise * (picks[i.id] ?? 0), 0);
  const share = subtotal > 0 ? Math.round((o.discountPaise * gross) / subtotal) : 0;
  const room = Math.max(0, o.totalPaise - o.shippingPaise - o.alreadyRefundedPaise);
  return { totalPaise: Math.min(Math.max(0, gross - share), room), completesOrder };
}

export type ReturnAction = "approve" | "reject" | "refund" | "paid";

// A UPI ID such as name@okbank: letters, digits, dots, dashes and underscores, an @, then the bank handle.
export const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,31}$/;
export const isUpiId = (v: string) => UPI_PATTERN.test(v.trim());

// Shows enough of a UPI ID to recognise it without printing all of it in emails and texts: ab***@okbank.
export function maskUpi(upi: string): string {
  const [name = "", handle = ""] = upi.trim().split("@");
  return `${name.slice(0, 2)}***@${handle}`;
}

// Pay-on-delivery customers paid cash, so a refund is a transfer the admin makes by hand and then marks as paid.
export function payoutDue(r: { status: string; refundPaise: number | null; paidOutAt: Date | null }, paymentMethod: string): boolean {
  return paymentMethod === "COD" && r.status === "REFUNDED" && (r.refundPaise ?? 0) > 0 && !r.paidOutAt;
}
export type ReturnState = "REQUESTED" | "APPROVED" | "REJECTED" | "REFUNDED";

// The state an admin action moves a request to, or null when the action is not allowed from the current state.
export function nextReturnState(current: ReturnState, action: ReturnAction): ReturnState | null {
  if (action === "approve") return current === "REQUESTED" ? "APPROVED" : null;
  if (action === "reject") return current === "REQUESTED" || current === "APPROVED" ? "REJECTED" : null;
  // Paying out a refund does not move the request; it only has to be refunded already.
  if (action === "paid") return current === "REFUNDED" ? "REFUNDED" : null;
  return current === "APPROVED" ? "REFUNDED" : null;
}
