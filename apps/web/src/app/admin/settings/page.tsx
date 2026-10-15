"use client";

import { useState, type FormEvent } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { IN_STATES } from "@/lib/states";
import { Alert, Badge, Card, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";

interface Settings {
  shippingFeePaise: number; freeShippingOverPaise: number | null; gstEnabled: boolean; gstin: string | null; legalName: string | null;
  businessAddress: string | null; businessState: string | null; shippingGstPercent: number; invoicePrefix: string; nextInvoiceNo: number; returnWindowDays: number; lowStockThreshold: number; alertEmail: string | null; reportSchedule: "OFF" | "WEEKLY" | "MONTHLY"; reportEmail: string | null; reportLastSentAt: string | null;
}

const toRupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

export default function SettingsPage() {
  const settings = useAdminQuery<Settings>("/admin/settings");
  return (
    <>
      <PageHeader title="Store settings" description="Delivery charges, GST and invoice details." />
      {settings.error && <Alert tone="error">{settings.error}</Alert>}
      {settings.loading || !settings.data ? <Skeleton rows={4} /> : <SettingsForm initial={settings.data} onSaved={settings.reload} />}
    </>
  );
}

function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const call = useAdminApi();
  const [fee, setFee] = useState(toRupees(initial.shippingFeePaise));
  const [freeOn, setFreeOn] = useState(initial.freeShippingOverPaise !== null);
  const [freeOver, setFreeOver] = useState(toRupees(initial.freeShippingOverPaise ?? 49900));
  const [gstEnabled, setGstEnabled] = useState(initial.gstEnabled);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [legalName, setLegalName] = useState(initial.legalName ?? "");
  const [address, setAddress] = useState(initial.businessAddress ?? "");
  const [state, setState] = useState(initial.businessState ?? "");
  const [shipGst, setShipGst] = useState(String(initial.shippingGstPercent));
  const [prefix, setPrefix] = useState(initial.invoicePrefix);
  const [returnDays, setReturnDays] = useState(String(initial.returnWindowDays));
  const [lowStock, setLowStock] = useState(String(initial.lowStockThreshold));
  const [alertEmail, setAlertEmail] = useState(initial.alertEmail ?? "");
  const [reportSchedule, setReportSchedule] = useState(initial.reportSchedule);
  const [reportEmail, setReportEmail] = useState(initial.reportEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!Number.isFinite(Number(fee)) || Number(fee) < 0) return setError("Enter a valid delivery fee");
    if (freeOn && (!Number.isFinite(Number(freeOver)) || Number(freeOver) <= 0)) return setError("Enter the order amount above which delivery is free");
    if (!Number.isInteger(Number(returnDays)) || Number(returnDays) < 0 || Number(returnDays) > 90) return setError("Return window must be a whole number of days from 0 to 90");
    if (reportSchedule !== "OFF" && !reportEmail.trim()) return setError("Add the email address the sales report should go to");
    if (!Number.isInteger(Number(lowStock)) || Number(lowStock) < 0 || Number(lowStock) > 1000) return setError("Low stock level must be a whole number from 0 to 1000");
    setBusy(true);
    try {
      await call("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          shippingFeePaise: toPaise(fee), freeShippingOverPaise: freeOn ? toPaise(freeOver) : 0,
          gstEnabled, gstin: gstin.trim().toUpperCase(), legalName: legalName.trim(), businessAddress: address.trim(), businessState: state,
          shippingGstPercent: Number(shipGst), invoicePrefix: prefix.trim().toUpperCase(), returnWindowDays: Number(returnDays), lowStockThreshold: Number(lowStock), alertEmail: alertEmail.trim(), reportSchedule, reportEmail: reportEmail.trim(),
        }),
      });
      setNotice("Settings saved");
      onSaved();
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function sendReport() {
    setError(""); setNotice(""); setSending(true);
    try {
      const r = await call<{ sent: boolean; label: string; orders: number; to: string }>("/admin/sales-report/send", { method: "POST" });
      setNotice(r.sent ? `Sent the report for ${r.label} (${r.orders} orders) to ${r.to}` : "The report could not be sent. Check the mail settings and try again.");
    } catch (err) { setError((err as Error).message); }
    setSending(false);
  }

  const label = "block text-sm font-medium";
  const hint = "mt-1 text-xs text-muted";

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Card title="Delivery charges" description="Charged on each order and shown to customers in the cart and at checkout.">
        <div className="space-y-4 text-sm">
          <label className={label}>Delivery fee (₹)
            <input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
            <span className={hint}>Enter 0 to deliver everything free.</span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={freeOn} onChange={(e) => setFreeOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Free delivery on bigger orders</span><br /><span className="text-xs text-muted">Measured after any coupon discount.</span></span>
          </label>
          {freeOn && (
            <label className={`${label} ml-7`}>Free delivery for orders of ₹ or more
              <input type="number" min={1} step="0.01" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
            </label>
          )}
        </div>
      </Card>

      <Card title="Returns" description="How long after delivery a customer can ask to return an order from My orders.">
        <label className={`${label} text-sm`}>Return window (days)
          <input type="number" min={0} max={90} step={1} value={returnDays} onChange={(e) => setReturnDays(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
          <span className={hint}>Counted from the day the order is marked delivered. Enter 0 to stop taking return requests.</span>
        </label>
      </Card>

      <Card title="Inventory alerts" description="Know when your own products are about to sell out.">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <label className={label}>Low stock level (units)
            <input type="number" min={0} max={1000} step={1} value={lowStock} onChange={(e) => setLowStock(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
            <span className={hint}>Products at or below this are listed as low stock in the admin.</span>
          </label>
          <label className={label}>Email the alerts to
            <input type="email" value={alertEmail} maxLength={200} onChange={(e) => setAlertEmail(e.target.value)} placeholder="stock@yourshop.com" className={`${inputCls} mt-1.5`} />
            <span className={hint}>One email lists the products that newly drop to the low stock level. Leave blank for no emails.</span>
          </label>
        </div>
      </Card>

      <Card title="Sales report by email" description="A summary of the last week or month with the full order list (including GST) attached as a spreadsheet.">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <label className={label}>How often
            <select value={reportSchedule} onChange={(e) => setReportSchedule(e.target.value as Settings["reportSchedule"])} className={`${inputCls} mt-1.5`}>
              <option value="OFF">Never</option>
              <option value="WEEKLY">Every Monday, for the week before</option>
              <option value="MONTHLY">On the 1st, for the month before</option>
            </select>
          </label>
          <label className={label}>Send it to
            <input type="email" value={reportEmail} maxLength={200} onChange={(e) => setReportEmail(e.target.value)} placeholder="accounts@yourshop.com" className={`${inputCls} mt-1.5`} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
          <button type="button" onClick={sendReport} disabled={sending || initial.reportSchedule === "OFF" || !initial.reportEmail} className={btn.secondary}>{sending ? "Sending…" : "Send the last report now"}</button>
          <span>{initial.reportSchedule === "OFF" ? "Save a schedule first to try it." : initial.reportLastSentAt ? `Last run ${new Date(initial.reportLastSentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.` : "Has not run yet."}</span>
        </div>
      </Card>

      <Card title="GST and invoices" description="Switch GST on once you have your GST number. Until then, customers get a plain bill of supply.">
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 font-medium">
              <input type="checkbox" checked={gstEnabled} onChange={(e) => setGstEnabled(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              I&apos;m registered for GST
            </label>
            <Badge tone={gstEnabled ? "green" : "slate"}>{gstEnabled ? "Tax invoices" : "Bill of supply"}</Badge>
          </div>
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            Your selling prices are treated as GST-inclusive: the tax is shown inside the price on the invoice, so customers pay the same amount.
            Orders placed before you switch GST on keep their bill of supply. Set each product&apos;s GST rate on its edit page.
          </p>
          {gstEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>GST number (GSTIN)
                <input value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className={`${inputCls} mt-1.5 font-mono`} />
              </label>
              <label className={label}>Business name on invoices
                <input value={legalName} maxLength={120} onChange={(e) => setLegalName(e.target.value)} className={`${inputCls} mt-1.5`} />
              </label>
              <label className={`${label} sm:col-span-2`}>Business address
                <textarea value={address} maxLength={300} rows={2} onChange={(e) => setAddress(e.target.value)} className={`${inputCls} mt-1.5`} />
              </label>
              <label className={label}>State
                <select value={state} onChange={(e) => setState(e.target.value)} className={`${inputCls} mt-1.5`}>
                  <option value="">Select state</option>
                  {IN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <span className={hint}>Sales inside this state show CGST + SGST; other states show IGST.</span>
              </label>
              <label className={label}>GST on delivery charges
                <select value={shipGst} onChange={(e) => setShipGst(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <label className={label}>Invoice number prefix
              <input value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className={`${inputCls} mt-1.5 !w-32 font-mono`} />
            </label>
            <p className="self-end text-xs text-muted">Next invoice number: <span className="font-mono font-semibold">{initial.nextInvoiceNo}</span>. Numbers run in order without gaps, restarting is not possible.</p>
          </div>
        </div>
      </Card>

      <button disabled={busy} className={`${btn.primary} py-2.5`}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
