const STEPS = ["Order placed", "Preparing", "Shipped", "Delivered"] as const;

// Which step the order is on; an unpaid online order is still at the first step.
const CURRENT: Record<string, number> = { PENDING_PAYMENT: 0, PLACED: 1, PAID: 1, SHIPPED: 2, DELIVERED: 3 };

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

interface Props { status: string; createdAt: string; shippedAt: string | null; deliveredAt: string | null; courierName: string | null }

// The steps an order goes through, so customers can see where it is. Cancelled and refunded orders have nothing to track.
export function OrderProgress({ status, createdAt, shippedAt, deliveredAt, courierName }: Props) {
  const current = CURRENT[status];
  if (current === undefined) return null;
  const delivered = status === "DELIVERED";
  const done = (i: number) => delivered || i < current;
  const sub = [
    status === "PENDING_PAYMENT" ? "Awaiting payment" : day(createdAt),
    status === "PLACED" || status === "PAID" ? "Packing your order" : "",
    shippedAt ? `${day(shippedAt)}${courierName ? ` · ${courierName}` : ""}` : status === "SHIPPED" && courierName ? courierName : "",
    delivered ? day(deliveredAt) : "",
  ];
  const message = status === "PENDING_PAYMENT" ? "Complete the payment to confirm your order."
    : status === "SHIPPED" ? "Your order is on its way."
    : delivered ? "Your order has been delivered."
    : "Your order is confirmed and is being prepared.";

  return (
    <div className="mt-4 rounded-xl bg-canvas px-3 py-4 sm:px-5" data-testid="order-progress">
      <ol aria-label="Order progress" className="grid grid-cols-4">
        {STEPS.map((label, i) => {
          const complete = done(i);
          const here = !delivered && i === current;
          return (
            <li key={label} aria-current={here ? "step" : undefined} className="relative flex flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${done(i - 1) ? "bg-brand-500" : "bg-line"}`} />}
              <span aria-hidden className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${complete ? "bg-brand-500 text-ink" : here ? "border-2 border-brand-500 bg-white" : "bg-white text-muted ring-1 ring-line"}`}>
                {complete ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg> : here ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" /> : i + 1}
              </span>
              <span className={`mt-1.5 text-xs font-semibold ${complete || here ? "text-ink" : "text-muted"}`}>{label}<span className="sr-only">{complete ? " (done)" : here ? " (current step)" : " (not yet)"}</span></span>
              {sub[i] && <span className="mt-0.5 text-[11px] leading-tight text-muted">{sub[i]}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-muted">{message}</p>
    </div>
  );
}
