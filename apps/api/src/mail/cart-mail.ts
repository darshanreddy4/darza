import { esc } from "./templates";

export interface CartMailData {
  brand: string;
  name: string;
  items: { name: string; quantity: number; pricePaise: number }[];
  cartUrl: string;
  unsubscribeUrl: string;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function cartReminderMail(d: CartMailData) {
  const total = d.items.reduce((n, i) => n + i.pricePaise * i.quantity, 0);
  const lines = d.items.map((i) => `${i.name} x ${i.quantity}   ${inr(i.pricePaise * i.quantity)}`);
  const text = [`Hi ${d.name},`, "", "You left these items in your cart:", "", ...lines, "", `Subtotal: ${inr(total)}`, "", `Pick up where you left off: ${d.cartUrl}`, "", `- ${d.brand}`, "", `Don't want reminders like this? Turn them off: ${d.unsubscribeUrl}`].join("\n");
  const cell = "padding:6px 0;border-bottom:1px solid #eee;font-size:14px";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">You left something behind</h2>
<p>Hi ${esc(d.name)},</p><p>These items are still waiting in your ${esc(d.brand)} cart.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
${d.items.map((i) => `<tr><td style="${cell}">${esc(i.name)} &times; ${i.quantity}</td><td style="${cell};text-align:right">${esc(inr(i.pricePaise * i.quantity))}</td></tr>`).join("")}
<tr><td style="padding:6px 0;font-weight:bold">Subtotal</td><td style="padding:6px 0;text-align:right;font-weight:bold">${esc(inr(total))}</td></tr>
</table>
<p><a href="${esc(d.cartUrl)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">Return to your cart</a></p>
<p style="font-size:12px;color:#777">Prices and availability can change. <a href="${esc(d.unsubscribeUrl)}" style="color:#777">Stop cart reminders</a></p></div>`;
  return { subject: `You left something in your ${d.brand} cart`, text, html };
}
