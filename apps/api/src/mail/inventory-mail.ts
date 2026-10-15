import { esc } from "./templates";

export interface LowStockItem { name: string; sku: string | null; stock: number }

export interface InventoryMailData {
  brand: string;
  items: LowStockItem[];
  threshold: number;
  url: string;
}

export function lowStockMail(d: InventoryMailData) {
  const out = d.items.filter((i) => i.stock <= 0).length;
  const subject = out > 0
    ? `${d.items.length} ${d.items.length === 1 ? "product needs" : "products need"} restocking (${out} sold out)`
    : `${d.items.length} ${d.items.length === 1 ? "product is" : "products are"} running low on stock`;
  const line = (i: LowStockItem) => `${i.name}${i.sku ? ` (${i.sku})` : ""}: ${i.stock <= 0 ? "SOLD OUT" : `${i.stock} left`}`;
  const text = [`These ${d.brand} products are at or below ${d.threshold} in stock:`, "", ...d.items.map(line), "", `Review them: ${d.url}`, "", "You get one email per product each time its stock drops this low."].join("\n");
  const cell = "padding:6px 0;border-bottom:1px solid #eee;font-size:14px";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">Low stock</h2>
<p style="color:#555">These products are at or below ${d.threshold} in stock.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
${d.items.map((i) => `<tr><td style="${cell}">${esc(i.name)}${i.sku ? ` <span style="color:#777">(${esc(i.sku)})</span>` : ""}</td><td style="${cell};text-align:right;${i.stock <= 0 ? "color:#b91c1c;font-weight:bold" : ""}">${i.stock <= 0 ? "Sold out" : `${i.stock} left`}</td></tr>`).join("")}
</table>
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">Review stock</a></p>
<p style="font-size:12px;color:#777">You get one email per product each time its stock drops this low.</p></div>`;
  return { subject, text, html };
}
