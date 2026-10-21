"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/api";
import { useAdminQuery } from "@/lib/admin";
import { Alert, Skeleton } from "@/components/admin/ui";

interface Addr { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }
interface Sheet {
  id: string; status: string; createdAt: string; paymentMethod: string; totalPaise: number; advancePaise: number; collectPaise: number;
  shippingName: string; shippingAddr: Addr; gifts: string[]; courierName: string | null; trackingNumber: string | null;
  items: { name: string; sku: string | null; optionLabel: string | null; quantity: number; weightGrams: number | null }[];
  totalWeightGrams: number | null;
}
interface Data { seller: { name: string; address: string | null }; orders: Sheet[] }

const ref = (id: string) => id.slice(-8).toUpperCase();
const units = (o: Sheet) => o.items.reduce((n, i) => n + i.quantity, 0);
const weight = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2)} kg` : `${g} g`);

function Label({ o, seller }: { o: Sheet; seller: Data["seller"] }) {
  const a = o.shippingAddr;
  return (
    <article aria-label={`Shipping label ${ref(o.id)}`} className="break-inside-avoid border-2 border-black p-4 text-black">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-2xl font-bold tracking-widest">#{ref(o.id)}</p>
        <p className="text-right text-xs">{units(o)} {units(o) === 1 ? "item" : "items"}<br />{new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
      </div>
      <div className={`mt-3 border-2 border-black px-3 py-2 text-center ${o.collectPaise > 0 ? "bg-black text-white" : ""}`}>
        {o.collectPaise > 0 ? <p className="text-lg font-extrabold">COLLECT {formatPrice(o.collectPaise)} CASH</p> : <p className="text-lg font-extrabold">PREPAID: DO NOT COLLECT</p>}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider">Deliver to</p>
      <address className="text-base not-italic leading-snug">
        <strong className="text-lg">{o.shippingName}</strong><br />
        {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
        {a.city}, {a.state}<br />
        <span className="text-2xl font-bold tracking-widest">{a.pincode}</span><br />
        Phone: <strong>{a.phone}</strong>
      </address>
      <p className="mt-3 border-t border-dashed border-black pt-2 text-xs"><strong>From:</strong> {seller.name}{seller.address ? `, ${seller.address}` : ""}</p>
      {(o.courierName || o.trackingNumber) && <p className="mt-1 text-xs"><strong>Courier:</strong> {[o.courierName, o.trackingNumber].filter(Boolean).join(" ")}</p>}
      {o.totalWeightGrams ? <p className="mt-1 text-xs"><strong>Weight:</strong> {weight(o.totalWeightGrams)}</p> : null}
    </article>
  );
}

function Slip({ o, seller }: { o: Sheet; seller: Data["seller"] }) {
  const a = o.shippingAddr;
  return (
    <article aria-label={`Packing slip ${ref(o.id)}`} className="break-after-page p-2 text-sm text-black last:break-after-auto">
      <header className="flex items-start justify-between border-b-2 border-black pb-3">
        <div><p className="text-xl font-bold">{seller.name}</p>{seller.address && <p className="max-w-xs text-xs">{seller.address}</p>}</div>
        <div className="text-right"><p className="text-xs font-semibold uppercase tracking-wider">Packing slip</p><p className="font-mono text-xl font-bold">#{ref(o.id)}</p><p className="text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p></div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div><p className="text-xs font-semibold uppercase tracking-wider">Ship to</p><address className="not-italic leading-snug"><strong>{o.shippingName}</strong><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />Phone: {a.phone}</address></div>
        <div><p className="text-xs font-semibold uppercase tracking-wider">Payment</p><p>{o.collectPaise > 0 ? `Collect ${formatPrice(o.collectPaise)} on delivery` : "Paid online, nothing to collect"}</p><p className="text-xs">Order total {formatPrice(o.totalPaise)}</p></div>
      </div>
      <table className="mt-5 w-full border-collapse text-left">
        <thead><tr className="border-b-2 border-black text-xs uppercase tracking-wider"><th className="w-8 py-1.5">Packed</th><th className="py-1.5">Item</th><th className="py-1.5">SKU</th><th className="py-1.5 text-right">Qty</th></tr></thead>
        <tbody>
          {o.items.map((i, n) => (
            <tr key={n} className="border-b border-black/30">
              <td className="py-2"><span className="inline-block h-4 w-4 border-2 border-black" /></td>
              <td className="py-2">{i.name}{i.optionLabel ? <span className="text-xs"> ({i.optionLabel})</span> : null}{i.weightGrams ? <span className="block text-xs">{weight(i.weightGrams)} each</span> : null}</td>
              <td className="py-2 font-mono text-xs">{i.sku ?? ""}</td>
              <td className="py-2 text-right text-base font-bold">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.totalWeightGrams ? <p className="mt-3 text-right text-sm">Parcel weight: <strong>{weight(o.totalWeightGrams)}</strong></p> : null}
      {o.gifts.length > 0 && <p className="mt-4 border-2 border-black p-2 font-semibold">Pack with this order: {o.gifts.join(", ")}</p>}
      <p className="mt-8 text-center text-xs">Thank you for shopping with {seller.name}.</p>
    </article>
  );
}

function PrintSheets() {
  const params = useSearchParams();
  const ids = params.get("ids") ?? "";
  const kind = params.get("kind") === "slips" ? "slips" : "labels";
  const data = useAdminQuery<Data>(`/admin/orders/labels?ids=${encodeURIComponent(ids)}`);
  const other = kind === "labels" ? "slips" : "labels";

  return (
    <>
      <style>{"@media print { @page { margin: 8mm; } }"}</style>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{kind === "labels" ? "Shipping labels" : "Packing slips"}</h1>
          <p className="text-sm text-muted">{data.data ? `${data.data.orders.length} ${data.data.orders.length === 1 ? "order" : "orders"}` : "Loading…"}. Use your browser&apos;s print dialog and choose A4 or your label paper.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/orders" className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-ink/40">← Orders</Link>
          <Link href={`/admin/print?kind=${other}&ids=${encodeURIComponent(ids)}`} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-ink/40">{other === "labels" ? "Shipping labels" : "Packing slips"} instead</Link>
          <button type="button" onClick={() => window.print()} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-600">Print</button>
        </div>
      </div>
      {data.error && <Alert tone="error">{data.error}</Alert>}
      {data.loading ? <Skeleton rows={3} /> : data.data && data.data.orders.length === 0 ? <p className="text-sm text-muted">No orders to print. Choose orders on the Orders screen first.</p> : data.data && (
        kind === "labels"
          ? <div className="grid gap-4 sm:grid-cols-2 print:gap-3">{data.data.orders.map((o) => <Label key={o.id} o={o} seller={data.data!.seller} />)}</div>
          : <div className="space-y-6 print:space-y-0">{data.data.orders.map((o) => <Slip key={o.id} o={o} seller={data.data!.seller} />)}</div>
      )}
    </>
  );
}

export default function PrintPage() {
  return <Suspense fallback={<Skeleton rows={3} />}><PrintSheets /></Suspense>;
}
