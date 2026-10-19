"use client";

import { useState, type ReactNode } from "react";
import { formatPrice } from "@/lib/api";
import { useAdminApi, type AdminProduct } from "@/lib/admin";
import { Alert, Card, btn, inputCls } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";
import { Select } from "@/components/Select";

interface Example { name: string; before: { pricePaise: number; mrpPaise: number | null }; after: { pricePaise: number; mrpPaise: number | null } }
interface Result { updated: number; missing: number; mrpRemoved: number; skipped: { id: string; name: string; reason: string }[]; examples: Example[]; dryRun: boolean }

const toPaise = (rupees: string) => {
  const n = Number(rupees);
  return rupees.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n * 100);
};

function Group({ title, on, setOn, children }: { title: string; on: boolean; setOn: (v: boolean) => void; children: ReactNode }) {
  return (
    <fieldset className={`rounded-xl border p-4 transition ${on ? "border-brand-500 bg-brand-50/40" : "border-line"}`}>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
        {title}
      </label>
      {on && <div className="mt-3 space-y-3 pl-7 text-sm">{children}</div>}
    </fieldset>
  );
}

export function BulkEditPanel({ products, onClose, onDone }: { products: AdminProduct[]; onClose: () => void; onDone: (message: string) => void }) {
  const brand = useBrand();
  const call = useAdminApi();
  const ownCount = products.filter((p) => p.productType === "OWN").length;

  const [dealOn, setDealOn] = useState(false);
  const [dealMode, setDealMode] = useState<"set" | "clear">("set");
  const [deal, setDeal] = useState("");
  const [priceOn, setPriceOn] = useState(false);
  const [priceMode, setPriceMode] = useState<"set" | "percent">("set");
  const [priceValue, setPriceValue] = useState("");
  const [keepOld, setKeepOld] = useState(false);
  const [mrpOn, setMrpOn] = useState(false);
  const [mrpMode, setMrpMode] = useState<"set" | "clear">("set");
  const [mrpValue, setMrpValue] = useState("");
  const [statusOn, setStatusOn] = useState(false);
  const [status, setStatus] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");
  const [featuredOn, setFeaturedOn] = useState(false);
  const [featured, setFeatured] = useState(true);
  const [stockOn, setStockOn] = useState(false);
  const [stock, setStock] = useState("");
  const [ratingOn, setRatingOn] = useState(false);
  const [rating, setRating] = useState(true);
  const [cartOn, setCartOn] = useState(false);
  const [cart, setCart] = useState(true);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"set" | "clear">("set");
  const [days, setDays] = useState("3");
  const [free, setFree] = useState(false);

  const [review, setReview] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Returns the request body or a message explaining what is missing.
  function build(): { changes: Record<string, unknown> } | { problem: string } {
    const c: Record<string, unknown> = {};
    if (dealOn) c.dealLabel = dealMode === "clear" ? "" : deal.trim();
    if (dealOn && dealMode === "set" && !deal.trim()) return { problem: "Type the deal label, or choose “Remove label”." };
    if (priceOn) {
      const n = Number(priceValue);
      if (priceValue.trim() === "" || !Number.isFinite(n)) return { problem: "Enter the new price or percentage." };
      if (priceMode === "set") { const p = toPaise(priceValue); if (p === undefined) return { problem: "Enter a valid price." }; c.pricePaise = p; }
      else { if (n < -90 || n > 500) return { problem: "The percentage must be between -90 and 500." }; c.priceChangePercent = n; }
      if (keepOld) c.mrpFromOldPrice = true;
    }
    if (mrpOn && !keepOld) {
      if (mrpMode === "clear") c.clearMrp = true;
      else { const p = toPaise(mrpValue); if (p === undefined) return { problem: "Enter a valid MRP." }; c.mrpPaise = p; }
    }
    if (statusOn) c.status = status;
    if (featuredOn) c.featured = featured;
    if (stockOn) { const n = Number(stock); if (stock.trim() === "" || !Number.isInteger(n) || n < 0) return { problem: "Enter a whole-number stock quantity." }; c.stock = n; }
    if (ratingOn) c.showRating = rating;
    if (cartOn) c.showAddToCart = cart;
    if (deliveryOn) {
      if (deliveryMode === "clear") c.clearDelivery = true;
      else { const n = Number(days); if (!Number.isInteger(n) || n < 0 || n > 30) return { problem: "Delivery days must be 0 to 30." }; c.deliveryDays = n; c.freeDelivery = free; }
    }
    if (Object.keys(c).length === 0) return { problem: "Tick at least one thing to change." };
    return { changes: c };
  }

  async function run(dryRun: boolean) {
    setError("");
    const built = build();
    if ("problem" in built) return setError(built.problem);
    setBusy(true);
    try {
      const result = await call<Result>("/admin/products/bulk", { method: "POST", body: JSON.stringify({ ids: products.map((p) => p.id), changes: built.changes, dryRun }) });
      if (dryRun) setReview(result);
      else {
        const extra = result.skipped.length ? ` ${result.skipped.length} skipped.` : "";
        onDone(`Updated ${result.updated} ${result.updated === 1 ? "product" : "products"}.${extra}`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const money = (p: number | null) => (p === null ? "none" : formatPrice(p));

  return (
    <Card title={`Edit ${products.length} selected ${products.length === 1 ? "product" : "products"}`} description="Tick what you want to change. Everything else on these products stays as it is." actions={<button type="button" onClick={onClose} className={btn.secondary}>Close</button>}>
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}

      {review ? (
        <div className="space-y-4 text-sm">
          <p className="text-base font-semibold">{review.updated === 0 ? "Nothing would change." : `This will update ${review.updated} ${review.updated === 1 ? "product" : "products"}.`}</p>
          {review.examples.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/60 text-muted"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">MRP</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {review.examples.map((x) => (
                    <tr key={x.name}>
                      <td className="px-3 py-2 font-medium">{x.name}</td>
                      <td className="px-3 py-2">{money(x.before.pricePaise)} → <strong>{money(x.after.pricePaise)}</strong></td>
                      <td className="px-3 py-2">{money(x.before.mrpPaise)} → <strong>{money(x.after.mrpPaise)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {review.updated > review.examples.length && <p className="border-t border-line px-3 py-2 text-xs text-muted">…and {review.updated - review.examples.length} more.</p>}
            </div>
          )}
          {review.mrpRemoved > 0 && <p className="rounded-lg bg-gold-50 px-3 py-2 text-amber-900">{review.mrpRemoved} {review.mrpRemoved === 1 ? "product's" : "products'"} MRP will be removed because it would be lower than the new price.</p>}
          {review.skipped.length > 0 && (
            <div className="rounded-lg bg-gold-50 px-3 py-2 text-amber-900">
              <p className="font-medium">{review.skipped.length} will be skipped:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">{review.skipped.slice(0, 5).map((s) => <li key={s.id}>{s.name}: {s.reason}</li>)}{review.skipped.length > 5 && <li>…and {review.skipped.length - 5} more</li>}</ul>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" disabled={busy || review.updated === 0} onClick={() => run(false)} className={btn.primary}>{busy ? "Applying…" : `Apply to ${review.updated} ${review.updated === 1 ? "product" : "products"}`}</button>
            <button type="button" disabled={busy} onClick={() => setReview(null)} className={btn.secondary}>Back</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Group title="Deal label" on={dealOn} setOn={setDealOn}>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2"><input type="radio" checked={dealMode === "set"} onChange={() => setDealMode("set")} /> Set to</label>
              <label className="flex items-center gap-2"><input type="radio" checked={dealMode === "clear"} onChange={() => setDealMode("clear")} /> Remove label</label>
            </div>
            {dealMode === "set" && <input value={deal} maxLength={40} onChange={(e) => setDeal(e.target.value)} placeholder="Mega Festival Deal" aria-label="Deal label" className={inputCls} />}
          </Group>

          <Group title="Selling price" on={priceOn} setOn={setPriceOn}>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={priceMode} onChange={(e) => setPriceMode(e.target.value as "set" | "percent")} className={`${inputCls} !w-auto`} aria-label="How to change the price">
                <option value="set">Set every price to (₹)</option>
                <option value="percent">Change every price by (%)</option>
              </Select>
              <input value={priceValue} onChange={(e) => setPriceValue(e.target.value)} type="number" step="any" placeholder={priceMode === "set" ? "999" : "-20"} aria-label="Price value" className={`${inputCls} !w-32`} />
            </div>
            {priceMode === "percent" && <p className="text-xs text-muted">Use a minus for a discount: -20 takes 20% off, 10 adds 10%.</p>}
            <label className="flex items-start gap-2"><input type="checkbox" checked={keepOld} onChange={(e) => setKeepOld(e.target.checked)} className="mt-0.5" /> <span>Show the old price struck through (as the MRP), so customers see the discount</span></label>
          </Group>

          {!keepOld && (
            <Group title="MRP (struck-through price)" on={mrpOn} setOn={setMrpOn}>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2"><input type="radio" checked={mrpMode === "set"} onChange={() => setMrpMode("set")} /> Set to (₹)</label>
                <label className="flex items-center gap-2"><input type="radio" checked={mrpMode === "clear"} onChange={() => setMrpMode("clear")} /> Remove MRP</label>
                {mrpMode === "set" && <input value={mrpValue} onChange={(e) => setMrpValue(e.target.value)} type="number" min={0} step="any" aria-label="MRP" className={`${inputCls} !w-32`} />}
              </div>
            </Group>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Group title="Published status" on={statusOn} setOn={setStatusOn}>
              <Select value={status} onChange={(e) => setStatus(e.target.value as "PUBLISHED" | "DRAFT")} className={inputCls} aria-label="Published status">
                <option value="PUBLISHED">Publish</option><option value="DRAFT">Unpublish (draft)</option>
              </Select>
            </Group>
            <Group title="Featured" on={featuredOn} setOn={setFeaturedOn}>
              <Select value={featured ? "yes" : "no"} onChange={(e) => setFeatured(e.target.value === "yes")} className={inputCls} aria-label="Featured">
                <option value="yes">Feature on the home page</option><option value="no">Remove from featured</option>
              </Select>
            </Group>
          </div>

          <Group title="Show star rating on the card" on={ratingOn} setOn={setRatingOn}>
            <Select value={rating ? "yes" : "no"} onChange={(e) => setRating(e.target.value === "yes")} className={inputCls} aria-label="Show rating">
              <option value="yes">Show</option><option value="no">Hide</option>
            </Select>
          </Group>

          <div className="rounded-xl border border-dashed border-line p-4">
            <p className="text-sm font-semibold">{brand} products only</p>
            <p className="mt-0.5 text-xs text-muted">{ownCount === products.length ? `All selected products are sold by ${brand}.` : `${ownCount} of the ${products.length} selected are sold by DMG; partner products are skipped for these.`}</p>
            <div className="mt-3 space-y-3">
              <Group title="Stock quantity" on={stockOn} setOn={setStockOn}>
                <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min={0} step={1} placeholder="Set stock to" aria-label="Stock quantity" className={`${inputCls} !w-40`} />
              </Group>
              <Group title="“Add to cart” button on the card" on={cartOn} setOn={setCartOn}>
                <Select value={cart ? "yes" : "no"} onChange={(e) => setCart(e.target.value === "yes")} className={inputCls} aria-label="Add to cart button">
                  <option value="yes">Show</option><option value="no">Hide</option>
                </Select>
              </Group>
              <Group title="Delivery date on the card" on={deliveryOn} setOn={setDeliveryOn}>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2"><input type="radio" checked={deliveryMode === "set"} onChange={() => setDeliveryMode("set")} /> Show</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={deliveryMode === "clear"} onChange={() => setDeliveryMode("clear")} /> Hide</label>
                </div>
                {deliveryMode === "set" && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">Delivered within <input value={days} onChange={(e) => setDays(e.target.value)} type="number" min={0} max={30} aria-label="Delivery days" className={`${inputCls} !w-20`} /> days</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Say “FREE delivery”</label>
                  </div>
                )}
              </Group>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" disabled={busy} onClick={() => run(true)} className={btn.primary}>{busy ? "Checking…" : "Review changes"}</button>
            <button type="button" onClick={onClose} className={btn.secondary}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}
