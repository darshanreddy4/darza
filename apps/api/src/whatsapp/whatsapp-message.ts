import type { OrderMailKind } from "../mail/order-mail";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export interface WhatsAppOrderData { name: string; orderRef: string; totalPaise: number; refundIssued: boolean; url: string }

// One sentence per status. WhatsApp templates take a few plain text slots, so the whole update fits in one of them.
export function orderUpdateSentence(kind: OrderMailKind, d: Pick<WhatsAppOrderData, "totalPaise" | "refundIssued">): string {
  switch (kind) {
    case "placed": return `we've received your order for ${inr(d.totalPaise)}. You'll pay when it's delivered.`;
    case "paid": return `your payment of ${inr(d.totalPaise)} was received and the order is confirmed.`;
    case "shipped": return "your order has been shipped and is on its way.";
    case "delivered": return "your order has been delivered. We hope you like it.";
    case "cancelled": return d.refundIssued ? `your order was cancelled and ${inr(d.totalPaise)} is being refunded to your original payment method.` : "your order was cancelled.";
    case "refunded": return d.refundIssued ? `we've refunded ${inr(d.totalPaise)} to your original payment method. Banks usually take 5-7 business days.` : "your order has been marked as refunded.";
  }
}

// The four values the approved template fills in: {{1}} name, {{2}} order, {{3}} update, {{4}} link.
export const templateParams = (kind: OrderMailKind, d: WhatsAppOrderData) => [d.name, d.orderRef, orderUpdateSentence(kind, d), d.url];

// Meta wants the number as digits only, with the country code.
export const whatsAppNumber = (e164: string) => e164.replace(/\D/g, "");
