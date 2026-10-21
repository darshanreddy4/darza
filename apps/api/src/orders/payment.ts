// What an online payment covers, and how a refund divides between the online payment and a hand payout.

// The amount charged online for an order: the advance for a part-paid order, otherwise everything.
export const onlineChargePaise = (o: { advancePaise: number; totalPaise: number }) => (o.advancePaise > 0 ? o.advancePaise : o.totalPaise);

// Money can only go back online up to what was paid online; the rest of a refund is paid out to the customer's UPI ID.
export function splitRefund(totalPaise: number, onlineLeftPaise: number): { onlinePaise: number; payoutPaise: number } {
  const onlinePaise = Math.max(0, Math.min(totalPaise, onlineLeftPaise));
  return { onlinePaise, payoutPaise: totalPaise - onlinePaise };
}
