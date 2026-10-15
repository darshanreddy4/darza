export const DELETE_CONFIRMATION = "DELETE";

const IN_FLIGHT = ["PENDING_PAYMENT", "PLACED", "PAID", "SHIPPED"];

export interface DeletionFacts {
  role: string;
  orderStatuses: string[];
  openReturns: number;
  // Pay-on-delivery refunds still owed to the customer.
  payoutsDue: number;
}

// Why the account cannot be deleted right now, or null when it can.
export function deletionBlocker(f: DeletionFacts): string | null {
  if (f.role !== "CUSTOMER") return "Staff and admin accounts are removed by an admin. Ask another admin to change your role first.";
  if (f.orderStatuses.some((s) => IN_FLIGHT.includes(s))) return "You still have an order that has not been delivered. Cancel it or wait for it to arrive, then try again.";
  if (f.openReturns > 0) return "You have a return that is still being handled. Please wait until it is finished.";
  if (f.payoutsDue > 0) return "We still owe you a refund. Please wait until it has been paid out, then try again.";
  return null;
}
