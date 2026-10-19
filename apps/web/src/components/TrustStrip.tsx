import type { Product } from "@/lib/api";
import { deliveryLabel, type StoreDelivery } from "@/lib/labels";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS = {
  cod: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9v.01M18 15v.01" /></svg>,
  returns: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" /></svg>,
  // The return arrow crossed out, so "no returns" does not look like a promise.
  noReturns: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 12a8 8 0 0 1 12.500-6.600M20 12a8 8 0 0 1-12.500 6.600M4 4v4h4" /><path d="M3 3l18 18" /></svg>,
  cancel: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>,
  secure: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M12 3l7 3v5c0 4.500-3 8-7 10-4-2-7-5.500-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>,
  truck: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7" /><circle cx="6.500" cy="17.500" r="1.800" /><circle cx="16.500" cy="17.500" r="1.800" /></svg>,
  warranty: <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="9" r="5.500" /><path d="M8.500 13.500L7 21l5-2.500 5 2.500-1.500-7.500" /></svg>,
};

interface Item { icon: React.ReactNode; text: string; muted?: boolean }

const WARRANTY_NONE = /^\s*(no|nil|none)\b/i;

// What a customer can rely on for this product. Each icon appears only when it is true for it: a product sold as non-returnable says so instead of promising returns.
export function TrustStrip({ product, store }: { product: Pick<Product, "returnDays" | "freeDelivery" | "chargeDelivery" | "deliveryFeePaise" | "warranty">; store: StoreDelivery | null }) {
  const delivery = deliveryLabel(product, store);
  const items: Item[] = [
    { icon: ICONS.cod, text: "Pay on delivery" },
    product.returnDays > 0
      ? { icon: ICONS.returns, text: `${product.returnDays}-day returns` }
      : { icon: ICONS.noReturns, text: "No returns", muted: true },
    { icon: ICONS.cancel, text: "Cancel before it ships" },
    ...(delivery ? [{ icon: ICONS.truck, text: delivery.text }] : []),
    ...(product.warranty && !WARRANTY_NONE.test(product.warranty) ? [{ icon: ICONS.warranty, text: product.warranty.length > 26 ? "Warranty included" : product.warranty }] : []),
    { icon: ICONS.secure, text: "Secure checkout" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Buying with confidence">
      {items.map((i) => (
        <li key={i.text} className="flex flex-col items-center gap-1.5 rounded-2xl bg-canvas px-2 py-3 text-center text-xs font-medium text-ink-3">
          <span className={i.muted ? "text-amber-700" : "text-brand-700"}>{i.icon}</span>
          {i.text}
        </li>
      ))}
    </ul>
  );
}
