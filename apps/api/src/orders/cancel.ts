export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery will take too long",
  "Want to change the items or address",
  "No longer need it",
  "Other",
] as const;

// Orders the customer can still cancel on their own: nothing has left the warehouse yet.
export const CUSTOMER_CANCELLABLE = ["PENDING_PAYMENT", "PLACED", "PAID"] as const;

export type CancelCheck = { ok: true } | { ok: false; reason: string };

export function canCustomerCancel(status: string): CancelCheck {
  if ((CUSTOMER_CANCELLABLE as readonly string[]).includes(status)) return { ok: true };
  if (status === "SHIPPED" || status === "DELIVERED") return { ok: false, reason: status === "SHIPPED" ? "This order has already shipped. You can ask for a return once it is delivered." : "This order was already delivered. You can ask for a return instead." };
  return { ok: false, reason: "This order is already cancelled or refunded." };
}

// What gets stored: the chosen reason plus anything the customer added, kept short.
export function cancelReasonText(reason: string, details?: string | null): string {
  const extra = details?.trim();
  return (extra ? `${reason}: ${extra}` : reason).slice(0, 300);
}
