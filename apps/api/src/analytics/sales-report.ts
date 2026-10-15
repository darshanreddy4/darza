import { toCsv } from "../users/csv";
import { buildInvoice } from "../store/invoice";

export interface ReportOrder {
  id: string; createdAt: Date; invoiceNumber: string | null; status: string; paymentMethod: string; couponCode: string | null;
  discountPaise: number; shippingPaise: number; totalPaise: number; refundedPaise: number; gstApplied: boolean;
  shippingAddr: { state?: string };
  user: { name: string; email: string | null; phone: string | null };
  items: { quantity: number; pricePaise: number; gstRatePercent: number }[];
}

export interface ReportSettings { businessState: string | null; shippingGstPercent: number }

export const REPORT_HEADER = [
  "Order", "Date (IST)", "Invoice no.", "Customer", "Contact", "Status", "Counts as sale", "Payment", "Units", "Items (INR)", "Discount (INR)", "Coupon", "Delivery (INR)",
  "Total paid (INR)", "Taxable value (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Refunded (INR)", "Ship-to state",
];

// Same rule as the analytics screens: placed orders that were not cancelled, refunded or left unpaid.
export const COUNTS_AS_SALE = (status: string) => !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(status);

const rupees = (paise: number) => (paise / 100).toFixed(2);
const istStamp = (d: Date) => new Date(d.getTime() + 19_800_000).toISOString().replace("T", " ").slice(0, 16);
const sameState = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

type Cell = string | number;

// One row per order, then a totals row for the orders that count as sales. GST is worked out the same way as on the invoice.
export function salesReportRows(orders: ReportOrder[], settings: ReportSettings): Cell[][] {
  const total = { units: 0, items: 0, discount: 0, delivery: 0, paid: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, refunded: 0 };

  const rows = orders.map((o) => {
    const sale = COUNTS_AS_SALE(o.status);
    const units = o.items.reduce((n, i) => n + i.quantity, 0);
    const items = o.items.reduce((n, i) => n + i.quantity * i.pricePaise, 0);
    const inv = buildInvoice({
      items: o.items.map((i) => ({ name: "", quantity: i.quantity, unitPaise: i.pricePaise, gstRatePercent: i.gstRatePercent })),
      discountPaise: o.discountPaise, shippingPaise: o.shippingPaise, shippingGstPercent: settings.shippingGstPercent,
      gstApplied: o.gstApplied, intraState: o.gstApplied && sameState(settings.businessState, o.shippingAddr.state),
    }).totals;

    if (sale) {
      total.units += units; total.items += items; total.discount += o.discountPaise; total.delivery += o.shippingPaise; total.paid += o.totalPaise;
      total.taxable += inv.taxablePaise; total.cgst += inv.cgstPaise; total.sgst += inv.sgstPaise; total.igst += inv.igstPaise;
    }
    total.refunded += o.refundedPaise;

    return [
      `#${o.id.slice(-8).toUpperCase()}`, istStamp(o.createdAt), o.invoiceNumber ?? "", o.user.name, o.user.email ?? o.user.phone ?? "", o.status, sale ? "Yes" : "No", o.paymentMethod,
      units, rupees(items), rupees(o.discountPaise), o.couponCode ?? "", rupees(o.shippingPaise), rupees(o.totalPaise),
      sale ? rupees(inv.taxablePaise) : "", sale ? rupees(inv.cgstPaise) : "", sale ? rupees(inv.sgstPaise) : "", sale ? rupees(inv.igstPaise) : "",
      rupees(o.refundedPaise), o.shippingAddr.state ?? "",
    ];
  });

  rows.push(["Total (orders that count as sales)", "", "", "", "", "", "", "", total.units, rupees(total.items), rupees(total.discount), "", rupees(total.delivery), rupees(total.paid),
    rupees(total.taxable), rupees(total.cgst), rupees(total.sgst), rupees(total.igst), rupees(total.refunded), ""]);
  return rows;
}

export const salesReportCsv = (orders: ReportOrder[], settings: ReportSettings) => toCsv(REPORT_HEADER, salesReportRows(orders, settings));

export interface SalesSummary { orders: number; units: number; itemsPaise: number; discountPaise: number; deliveryPaise: number; paidPaise: number; refundedPaise: number; cancelledOrders: number }

// The headline numbers for a period: what counts as a sale, what was given back, and what was cancelled.
export function summariseOrders(orders: ReportOrder[]): SalesSummary {
  const t: SalesSummary = { orders: 0, units: 0, itemsPaise: 0, discountPaise: 0, deliveryPaise: 0, paidPaise: 0, refundedPaise: 0, cancelledOrders: 0 };
  for (const o of orders) {
    t.refundedPaise += o.refundedPaise;
    if (o.status === "CANCELLED") t.cancelledOrders += 1;
    if (!COUNTS_AS_SALE(o.status)) continue;
    t.orders += 1;
    t.units += o.items.reduce((n, i) => n + i.quantity, 0);
    t.itemsPaise += o.items.reduce((n, i) => n + i.quantity * i.pricePaise, 0);
    t.discountPaise += o.discountPaise;
    t.deliveryPaise += o.shippingPaise;
    t.paidPaise += o.totalPaise;
  }
  return t;
}
