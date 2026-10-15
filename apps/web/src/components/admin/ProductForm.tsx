"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { slugify, useAdminApi, useAdminQuery, type AdminCategory, type AdminProduct } from "@/lib/admin";
import { buildCategoryTree } from "@/lib/categories";
import { Alert, Badge, Card, btn, inputCls } from "@/components/admin/ui";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { VideoLinks } from "@/components/admin/VideoLinks";
import { useBrand } from "@/components/BrandProvider";

type Row = { k: string; v: string };

const PLATFORMS = ["Amazon", "Flipkart", "Myntra", "Meesho", "Nykaa", "Other"];
const toRupees = (paise: number | null | undefined) => (paise == null ? "" : String(paise / 100));

export function ProductForm({ initial }: { initial?: AdminProduct }) {
  const storeName = useBrand();
  const router = useRouter();
  const call = useAdminApi();
  const cats = useAdminQuery<AdminCategory[]>("/admin/categories");

  const [type, setType] = useState<"OWN" | "AFFILIATE">(initial?.productType ?? "OWN");
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(toRupees(initial?.pricePaise));
  const [mrp, setMrp] = useState(toRupees(initial?.mrpPaise));
  const [cost, setCost] = useState(toRupees(initial?.costPaise));
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [stock, setStock] = useState(initial?.stock == null ? "" : String(initial.stock));
  const [platform, setPlatform] = useState(initial?.platform ?? "Amazon");
  const [affiliateUrl, setAffiliateUrl] = useState(initial?.affiliateUrl ?? "");
  const [disclosure, setDisclosure] = useState(initial?.affiliateDisclosure ?? "");
  const [sellerName, setSellerName] = useState(initial && initial.sellerName !== "DMG" && initial.sellerName !== initial.platform ? initial.sellerName : "");
  const [deliveryInfo, setDeliveryInfo] = useState(initial?.deliveryInfo ?? "");
  const [returnPolicy, setReturnPolicy] = useState(initial?.returnPolicy ?? "");
  const [images, setImages] = useState<string[]>(initial?.images.map((i) => i.url) ?? []);
  const [videos, setVideos] = useState<string[]>(initial?.videoUrls ?? []);
  const [highlights, setHighlights] = useState((initial?.highlights ?? []).join("\n"));
  const [specs, setSpecs] = useState<Row[]>(Object.entries(initial?.specifications ?? {}).map(([k, v]) => ({ k, v })));
  const [published, setPublished] = useState(initial?.status === "PUBLISHED");
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [showRating, setShowRating] = useState(initial?.showRating ?? true);
  const [dealLabel, setDealLabel] = useState(initial?.dealLabel ?? "");
  const [showAddToCart, setShowAddToCart] = useState(initial?.showAddToCart ?? false);
  const [showDelivery, setShowDelivery] = useState(initial?.deliveryDays != null);
  const [deliveryDays, setDeliveryDays] = useState(initial?.deliveryDays == null ? "3" : String(initial.deliveryDays));
  const [freeDelivery, setFreeDelivery] = useState(initial?.freeDelivery ?? false);
  const [gstRate, setGstRate] = useState(String(initial?.gstRatePercent ?? 18));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = cats.data ?? [];
  const tree = buildCategoryTree(categories);
  const effectiveCategory = categoryId || tree[0]?.children[0]?.id || tree[0]?.id || "";
  const own = type === "OWN";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const pricePaise = Math.round(Number(price) * 100);
    if (!Number.isFinite(pricePaise) || pricePaise < 0) return setError("Enter a valid price");
    if (!effectiveCategory) return setError("Create a category first");

    const payload = {
      name: name.trim(), slug, description: description.trim(), brand: brand.trim() || undefined, categoryId: effectiveCategory,
      productType: type, status: published ? "PUBLISHED" : "DRAFT", featured,
      pricePaise, mrpPaise: mrp ? Math.round(Number(mrp) * 100) : undefined,
      sellerName: sellerName.trim() || undefined, deliveryInfo: deliveryInfo.trim() || undefined, returnPolicy: returnPolicy.trim() || undefined,
      specifications: Object.fromEntries(specs.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()])),
      images: images.map((u) => u.trim()).filter(Boolean).map((url) => ({ url })),
      videoUrls: videos,
      showRating, dealLabel: dealLabel.trim() || undefined, gstRatePercent: Number(gstRate),
      highlights: highlights.split("\n").map((h) => h.trim()).filter(Boolean),
      ...(own
        ? {
            sku: sku.trim(), stock: Number(stock || 0), costPaise: cost ? Math.round(Number(cost) * 100) : undefined,
            showAddToCart, freeDelivery: showDelivery && freeDelivery, deliveryDays: showDelivery ? Math.max(0, Math.min(30, Math.round(Number(deliveryDays) || 0))) : undefined,
          }
        : { platform, affiliateUrl: affiliateUrl.trim(), affiliateDisclosure: disclosure.trim() || undefined }),
    };

    setBusy(true);
    try {
      await call(initial ? `/admin/products/${initial.id}` : "/admin/products", { method: initial ? "PUT" : "POST", body: JSON.stringify(payload) });
      router.push("/admin/products");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const label = "block text-sm font-medium";
  const hint = "mt-1 text-xs text-muted";

  return (
    <form onSubmit={submit}>
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Product type" description="Decides how customers buy this product.">
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Product type">
              {([
                ["OWN", `Sold by ${storeName}`, `Add to cart and checkout on ${storeName}. You manage stock and fulfilment.`],
                ["AFFILIATE", "Affiliate product", "Tracked redirect to a partner marketplace to complete the purchase."],
              ] as const).map(([value, title, text]) => (
                <button type="button" key={value} role="radio" aria-checked={type === value} onClick={() => setType(value)}
                  className={`rounded-xl border-2 p-4 text-left transition ${type === value ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink/30"}`}>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-muted">{text}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Basic information">
            <div className="space-y-4">
              <label className={label}>Product name
                <input required value={name} maxLength={200} className={`${inputCls} mt-1.5`}
                  onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>URL slug
                  <input required value={slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${inputCls} mt-1.5 font-mono`}
                    onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
                  <span className={hint}>/products/{slug || "your-slug"}</span>
                </label>
                <label className={label}>Brand
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} className={`${inputCls} mt-1.5`} />
                </label>
              </div>
              <label className={label}>Category
                <select required value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {categories.length === 0 && <option value="">No categories — create one first</option>}
                  {tree.map((p) => p.children.length === 0 ? (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ) : (
                    <optgroup key={p.id} label={p.name}>
                      {p.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value={p.id}>{p.name} (general)</option>
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className={label}>Description
                <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputCls} mt-1.5`} />
              </label>
            </div>
          </Card>

          <Card title="About this item" description="Key selling points shown as a bullet list on the product page. One per line, up to 12.">
            <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={5} aria-label="Highlights" placeholder={"Fast 15W wireless charging\nAnti-slip surface\nWorks with all Qi-enabled phones"} className={inputCls} />
          </Card>

          <Card title="Pricing" description="All prices in Indian rupees.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Selling price (₹)
                <input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} mt-1.5`} />
              </label>
              <label className={label}>MRP (₹) <span className="font-normal text-muted">optional</span>
                <input type="number" min="0" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className={`${inputCls} mt-1.5`} />
                <span className={hint}>Shown struck through to display the discount.</span>
              </label>
              <label className={label}>GST rate
                <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
                <span className={hint}>Already included in the price. Used on invoices once GST is switched on in Settings.</span>
              </label>
            </div>
          </Card>

          {own ? (
            <Card title="Inventory & fulfilment">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>SKU<input required value={sku} onChange={(e) => setSku(e.target.value)} className={`${inputCls} mt-1.5 font-mono`} /></label>
                <label className={label}>Stock quantity<input required type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
                <label className={`${label} sm:col-span-2`}>Cost price per unit (₹) <span className="font-normal text-muted">optional</span>
                  <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={`${inputCls} mt-1.5`} />
                  <span className={hint}>Private. Used to calculate profit in Analytics; orders keep the cost at the time of sale.</span>
                </label>
                <label className={`${label} sm:col-span-2`}>Delivery information<input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} placeholder="Delivered in 3–5 business days" className={`${inputCls} mt-1.5`} /></label>
                <label className={`${label} sm:col-span-2`}>Return policy<input value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} placeholder="7-day replacement for defects" className={`${inputCls} mt-1.5`} /></label>
              </div>
            </Card>
          ) : (
            <Card title="Affiliate link" description="Customers are redirected here; each click is tracked.">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>Destination platform
                    <select value={PLATFORMS.includes(platform) ? platform : "Other"} onChange={(e) => setPlatform(e.target.value === "Other" ? "" : e.target.value)} className={`${inputCls} mt-1.5`}>
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </label>
                  {!PLATFORMS.slice(0, -1).includes(platform) && (
                    <label className={label}>Platform name<input required value={platform} onChange={(e) => setPlatform(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
                  )}
                </div>
                <label className={label}>Affiliate URL
                  <input required type="url" value={affiliateUrl} onChange={(e) => setAffiliateUrl(e.target.value)} placeholder="https://" className={`${inputCls} mt-1.5`} />
                  <span className={hint}>Must start with https://</span>
                </label>
                <label className={label}>Disclosure text <span className="font-normal text-muted">optional</span>
                  <textarea value={disclosure} onChange={(e) => setDisclosure(e.target.value)} rows={2} placeholder="Leave blank to use the default disclosure." className={`${inputCls} mt-1.5`} />
                </label>
              </div>
            </Card>
          )}

          <Card title="Product card" description="Choose what shows on this product's card in the store. Everything is optional; leave it as it is for a simple card.">
            <div className="space-y-4 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={showRating} onChange={(e) => setShowRating(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Show star rating</span><br /><span className="text-xs text-muted">Uses real customer reviews, so it appears once the product has at least one.</span></span>
              </label>
              <label className={label}>Deal label <span className="font-normal text-muted">optional</span>
                <input value={dealLabel} maxLength={40} onChange={(e) => setDealLabel(e.target.value)} placeholder="Mega Festival Deal" className={`${inputCls} mt-1.5`} />
                <span className={hint}>A red tag above the price, e.g. a festival or limited-time offer. Clear it when the offer ends.</span>
              </label>
              {own ? (
                <>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" checked={showDelivery} onChange={(e) => setShowDelivery(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                      <span><span className="font-medium">Show delivery date</span><br /><span className="text-xs text-muted">The date is worked out from today, so it stays current without editing.</span></span>
                    </label>
                    {showDelivery && (
                      <div className="ml-7 space-y-3">
                        <label className={label}>Delivered within (days)
                          <input type="number" min={0} max={30} value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} className={`${inputCls} mt-1.5 !w-28`} />
                        </label>
                        <label className="flex items-center gap-3">
                          <input type="checkbox" checked={freeDelivery} onChange={(e) => setFreeDelivery(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                          <span>Say “FREE delivery” (only if you really don&apos;t charge for it)</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={showAddToCart} onChange={(e) => setShowAddToCart(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                    <span><span className="font-medium">Show “Add to cart” button on the card</span><br /><span className="text-xs text-muted">Customers can add it without opening the product. Shows “Out of stock” when stock is 0.</span></span>
                  </label>
                </>
              ) : (
                <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Delivery dates and the cart button are only for products {storeName} sells. Partner products are bought and delivered on {platform || "the partner site"}.</p>
              )}
            </div>
          </Card>

          <Card title="Images" description="Add as many as you like (up to 12). Customers can slide through them. The first image is the cover.">
            <ImageUploader images={images} setImages={setImages} />
          </Card>

          <Card title="Videos" description="Optional. Shown in the same slider after the images.">
            <VideoLinks videos={videos} setVideos={setVideos} />
          </Card>

          <Card title="Specifications" actions={<button type="button" className={btn.secondary} onClick={() => setSpecs([...specs, { k: "", v: "" }])}>+ Add row</button>}>
            {specs.length === 0 ? <p className="text-sm text-muted">No specifications yet.</p> : (
              <ul className="space-y-3">
                {specs.map((s, i) => (
                  <li key={i} className="grid grid-cols-[1fr_2fr_auto] gap-3">
                    <input value={s.k} placeholder="e.g. Battery" aria-label="Specification name" className={inputCls} onChange={(e) => setSpecs(specs.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))} />
                    <input value={s.v} placeholder="e.g. 20 hours" aria-label="Specification value" className={inputCls} onChange={(e) => setSpecs(specs.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))} />
                    <button type="button" className={btn.danger} onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="Remove row">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card title="Visibility">
            <div className="space-y-4 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Published</span><br /><span className="text-xs text-muted">Visible on the storefront.</span></span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Featured</span><br /><span className="text-xs text-muted">Highlight on the home page.</span></span>
              </label>
              <div className="flex items-center justify-between border-t border-line pt-4">
                <span className="text-muted">Status</span>
                <Badge tone={published ? "green" : "slate"}>{published ? "Will be live" : "Draft"}</Badge>
              </div>
            </div>
          </Card>
          <Card title="Seller label" description={own ? "Leave empty to show your brand name. Fill it in only if this product is sold under another name." : "Shown on the product page."}>
            <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder={own ? storeName : platform || "Platform"} aria-label="Seller name" className={inputCls} />
          </Card>
          <div className="flex gap-3">
            <button disabled={busy} className={`${btn.primary} flex-1 py-2.5`}>{busy ? "Saving…" : initial ? "Save changes" : "Create product"}</button>
            <button type="button" className={btn.secondary} onClick={() => router.push("/admin/products")}>Cancel</button>
          </div>
        </aside>
      </div>
    </form>
  );
}
