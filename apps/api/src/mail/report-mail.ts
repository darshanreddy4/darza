import { esc } from "./templates";
import type { SalesSummary } from "../analytics/sales-report";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export interface ReportMailData { brand: string; label: string; summary: SalesSummary; url: string; filename: string }

export function salesReportMail(d: ReportMailData) {
  const s = d.summary;
  const goods = s.itemsPaise - s.discountPaise;
  const rows: [string, string][] = [
    ["Orders", String(s.orders)], ["Units sold", String(s.units)], ["Goods sold (after discounts)", inr(goods)], ["Discounts given", inr(s.discountPaise)],
    ["Delivery charges", inr(s.deliveryPaise)], ["Total collected", inr(s.paidPaise)], ["Refunded", inr(s.refundedPaise)], ["Cancelled orders", String(s.cancelledOrders)],
  ];
  const text = [`${d.brand} sales report`, d.label, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `The full order list with GST is attached (${d.filename}).`, `More detail: ${d.url}`].join("\n");
  const cell = "padding:6px 0;border-bottom:1px solid #eee;font-size:14px";
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 4px">${esc(d.brand)} sales report</h2>
<p style="margin:0 0 16px;color:#555">${esc(d.label)}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
${rows.map(([k, v]) => `<tr><td style="${cell};color:#555">${esc(k)}</td><td style="${cell};text-align:right;font-weight:bold">${esc(v)}</td></tr>`).join("")}
</table>
<p style="font-size:13px;color:#555">The full order list with GST is attached as ${esc(d.filename)}.</p>
<p><a href="${esc(d.url)}" style="display:inline-block;background:#10b981;color:#111;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">Open analytics</a></p></div>`;
  return { subject: `${d.brand} sales report: ${d.label}`, text, html };
}
