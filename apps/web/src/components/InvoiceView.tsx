"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, formatPrice } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Line { description: string; quantity: number; amountPaise: number; gstRatePercent: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
interface Invoice {
  number: string; issuedAt: string; type: "TAX_INVOICE" | "BILL_OF_SUPPLY"; orderRef: string; orderDate: string; paymentMethod: string; couponCode: string | null;
  seller: { name: string; address: string | null; state: string | null; gstin: string | null };
  buyer: { name: string; phone: string; address: string[]; state: string };
  intraState: boolean; lines: Line[];
  totals: { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; discountPaise: number; totalPaise: number };
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });

export function InvoiceView({ orderId }: { orderId: string }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<{ invoice: Invoice | null; error: string } | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=/invoice/${orderId}`);
  }, [ready, user, router, orderId]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let stale = false;
    fetch(`${API_URL}/orders/${orderId}/invoice`, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!stale) setState(r.ok ? { invoice: body, error: "" } : { invoice: null, error: [body?.message].flat().filter(Boolean).join(", ") || "Invoice not found" });
      })
      .catch(() => { if (!stale) setState({ invoice: null, error: "Could not load the invoice" }); });
    return () => { stale = true; };
  }, [userId, orderId]);

  if (!ready || !user || !state) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (!state.invoice) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Invoice unavailable</h1>
        <p className="mt-2 text-sm text-muted">{state.error}</p>
        <Link href="/orders" className="mt-4 inline-block text-brand-700 underline">Back to orders</Link>
      </div>
    );
  }

  const inv = state.invoice;
  const tax = inv.type === "TAX_INVOICE";
  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
  const num = "px-3 py-2 text-right tabular-nums";

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/orders" className="text-sm text-muted hover:text-ink">← Back to orders</Link>
        <button onClick={() => window.print()} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-3">Print / Save as PDF</button>
      </div>

      <article className="rounded-2xl border border-line bg-white p-8 text-sm shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <h1 className="text-2xl font-extrabold">{tax ? "Tax invoice" : "Bill of supply"}</h1>
            <p className="mt-1 text-muted">Invoice no. <span className="font-mono font-semibold text-ink">{inv.number}</span></p>
            <p className="text-muted">Date: {date(inv.issuedAt)} · Order {inv.orderRef} placed {date(inv.orderDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{inv.seller.name}</p>
            {inv.seller.address && <p className="max-w-xs text-muted">{inv.seller.address}</p>}
            {inv.seller.state && <p className="text-muted">{inv.seller.state}</p>}
            {inv.seller.gstin && <p className="font-mono text-xs">GSTIN {inv.seller.gstin}</p>}
          </div>
        </header>

        <section className="grid gap-6 py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Billed and shipped to</h2>
            <p className="mt-1 font-semibold">{inv.buyer.name}</p>
            {inv.buyer.address.map((l) => <p key={l} className="text-muted">{l}</p>)}
            <p className="text-muted">{inv.buyer.state} · Phone {inv.buyer.phone}</p>
          </div>
          <div className="sm:text-right">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Payment</h2>
            <p className="mt-1">{inv.paymentMethod === "ONLINE" ? "Paid online" : "Pay on delivery"}</p>
            {tax && <p className="text-muted">Place of supply: {inv.buyer.state}</p>}
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="border-y border-line bg-canvas/60">
              <th className={th}>Item</th><th className={`${th} text-right`}>Qty</th>
              {tax && <><th className={`${th} text-right`}>Taxable</th>{inv.intraState ? <><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th></> : <th className={`${th} text-right`}>IGST</th>}<th className={`${th} text-right`}>Rate</th></>}
              <th className={`${th} text-right`}>Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{l.description}</td><td className={num}>{l.quantity}</td>
                  {tax && <><td className={num}>{formatPrice(l.taxablePaise)}</td>{inv.intraState ? <><td className={num}>{formatPrice(l.cgstPaise)}</td><td className={num}>{formatPrice(l.sgstPaise)}</td></> : <td className={num}>{formatPrice(l.igstPaise)}</td>}<td className={num}>{l.gstRatePercent}%</td></>}
                  <td className={num}>{formatPrice(l.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1">
          {inv.totals.discountPaise > 0 && <div className="flex justify-between text-muted"><dt>Discount{inv.couponCode ? ` (${inv.couponCode})` : ""} included above</dt><dd>-{formatPrice(inv.totals.discountPaise)}</dd></div>}
          {tax && <div className="flex justify-between text-muted"><dt>Taxable value</dt><dd>{formatPrice(inv.totals.taxablePaise)}</dd></div>}
          {tax && inv.intraState && <><div className="flex justify-between text-muted"><dt>CGST</dt><dd>{formatPrice(inv.totals.cgstPaise)}</dd></div><div className="flex justify-between text-muted"><dt>SGST</dt><dd>{formatPrice(inv.totals.sgstPaise)}</dd></div></>}
          {tax && !inv.intraState && <div className="flex justify-between text-muted"><dt>IGST</dt><dd>{formatPrice(inv.totals.igstPaise)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total{tax ? " (incl. GST)" : ""}</dt><dd>{formatPrice(inv.totals.totalPaise)}</dd></div>
        </dl>

        <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">
          {tax ? "Prices include GST. This is a computer-generated invoice." : "The seller is not registered under GST, so no tax is charged. This is a computer-generated bill."}
        </footer>
      </article>
    </div>
  );
}
