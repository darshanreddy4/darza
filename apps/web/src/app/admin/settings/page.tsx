"use client";

import { useState, type FormEvent } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { IN_STATES } from "@/lib/states";
import { Alert, Badge, Card, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import { Select } from "@/components/Select";

interface Settings {
  shippingFeePaise: number; freeShippingOverPaise: number | null; freeAllOverPaise: number | null;
  codEnabled: boolean; codFeePaise: number; codMaxOrderPaise: number | null; advanceEnabled: boolean;
  deliveryZones: { name: string; pincodes: string[]; feePaise: number; freeOverPaise: number | null }[];
  giftTiers: { atPaise: number; title: string; kind?: "PERCENT"; percent?: number; maxPaise?: number }[];
  gstEnabled: boolean; gstin: string | null; legalName: string | null;
  businessAddress: string | null; businessState: string | null; shippingGstPercent: number; invoicePrefix: string; nextInvoiceNo: number; returnWindowDays: number; lowStockThreshold: number; skuWeightEnabled: boolean; optionStockAlerts: boolean; orderProgressEnabled: boolean; guestCheckoutEnabled: boolean; guestCodEnabled: boolean; guestMinAdvancePaise: number; alertEmail: string | null; reportSchedule: "OFF" | "WEEKLY" | "MONTHLY"; reportEmail: string | null; reportLastSentAt: string | null;
}

const toRupees = (paise: number | null) => (paise === null ? "" : String(paise / 100));
const toPaise = (rupees: string) => Math.round(Number(rupees) * 100);

interface ZoneRow { name: string; pincodes: string; fee: string; freeOn: boolean; freeOver: string }
interface GiftRow { at: string; title: string; kind: "GIFT" | "PERCENT"; percent: string; max: string }

// Each PIN code start is 1 to 6 digits, separated by commas, spaces or new lines.
const splitPins = (text: string) => [...new Set(text.split(/[\s,]+/).filter(Boolean))];

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
  const [freeAllOn, setFreeAllOn] = useState(initial.freeAllOverPaise !== null);
  const [freeAll, setFreeAll] = useState(toRupees(initial.freeAllOverPaise ?? 150000));
  const [zones, setZones] = useState<ZoneRow[]>(initial.deliveryZones.map((z) => ({ name: z.name, pincodes: z.pincodes.join(", "), fee: toRupees(z.feePaise), freeOn: z.freeOverPaise !== null, freeOver: toRupees(z.freeOverPaise ?? 99900) })));
  const [gifts, setGifts] = useState<GiftRow[]>(initial.giftTiers.map((g) => ({ at: toRupees(g.atPaise), title: g.kind === "PERCENT" ? "" : g.title, kind: g.kind === "PERCENT" ? "PERCENT" : "GIFT", percent: g.percent ? String(g.percent) : "", max: g.maxPaise ? toRupees(g.maxPaise) : "" })));
  const [gstEnabled, setGstEnabled] = useState(initial.gstEnabled);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [legalName, setLegalName] = useState(initial.legalName ?? "");
  const [address, setAddress] = useState(initial.businessAddress ?? "");
  const [state, setState] = useState(initial.businessState ?? "");
  const [shipGst, setShipGst] = useState(String(initial.shippingGstPercent));
  const [prefix, setPrefix] = useState(initial.invoicePrefix);
  const [returnDays, setReturnDays] = useState(String(initial.returnWindowDays));
  const [codOn, setCodOn] = useState(initial.codEnabled);
  const [codFee, setCodFee] = useState(toRupees(initial.codFeePaise));
  const [codLimitOn, setCodLimitOn] = useState(initial.codMaxOrderPaise !== null);
  const [codLimit, setCodLimit] = useState(toRupees(initial.codMaxOrderPaise ?? 500000));
  const [advanceOn, setAdvanceOn] = useState(initial.advanceEnabled);
  const [lowStock, setLowStock] = useState(String(initial.lowStockThreshold));
  const [skuWeightOn, setSkuWeightOn] = useState(initial.skuWeightEnabled ?? false);
  const [optionAlertsOn, setOptionAlertsOn] = useState(initial.optionStockAlerts ?? false);
  const [progressOn, setProgressOn] = useState(initial.orderProgressEnabled ?? true);
  const [guestOn, setGuestOn] = useState(initial.guestCheckoutEnabled ?? false);
  const [guestCodOn, setGuestCodOn] = useState(initial.guestCodEnabled ?? true);
  const [guestMin, setGuestMin] = useState(toRupees(initial.guestMinAdvancePaise ?? 5000));
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
    if (freeAllOn && (!Number.isFinite(Number(freeAll)) || Number(freeAll) <= 0)) return setError("Enter the order amount above which everything ships free");
    for (const z of zones) {
      const pins = splitPins(z.pincodes);
      if (!z.name.trim()) return setError("Give each delivery area a name");
      if (pins.length === 0 || pins.some((p) => !/^[1-9]\d{0,5}$/.test(p))) return setError(`${z.name.trim()}: PIN code starts must be 1 to 6 digits, separated by commas`);
      if (!Number.isFinite(Number(z.fee)) || Number(z.fee) < 0 || z.fee === "") return setError(`${z.name.trim()}: enter a valid delivery fee`);
      if (z.freeOn && (!Number.isFinite(Number(z.freeOver)) || Number(z.freeOver) <= 0)) return setError(`${z.name.trim()}: enter the amount above which delivery is free`);
    }
    for (const g of gifts) {
      if (!Number.isFinite(Number(g.at)) || Number(g.at) <= 0) return setError(`${g.kind === "PERCENT" ? "A percentage reward" : g.title.trim() || "A gift"}: enter the order amount that earns it`);
      if (g.kind === "GIFT" && !g.title.trim()) return setError("Describe each gift");
      if (g.kind === "PERCENT" && (!Number.isInteger(Number(g.percent)) || Number(g.percent) < 1 || Number(g.percent) > 90)) return setError("A percentage reward needs a whole percentage from 1 to 90");
      if (g.kind === "PERCENT" && g.max && (!Number.isFinite(Number(g.max)) || Number(g.max) < 0)) return setError("Enter a valid maximum discount");
    }
    if (!Number.isInteger(Number(returnDays)) || Number(returnDays) < 0 || Number(returnDays) > 90) return setError("Return window must be a whole number of days from 0 to 90");
    if (reportSchedule !== "OFF" && !reportEmail.trim()) return setError("Add the email address the sales report should go to");
    if (!Number.isInteger(Number(lowStock)) || Number(lowStock) < 0 || Number(lowStock) > 1000) return setError("Low stock level must be a whole number from 0 to 1000");
    if (guestOn && guestCodOn && (!Number.isFinite(Number(guestMin)) || Number(guestMin) < 0)) return setError("Enter the least a guest pays online, or 0");
    setBusy(true);
    try {
      await call("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          shippingFeePaise: toPaise(fee), freeShippingOverPaise: freeOn ? toPaise(freeOver) : 0, freeAllOverPaise: freeAllOn ? toPaise(freeAll) : 0,
          codEnabled: codOn, codFeePaise: toPaise(codFee), codMaxOrderPaise: codLimitOn ? toPaise(codLimit) : 0, advanceEnabled: advanceOn,
          deliveryZones: zones.map((z) => ({ name: z.name.trim(), pincodes: splitPins(z.pincodes), feePaise: toPaise(z.fee), freeOverPaise: z.freeOn ? toPaise(z.freeOver) : 0 })),
          giftTiers: gifts.map((g) => (g.kind === "PERCENT"
            ? { atPaise: toPaise(g.at), title: `${Number(g.percent)}% off your order`, kind: "PERCENT", percent: Number(g.percent), maxDiscountPaise: g.max ? toPaise(g.max) : 0 }
            : { atPaise: toPaise(g.at), title: g.title.trim() })),
          gstEnabled, gstin: gstin.trim().toUpperCase(), legalName: legalName.trim(), businessAddress: address.trim(), businessState: state,
          shippingGstPercent: Number(shipGst), invoicePrefix: prefix.trim().toUpperCase(), returnWindowDays: Number(returnDays), lowStockThreshold: Number(lowStock), skuWeightEnabled: skuWeightOn, optionStockAlerts: optionAlertsOn, orderProgressEnabled: progressOn,
          guestCheckoutEnabled: guestOn, guestCodEnabled: guestCodOn, guestMinAdvancePaise: Number.isFinite(Number(guestMin)) ? toPaise(guestMin) : 5000, alertEmail: alertEmail.trim(), reportSchedule, reportEmail: reportEmail.trim(),
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
            <span><span className="font-medium">Free delivery on bigger orders</span><br /><span className="text-xs text-muted">Measured on the cart value before any coupon.</span></span>
          </label>
          {freeOn && (
            <label className={`${label} ml-7`}>Free delivery for orders of ₹ or more
              <input type="number" min={1} step="0.01" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
            </label>
          )}
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={freeAllOn} onChange={(e) => setFreeAllOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Free delivery on everything for very big orders</span><br /><span className="text-xs text-muted">Waives every delivery charge, heavy or bulky items and areas with their own fee included. Measured on the cart value before any coupon.</span></span>
          </label>
          {freeAllOn && (
            <label className={`${label} ml-7`}>Everything ships free for orders of ₹ or more
              <input type="number" min={1} step="0.01" value={freeAll} onChange={(e) => setFreeAll(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
            </label>
          )}
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
            The free-delivery amount above is measured on the whole basket, but it only waives the charge on regular products. A product marked &ldquo;always charge delivery&rdquo; (set on its edit page) is still charged its own delivery in a big order,
            until the whole order reaches the free-everything amount. Products marked &ldquo;always free&rdquo; never add to the charge.
          </p>
        </div>
      </Card>

      <Card title="Pay on delivery" description="Cash or UPI paid to the courier. Many sellers add a small fee and a limit, because returns on these orders cost the most.">
        <div className="space-y-4 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={codOn} onChange={(e) => setCodOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Offer pay on delivery</span><br /><span className="text-xs text-muted">Switch it off to take online payments only. Make sure online payments are set up first, or customers will have no way to pay.</span></span>
          </label>
          {codOn && (
            <>
              <label className={`${label} ml-7`}>Extra fee for pay on delivery (₹)
                <input type="number" min={0} step="0.01" value={codFee} onChange={(e) => setCodFee(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
                <span className={hint}>Added to the order total only when the customer chooses pay on delivery, and shown at checkout. Enter 0 for no fee.</span>
              </label>
              <label className="ml-7 flex items-start gap-3">
                <input type="checkbox" checked={codLimitOn} onChange={(e) => setCodLimitOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Limit the order size</span><br /><span className="text-xs text-muted">Bigger orders must be paid online.</span></span>
              </label>
              {codLimitOn && (
                <label className={`${label} ml-14`}>Pay on delivery up to (₹)
                  <input type="number" min={1} step="0.01" value={codLimit} onChange={(e) => setCodLimit(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
                </label>
              )}
            </>
          )}
        </div>
      </Card>

      <Card title="Part payment" description="Let customers pay a share online when they order (often 30 to 40 percent) and the rest to the courier on delivery. It suits big or costly items, where cash-only orders get refused at the door.">
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={advanceOn} onChange={(e) => setAdvanceOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Offer part payment</span><br /><span className="text-xs text-muted">Turns on a &ldquo;How customers can pay&rdquo; choice on each product, where you set the share for the products that should use it. Customers see it on those products and at checkout, and it needs online payments to be set up. A basket can be part-paid only when every product in it allows it.</span></span>
          </label>
        </div>
      </Card>

      <Card title="Guest checkout" description="Let shoppers order without creating an account: they confirm their mobile number with a code and no password is needed. Guest orders carry less risk because the shopper pays before anything ships.">
        <div className="space-y-4 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={guestOn} onChange={(e) => setGuestOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Allow guest checkout</span><br /><span className="text-xs text-muted">Shoppers who are not signed in can continue with just a name and a mobile number. Behind the scenes a simple account is kept for them so they can track and return orders by signing in with a code. They stop being guests once they set a password or confirm an email. Needs text messages (SMS) and online payments to be set up.</span></span>
          </label>
          {guestOn && (
            <div className="ml-7 space-y-4">
              <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">A guest can always pay in full online. Pay on delivery in full is never offered to guests.</p>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={guestCodOn} onChange={(e) => setGuestCodOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Let guests pay the delivery charge now and the rest on delivery</span><br /><span className="text-xs text-muted">They pay the delivery charge (and your pay-on-delivery fee, if any) online first, and the rest in cash or by UPI to the courier. It follows your pay-on-delivery limit and products that must be paid online.</span></span>
              </label>
              {guestCodOn && (
                <label className={label}>Least a guest pays online (₹)
                  <input type="number" min={0} step="0.01" value={guestMin} onChange={(e) => setGuestMin(e.target.value)} className={`${inputCls} mt-1.5 !w-40`} />
                  <span className={hint}>Used when delivery is free or very cheap, so a guest still commits something. Enter 0 to charge only the delivery.</span>
                </label>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title="Order progress bar" description="Lets customers see where their order is without contacting you.">
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={progressOn} onChange={(e) => setProgressOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Show an order progress bar on My orders</span><br /><span className="text-xs text-muted">Each order shows four steps: order placed, preparing, shipped (with the date and courier) and delivered. It follows the status you set on the Orders screen. Cancelled and refunded orders show no bar. Switch it off if you prefer customers to see only the status.</span></span>
          </label>
        </div>
      </Card>

      <Card title="Weights, SKUs and option stock" description="Optional extras for products that come in sizes, colours or weights. Switching one off hides it; what you already saved is kept.">
        <div className="space-y-4 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={skuWeightOn} onChange={(e) => setSkuWeightOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Record weight and a SKU for each option</span><br /><span className="text-xs text-muted">Adds a weight (in grams) to every product and a SKU and weight to every option on the product page. Packing slips and labels then show the SKU of the exact option bought and the weight of the parcel.</span></span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={optionAlertsOn} onChange={(e) => setOptionAlertsOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span><span className="font-medium">Low stock alerts for each option</span><br /><span className="text-xs text-muted">Today a product counts as low only when all its options together are low. With this on, one option at or below the low stock level (say size L down to 2 while XL has 40) also appears on the Attention list and in the low stock email.</span></span>
          </label>
        </div>
      </Card>

      <Card title="Delivery by area" description="Areas that pay a different delivery fee, picked by the first digits of the customer's PIN code. Leave empty to charge the same everywhere.">
        <div className="space-y-4 text-sm">
          {zones.map((z, i) => (
            <fieldset key={i} className="space-y-3 rounded-xl border border-line p-4" aria-label={`Delivery area ${i + 1}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>Area name
                  <input aria-label="Area name" value={z.name} maxLength={60} onChange={(e) => setZones((l) => l.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} placeholder="North East" className={`${inputCls} mt-1.5`} />
                </label>
                <label className={label}>Delivery fee (₹)
                  <input aria-label="Area delivery fee" type="number" min={0} step="0.01" value={z.fee} onChange={(e) => setZones((l) => l.map((x, n) => (n === i ? { ...x, fee: e.target.value } : x)))} className={`${inputCls} mt-1.5`} />
                </label>
                <label className={`${label} sm:col-span-2`}>PIN codes starting with
                  <input aria-label="PIN codes starting with" value={z.pincodes} onChange={(e) => setZones((l) => l.map((x, n) => (n === i ? { ...x, pincodes: e.target.value } : x)))} placeholder="78, 79, 744" className={`${inputCls} mt-1.5 font-mono`} />
                  <span className={hint}>One to six digits each, separated by commas. 79 means every PIN code that begins 79; a longer start such as 795001 wins over a shorter one.</span>
                </label>
              </div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={z.freeOn} onChange={(e) => setZones((l) => l.map((x, n) => (n === i ? { ...x, freeOn: e.target.checked } : x)))} className="h-4 w-4 accent-emerald-600" />
                <span>Free delivery here for bigger orders</span>
              </label>
              {z.freeOn && (
                <label className={`${label} ml-7`}>Free for orders of ₹ or more
                  <input aria-label="Area free delivery amount" type="number" min={1} step="0.01" value={z.freeOver} onChange={(e) => setZones((l) => l.map((x, n) => (n === i ? { ...x, freeOver: e.target.value } : x)))} className={`${inputCls} mt-1.5 !w-40`} />
                </label>
              )}
              <button type="button" onClick={() => setZones((l) => l.filter((_, n) => n !== i))} className={btn.danger}>Remove area</button>
            </fieldset>
          ))}
          {zones.length < 20 && <button type="button" onClick={() => setZones((l) => [...l, { name: "", pincodes: "", fee: fee || "0", freeOn: false, freeOver: "999" }])} className={btn.secondary}>Add a delivery area</button>}
        </div>
      </Card>

      <Card title="Rewards for big orders" description="Shown to customers on a progress line at the top of the cart and checkout, with a little celebration when they unlock one. Add a free gift, a percentage off the whole order, or both at different amounts.">
        <div className="space-y-3 text-sm">
          {gifts.map((g, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
              <label className={label}>Reward
                <Select aria-label="Reward type" value={g.kind} onChange={(e) => setGifts((l) => l.map((x, n) => (n === i ? { ...x, kind: e.target.value as GiftRow["kind"] } : x)))} className={`${inputCls} mt-1.5 !w-56`}>
                  <option value="GIFT">Free gift or surprise</option>
                  <option value="PERCENT">Percentage off the order</option>
                </Select>
              </label>
              <label className={label}>Order of ₹ or more
                <input aria-label="Gift order amount" type="number" min={1} step="0.01" value={g.at} onChange={(e) => setGifts((l) => l.map((x, n) => (n === i ? { ...x, at: e.target.value } : x)))} className={`${inputCls} mt-1.5 !w-36`} />
              </label>
              {g.kind === "GIFT" ? (
                <label className={`${label} min-w-48 flex-1`}>Gift
                  <input aria-label="Gift" value={g.title} maxLength={60} onChange={(e) => setGifts((l) => l.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)))} placeholder="Free surprise gift" className={`${inputCls} mt-1.5`} />
                </label>
              ) : (
                <>
                  <label className={label}>Percentage off
                    <input aria-label="Percentage off" type="number" min={1} max={90} step={1} value={g.percent} onChange={(e) => setGifts((l) => l.map((x, n) => (n === i ? { ...x, percent: e.target.value } : x)))} className={`${inputCls} mt-1.5 !w-28`} />
                  </label>
                  <label className={label}>Up to (₹) <span className="font-normal text-muted">optional</span>
                    <input aria-label="Maximum reward discount" type="number" min={0} step="0.01" value={g.max} onChange={(e) => setGifts((l) => l.map((x, n) => (n === i ? { ...x, max: e.target.value } : x)))} className={`${inputCls} mt-1.5 !w-32`} />
                  </label>
                </>
              )}
              <button type="button" onClick={() => setGifts((l) => l.filter((_, n) => n !== i))} className={btn.danger}>Remove</button>
            </div>
          ))}
          {gifts.length < 8 && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setGifts((l) => [...l, { at: "", title: "", kind: "GIFT", percent: "", max: "" }])} className={btn.secondary}>Add a gift</button>
              <button type="button" onClick={() => setGifts((l) => [...l, { at: "", title: "", kind: "PERCENT", percent: "5", max: "" }])} className={btn.secondary}>Add a percentage off</button>
            </div>
          )}
          <p className={hint}>Gifts are listed on each order in Orders so you can pack them. A percentage off is taken from the order automatically (the best one reached applies, they do not add up) before any coupon. Free delivery and rewards are measured on the cart value before any coupon.</p>
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
            <Select value={reportSchedule} onChange={(e) => setReportSchedule(e.target.value as Settings["reportSchedule"])} className={`${inputCls} mt-1.5`}>
              <option value="OFF">Never</option>
              <option value="WEEKLY">Every Monday, for the week before</option>
              <option value="MONTHLY">On the 1st, for the month before</option>
            </Select>
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
                <Select value={state} onChange={(e) => setState(e.target.value)} className={`${inputCls} mt-1.5`}>
                  <option value="">Select state</option>
                  {IN_STATES.map((s) => <option key={s}>{s}</option>)}
                </Select>
                <span className={hint}>Sales inside this state show CGST + SGST; other states show IGST.</span>
              </label>
              <label className={label}>GST on delivery charges
                <Select value={shipGst} onChange={(e) => setShipGst(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
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
