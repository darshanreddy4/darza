import { esc } from "./templates";

export type ReturnMailKind = "requested" | "approved" | "rejected" | "refunded" | "paid";

export interface ReturnMailData {
  brand: string;
  name: string;
  orderRef: string;
  reason: string;
  note: string | null;
  url: string;
  // For a refund: how much, and whether it goes back to the payment method.
  refundPaise?: number;
  refundIssued?: boolean;
  // Pay-on-delivery refunds: the masked UPI ID, and for a payout the reference of the transfer.
  payoutUpi?: string;
  payoutRef?: string;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const COPY: Record<ReturnMailKind, { subject: (r: string) => string; heading: string; intro: (d: ReturnMailData) => string }> = {
  requested: {
    subject: (r) => `We received your return request for order ${r}`, heading: "Return request received",
    intro: () => "We've received your return request and will review it shortly. We'll email you as soon as there's an update.",
  },
  approved: {
    subject: (r) => `Return approved for order ${r}`, heading: "Your return was approved",
    intro: () => "Your return request has been approved. We'll be in touch about collecting the item, and your refund follows once we have it.",
  },
  rejected: {
    subject: (r) => `Update on your return request for order ${r}`, heading: "We couldn't approve this return",
    intro: () => "Sorry, we weren't able to approve your return request for this order.",
  },
  refunded: {
    subject: (r) => `Refund for your return on order ${r}`, heading: "Your return is refunded",
    intro: (d) => (d.refundIssued ? `We've received the items you returned and refunded ${inr(d.refundPaise ?? 0)} to your original payment method. Banks usually take 5-7 business days to show it.` : `We've received the items you returned. ${d.payoutUpi ? `We'll pay your refund of ${inr(d.refundPaise ?? 0)} to your UPI ID ${d.payoutUpi} and let you know when it's sent.` : `Your refund of ${inr(d.refundPaise ?? 0)} is being arranged.`}`),
  },
  paid: {
    subject: (r) => `Your refund for order ${r} has been paid`, heading: "Your refund was paid",
    intro: (d) => `We've paid ${inr(d.refundPaise ?? 0)} to your UPI ID ${d.payoutUpi ?? ""}${d.payoutRef ? ` (reference ${d.payoutRef})` : ""}. It usually shows up in your account within minutes.`,
  },
};

export function returnMail(kind: ReturnMailKind, d: ReturnMailData) {
  const copy = COPY[kind];
  const note = d.note?.trim();
  const text = [`Hi ${d.name},`, "", copy.intro(d), ...(note ? ["", `Note from us: ${note}`] : []), "", `Order ${d.orderRef}. Reason: ${d.reason}`, `View your orders: ${d.url}`, "", `- ${d.brand}`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">${esc(copy.heading)}</h2>
<p style="margin:0 0 16px;color:#555">Order ${esc(d.orderRef)}</p>
<p>Hi ${esc(d.name)},</p><p>${esc(copy.intro(d))}</p>
${note ? `<p style="background:#f6f6f6;padding:12px;border-radius:8px;font-size:14px">${esc(note)}</p>` : ""}
<p style="font-size:13px;color:#555">Reason given: ${esc(d.reason)}</p>
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">View your orders</a></p></div>`;
  return { subject: copy.subject(d.orderRef), text, html };
}
