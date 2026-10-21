export interface InvoiceInputItem { name: string; quantity: number; unitPaise: number; gstRatePercent: number; hsnCode?: string | null }

export interface InvoiceLine {
  description: string;
  // HSN or SAC code of the goods; empty for delivery or when none was entered.
  hsnCode: string | null;
  quantity: number;
  // What the customer paid for the line after its share of the discount (GST included when applicable).
  amountPaise: number;
  gstRatePercent: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface InvoiceBuild {
  lines: InvoiceLine[];
  totals: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; discountPaise: number; totalPaise: number };
}

// Splits a discount across lines in proportion to their value, to the paisa, so the parts always add up.
export function allocateDiscount(lineTotals: number[], discountPaise: number): number[] {
  const sum = lineTotals.reduce((a, b) => a + b, 0);
  if (sum === 0 || discountPaise <= 0) return lineTotals.map(() => 0);
  const exact = lineTotals.map((t) => (discountPaise * t) / sum);
  const parts = exact.map(Math.floor);
  let left = discountPaise - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

// Prices already include GST, so tax is carved out of what the customer paid.
function taxSplit(grossPaise: number, ratePercent: number, gstApplied: boolean, intraState: boolean) {
  if (!gstApplied || ratePercent <= 0) return { taxablePaise: grossPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
  const taxablePaise = Math.round((grossPaise * 100) / (100 + ratePercent));
  const tax = grossPaise - taxablePaise;
  if (!intraState) return { taxablePaise, cgstPaise: 0, sgstPaise: 0, igstPaise: tax };
  const cgstPaise = Math.floor(tax / 2);
  return { taxablePaise, cgstPaise, sgstPaise: tax - cgstPaise, igstPaise: 0 };
}

export function buildInvoice(input: {
  items: InvoiceInputItem[];
  discountPaise: number;
  shippingPaise: number;
  // What the delivery line is called; the cash-on-delivery fee is part of it.
  shippingLabel?: string;
  shippingGstPercent: number;
  gstApplied: boolean;
  // True when seller and buyer are in the same state (CGST + SGST); otherwise IGST.
  intraState: boolean;
}): InvoiceBuild {
  const gross = input.items.map((i) => i.unitPaise * i.quantity);
  const alloc = allocateDiscount(gross, input.discountPaise);

  const lines: InvoiceLine[] = input.items.map((item, idx) => {
    const amountPaise = gross[idx] - alloc[idx];
    return { description: item.name, hsnCode: item.hsnCode ?? null, quantity: item.quantity, amountPaise, gstRatePercent: input.gstApplied ? item.gstRatePercent : 0, ...taxSplit(amountPaise, item.gstRatePercent, input.gstApplied, input.intraState) };
  });
  if (input.shippingPaise > 0) {
    lines.push({
      description: input.shippingLabel ?? "Delivery charge", hsnCode: null, quantity: 1, amountPaise: input.shippingPaise, gstRatePercent: input.gstApplied ? input.shippingGstPercent : 0,
      ...taxSplit(input.shippingPaise, input.shippingGstPercent, input.gstApplied, input.intraState),
    });
  }

  const sum = (f: (l: InvoiceLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  return {
    lines,
    totals: {
      taxablePaise: sum((l) => l.taxablePaise), cgstPaise: sum((l) => l.cgstPaise), sgstPaise: sum((l) => l.sgstPaise), igstPaise: sum((l) => l.igstPaise),
      discountPaise: alloc.reduce((a, b) => a + b, 0), totalPaise: sum((l) => l.amountPaise),
    },
  };
}

// Indian financial year runs April to March; the date is taken in IST.
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const formatInvoiceNumber = (prefix: string, date: Date, serial: number) => `${prefix}/${financialYear(date)}/${String(serial).padStart(5, "0")}`;
