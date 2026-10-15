import type { OrderStatus, Role } from "@prisma/client";

// Staff run day-to-day orders, returns and customer questions. Anything that moves money, changes the catalogue or settings,
// or reveals costs and customers' accounts stays with admins.
export const ADMIN_AND_STAFF: Role[] = ["ADMIN", "STAFF"];

const MONEY_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED"];

// Cancelling or refunding an order returns stock and (for online orders) sends money back.
export function canSetOrderStatus(role: Role, status: OrderStatus): boolean {
  return role === "ADMIN" || !MONEY_STATUSES.includes(status);
}

export function canDecideReturn(role: Role, action: "approve" | "reject" | "refund" | "paid"): boolean {
  return role === "ADMIN" || (action !== "refund" && action !== "paid");
}

// What the business paid for goods is not for staff to see.
export function withoutCost<T extends { costPaise?: number | null }>(role: Role, row: T): T {
  if (role === "ADMIN") return row;
  const { costPaise: _cost, ...rest } = row;
  void _cost;
  return rest as T;
}
