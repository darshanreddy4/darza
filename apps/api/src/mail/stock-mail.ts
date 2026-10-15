import { esc } from "./templates";

export interface StockMailData {
  brand: string;
  name: string;
  product: string;
  pricePaise: number;
  url: string;
}

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function backInStockMail(d: StockMailData) {
  const text = [`Hi ${d.name},`, "", `Good news: ${d.product} is back in stock at ${inr(d.pricePaise)}.`, "", "Stock is limited, so it may sell out again.", `Get it here: ${d.url}`, "", `- ${d.brand}`, "", "You asked us to tell you when this was available. We won't email you about it again."].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">Back in stock</h2>
<p>Hi ${esc(d.name)},</p>
<p><strong>${esc(d.product)}</strong> is available again at ${esc(inr(d.pricePaise))}. Stock is limited, so it may sell out again.</p>
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">View the product</a></p>
<p style="font-size:12px;color:#777">You asked us to tell you when this was available. We won't email you about it again.</p></div>`;
  return { subject: `${d.product} is back in stock`, text, html };
}
