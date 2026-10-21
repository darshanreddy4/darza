import { esc } from "./templates";

export type OrderMailKind = "placed" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";

export interface OrderMailData {
  brand: string;
  name: string;
  orderRef: string;
  items: { name: string; quantity: number; pricePaise: number }[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  couponCode: string | null;
  paymentMethod: string;
  // True when money is being sent back to the customer's payment method.
  refundIssued: boolean;
  url: string;
  // Shipped mail only: who is carrying the parcel and how to follow it.
  tracking?: { courier: string; number: string | null; url: string | null };
  // Part payment: the share paid online up front; the rest of totalPaise is paid on delivery.
  advancePaise?: number;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const COPY: Record<OrderMailKind, { subject: (r: string, brand: string) => string; heading: string; intro: (d: OrderMailData) => string }> = {
  placed: {
    subject: (r) => `Order ${r} confirmed`, heading: "Thanks for your order",
    intro: () => "We've received your order and will start getting it ready. You'll pay when it's delivered.",
  },
  paid: {
    subject: (r) => `Payment received for order ${r}`, heading: "Payment received",
    intro: () => "Your payment went through and your order is confirmed. We'll let you know when it ships.",
  },
  shipped: {
    subject: (r, brand) => `Your ${brand} order ${r} has shipped`, heading: "Your order is on its way",
    intro: () => "Good news, your order has been shipped.",
  },
  delivered: {
    subject: (r) => `Order ${r} delivered`, heading: "Your order was delivered",
    intro: () => "Your order has been marked as delivered. We hope you like it. A review helps other shoppers.",
  },
  cancelled: {
    subject: (r) => `Order ${r} cancelled`, heading: "Your order was cancelled",
    intro: (d) => (d.refundIssued ? `Your order has been cancelled. We've started a refund of ${inr(d.totalPaise)} to your original payment method; banks usually take 5-7 business days.` : "Your order has been cancelled."),
  },
  refunded: {
    subject: (r) => `Refund for order ${r}`, heading: "Your refund is on its way",
    intro: (d) => (d.refundIssued ? `We've refunded ${inr(d.totalPaise)} to your original payment method. Banks usually take 5-7 business days to show it.` : "Your order has been marked as refunded."),
  },
};

export function orderMail(kind: OrderMailKind, d: OrderMailData) {
  const copy = COPY[kind];
  const rows: [string, string][] = [["Subtotal", inr(d.subtotalPaise)]];
  if (d.discountPaise > 0) rows.push([d.couponCode ? `Discount (${d.couponCode})` : "Discount", `-${inr(d.discountPaise)}`]);
  rows.push(["Delivery", d.shippingPaise > 0 ? inr(d.shippingPaise) : "Free"], ["Total", inr(d.totalPaise)]);

  const lines = d.items.map((i) => `${i.name} x ${i.quantity}   ${inr(i.pricePaise * i.quantity)}`);
  const t = d.tracking;
  // A part-paid order says what was paid online and what is left for the courier; a cancelled or refunded one has nothing left to collect.
  const balance = d.advancePaise && d.advancePaise > 0 && d.advancePaise < d.totalPaise && kind !== "cancelled" && kind !== "refunded" && kind !== "delivered"
    ? `Paid online: ${inr(d.advancePaise)}. To pay on delivery: ${inr(d.totalPaise - d.advancePaise)}.` : "";
  const trackLines = t ? [`Courier: ${t.courier}`, ...(t.number ? [`Tracking number: ${t.number}`] : []), ...(t.url ? [`Track your shipment: ${t.url}`] : [])] : [];
  const text = [`Hi ${d.name},`, "", copy.intro(d), "", ...(trackLines.length ? [...trackLines, ""] : []), `Order ${d.orderRef}`, ...lines, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...(balance ? [balance, ""] : []), `View your order: ${d.url}`, "", `- ${d.brand}`].join("\n");

  const cell = "padding:6px 0;border-bottom:1px solid #eee;font-size:14px";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">${esc(copy.heading)}</h2>
<p style="margin:0 0 16px;color:#555">Order ${esc(d.orderRef)}</p>
<p>Hi ${esc(d.name)},</p><p>${esc(copy.intro(d))}</p>
${t ? `<p style="background:#f6f6f6;border-radius:10px;padding:12px 14px;font-size:14px">Courier: <b>${esc(t.courier)}</b>${t.number ? `<br>Tracking number: <b>${esc(t.number)}</b>` : ""}${t.url && /^https:\/\//.test(t.url) ? `<br><a href="${esc(t.url)}">Track your shipment</a>` : ""}</p>` : ""}
<table style="width:100%;border-collapse:collapse;margin:16px 0">
${d.items.map((i) => `<tr><td style="${cell}">${esc(i.name)} &times; ${i.quantity}</td><td style="${cell};text-align:right">${esc(inr(i.pricePaise * i.quantity))}</td></tr>`).join("")}
${rows.map(([k, v], idx) => `<tr><td style="padding:6px 0;font-size:14px;${idx === rows.length - 1 ? "font-weight:bold" : "color:#555"}">${esc(k)}</td><td style="padding:6px 0;font-size:14px;text-align:right;${idx === rows.length - 1 ? "font-weight:bold" : ""}">${esc(v)}</td></tr>`).join("")}
</table>
${balance ? `<p style="font-size:14px;font-weight:bold">${esc(balance)}</p>` : ""}
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">View your order</a></p>
<p style="font-size:12px;color:#777">Payment method: ${d.paymentMethod === "ONLINE" ? "Paid online" : "Pay on delivery"}</p></div>`;

  return { subject: copy.subject(d.orderRef, d.brand), text, html };
}
