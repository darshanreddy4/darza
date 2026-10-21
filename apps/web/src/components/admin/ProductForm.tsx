"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { slugify, toIso, toLocalInput, useAdminApi, useAdminQuery, type AdminCategory, type AdminProduct } from "@/lib/admin";
import { buildCategoryTree } from "@/lib/categories";
import { Alert, Badge, Card, btn, inputCls } from "@/components/admin/ui";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { VideoLinks } from "@/components/admin/VideoLinks";
import { useBrand } from "@/components/BrandProvider";
import { Select } from "@/components/Select";
import { msUntil } from "@/lib/labels";
import { PACK_KINDS, PACK_UNITS, formatPack, parsePack, type PackKind } from "@/lib/packSize";

type Row = { k: string; v: string };
// One version to buy (Black / L, 20W, 5000 mAh), typed in rupees; id is set for an option that already exists, image is one of the product's pictures.
type OptRow = { id?: string; values: [string, string]; price: string; mrp: string; stock: string; cost: string; image: string };

// Only suggestions: the admin can name what the customer chooses anything.
const KIND_HINTS = ["Size", "Colour", "Capacity", "Wattage", "Storage", "Battery", "Weight", "Pack of"];
const splitList = (text: string) => [...new Set(text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))];

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
  const [chargeMode, setChargeMode] = useState<"store" | "free" | "charge">(initial?.chargeDelivery ? "charge" : initial?.freeDelivery ? "free" : "store");
  const [chargeFee, setChargeFee] = useState(toRupees(initial?.deliveryFeePaise));
  const [gstRate, setGstRate] = useState(String(initial?.gstRatePercent ?? 18));
  const firstPack = parsePack(initial?.packSize);
  const [packKind, setPackKind] = useState<PackKind>(firstPack.kind);
  const [packAmount, setPackAmount] = useState(firstPack.amount);
  const [packUnit, setPackUnit] = useState(firstPack.unit);
  const [packCustom, setPackCustom] = useState(firstPack.custom);
  const packSize = formatPack({ kind: packKind, amount: packAmount, unit: packUnit, custom: packCustom });
  const [returnMode, setReturnMode] = useState<"default" | "none" | "days">(initial?.returnDays == null ? "default" : initial.returnDays === 0 ? "none" : "days");
  const [returnDays, setReturnDays] = useState(String(initial?.returnDays || 7));
  const [saleTag, setSaleTag] = useState(initial?.saleTag ?? "");
  const [showSold, setShowSold] = useState(initial?.showSold ?? true);
  const [multiBuy, setMultiBuy] = useState(initial?.multiBuyQty != null);
  const [multiBuyQty, setMultiBuyQty] = useState(String(initial?.multiBuyQty ?? 2));
  const [multiBuyPercent, setMultiBuyPercent] = useState(String(initial?.multiBuyPercent ?? 3));
  const [saleOn, setSaleOn] = useState(initial?.salePricePaise != null);
  const [salePrice, setSalePrice] = useState(toRupees(initial?.salePricePaise));
  const [saleEndsAt, setSaleEndsAt] = useState(toLocalInput(initial?.saleEndsAt ?? null));
  const [variantGroup, setVariantGroup] = useState(initial?.variantGroup ?? "");
  const [colorName, setColorName] = useState(initial?.colorName ?? "");
  const [warranty, setWarranty] = useState(initial?.warranty ?? "");
  const [optionNames, setOptionNames] = useState<[string, string]>([initial?.optionNames?.[0] ?? "", initial?.optionNames?.[1] ?? ""]);
  const [options, setOptions] = useState<OptRow[]>((initial?.options ?? []).map((o) => ({ id: o.id, values: [o.values[0] ?? o.label, o.values[1] ?? ""], price: toRupees(o.pricePaise), mrp: toRupees(o.mrpPaise), stock: String(o.stock), cost: toRupees(o.costPaise), image: o.imageUrl ?? "" })));
  const [listed, setListed] = useState<[string, string]>(["", ""]);
  const [manufacturerInfo, setManufacturerInfo] = useState(initial?.manufacturerInfo ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const categories = cats.data ?? [];
  const tree = buildCategoryTree(categories);
  const effectiveCategory = categoryId || tree[0]?.children[0]?.id || tree[0]?.id || "";
  const own = type === "OWN";
  const sized = own && options.length > 0;
  // What the customer chooses between: one or two kinds, named by the admin.
  const kinds = optionNames[0].trim() ? (optionNames[1].trim() ? [optionNames[0].trim(), optionNames[1].trim()] : [optionNames[0].trim()]) : [];
  const setOption = (i: number, patch: Partial<OptRow>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setValue = (i: number, k: number, v: string) => setOption(i, { values: k === 0 ? [v, options[i].values[1]] : [options[i].values[0], v] });
  const blank = { price: "", mrp: "", stock: "", cost: "", image: "" };
  // The first option starts from the price and stock already typed above.
  const addOption = () => setOptions([...options, { values: ["", ""], ...(options.length === 0 ? { price, mrp, stock, cost, image: "" } : blank) }]);
  // Removing the last option leaves its values in the single price fields instead of stale ones.
  const removeOption = (i: number) => {
    const left = options.filter((_, j) => j !== i);
    if (left.length === 0) { const o = options[i]; setPrice(o.price); setMrp(o.mrp); setStock(o.stock); setCost(o.cost); setOptionNames(["", ""]); }
    setOptions(left);
  };
  // Names a kind from the suggestions: the first empty slot, never twice.
  const nameKind = (n: string) => {
    if (optionNames.some((x) => x.trim().toLowerCase() === n.toLowerCase())) return;
    if (!optionNames[0].trim()) setOptionNames([n, optionNames[1]]);
    else if (!optionNames[1].trim()) setOptionNames([optionNames[0], n]);
  };
  // "S, M, L" (and a second list) become one row for every combination, keeping rows already there.
  const createRows = () => {
    const a = splitList(listed[0]);
    const b = kinds.length > 1 ? splitList(listed[1]) : [""];
    if (a.length === 0 || b.length === 0) return;
    const have = new Set(options.map((o) => `${o.values[0].toLowerCase()}|${o.values[1].toLowerCase()}`));
    const fresh = a.flatMap((x) => b.map((y) => ({ values: [x, y] as [string, string], ...blank, price, mrp, stock: "0", cost }))).filter((r) => !have.has(`${r.values[0].toLowerCase()}|${r.values[1].toLowerCase()}`));
    setOptions([...options.filter((o) => o.values[0] || o.values[1] || o.price || o.stock), ...fresh]);
    setListed(["", ""]);
  };
  const cheapest = sized ? options.reduce((best, o) => (Number(o.price) < Number(best.price) ? o : best), options[0]) : null;
  const totalStock = options.reduce((n, o) => n + (Number(o.stock) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (sized && kinds.length === 0) return setError("Name what the customer chooses between, like Size or Colour");
    const optionRows = sized ? options.map((o) => ({
      id: o.id, values: kinds.map((_, k) => o.values[k].trim()), pricePaise: Math.round(Number(o.price) * 100), mrpPaise: o.mrp ? Math.round(Number(o.mrp) * 100) : undefined,
      stock: Math.round(Number(o.stock || 0)), costPaise: o.cost ? Math.round(Number(o.cost) * 100) : undefined, imageUrl: o.image || undefined,
    })) : [];
    for (const [n, o] of optionRows.entries()) {
      const name = o.values.join(" / ");
      if (o.values.some((v) => !v)) return setError(`Every option needs a ${kinds.join(" and a ")}`);
      if (!options[n].price.trim() || !Number.isFinite(o.pricePaise) || o.pricePaise < 0) return setError(`Enter a valid price for ${name}`);
      if (!Number.isFinite(o.stock) || o.stock < 0) return setError(`Enter a valid stock for ${name}`);
      if (o.mrpPaise !== undefined && o.mrpPaise < o.pricePaise) return setError(`The MRP of ${name} cannot be lower than its price`);
    }
    if (new Set(optionRows.map((o) => o.values.join(" / ").toLowerCase())).size !== optionRows.length) return setError("Two options are the same");
    const pricePaise = sized ? Math.min(...optionRows.map((o) => o.pricePaise)) : Math.round(Number(price) * 100);
    if (!Number.isFinite(pricePaise) || pricePaise < 0) return setError("Enter a valid price");
    if (!effectiveCategory) return setError("Create a category first");
    if (own && chargeMode === "charge" && chargeFee && (!Number.isFinite(Number(chargeFee)) || Number(chargeFee) < 0)) return setError("Enter a valid delivery charge");
    const sale = own && saleOn && !sized ? { salePricePaise: Math.round(Number(salePrice) * 100), saleEndsAt: toIso(saleEndsAt) } : null;
    if (sale) {
      if (!salePrice || !Number.isFinite(sale.salePricePaise) || sale.salePricePaise < 0) return setError("Enter the sale price");
      if (sale.salePricePaise >= pricePaise) return setError("The sale price must be lower than the selling price");
      if (!sale.saleEndsAt) return setError("Choose when the sale ends");
    }

    const payload = {
      name: name.trim(), slug, description: description.trim(), brand: brand.trim() || undefined, categoryId: effectiveCategory,
      productType: type, status: published ? "PUBLISHED" : "DRAFT", featured,
      pricePaise, mrpPaise: mrp ? Math.round(Number(mrp) * 100) : undefined,
      sellerName: sellerName.trim() || undefined, deliveryInfo: deliveryInfo.trim() || undefined, returnPolicy: returnPolicy.trim() || undefined,
      specifications: Object.fromEntries(specs.filter((s) => s.k.trim() && s.v.trim()).map((s) => [s.k.trim(), s.v.trim()])),
      images: images.map((u) => u.trim()).filter(Boolean).map((url) => ({ url })),
      videoUrls: videos,
      showRating, dealLabel: dealLabel.trim() || undefined, gstRatePercent: Number(gstRate),
      packSize: packSize.trim() || undefined, saleTag: saleTag || undefined,
      variantGroup: variantGroup.trim() || undefined, colorName: colorName.trim() || undefined,
      warranty: warranty.trim() || undefined, manufacturerInfo: manufacturerInfo.trim() || undefined,
      ...(sale ? { salePricePaise: sale.salePricePaise, saleEndsAt: sale.saleEndsAt ?? undefined } : {}),
      highlights: highlights.split("\n").map((h) => h.trim()).filter(Boolean),
      ...(own
        ? {
            sku: sku.trim(), stock: sized ? totalStock : Number(stock || 0), costPaise: !sized && cost ? Math.round(Number(cost) * 100) : undefined,
            options: optionRows, optionNames: sized ? kinds : [],
            returnDays: returnMode === "none" ? 0 : returnMode === "days" ? Math.max(1, Math.min(90, Math.round(Number(returnDays) || 7))) : undefined,
            showAddToCart, showSold, freeDelivery: chargeMode === "free", chargeDelivery: chargeMode === "charge", deliveryFeePaise: chargeMode === "charge" && chargeFee ? Math.round(Number(chargeFee) * 100) : undefined,
            deliveryDays: showDelivery ? Math.max(0, Math.min(30, Math.round(Number(deliveryDays) || 0))) : undefined,
            ...(multiBuy ? { multiBuyQty: Math.round(Number(multiBuyQty)), multiBuyPercent: Math.round(Number(multiBuyPercent)) } : {}),
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
                <Select required value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {categories.length === 0 && <option value="">No categories — create one first</option>}
                  {tree.map((p) => p.children.length === 0 ? (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ) : (
                    <optgroup key={p.id} label={p.name}>
                      {p.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value={p.id}>{p.name} (general)</option>
                    </optgroup>
                  ))}
                </Select>
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
                <input required type="number" min="0" step="0.01" disabled={sized} value={sized ? cheapest!.price : price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} mt-1.5 disabled:bg-canvas disabled:text-muted`} />
                {sized && <span className={hint}>Taken from the lowest price in Options and prices below.</span>}
              </label>
              <label className={label}>MRP (₹) <span className="font-normal text-muted">optional</span>
                <input type="number" min="0" step="0.01" disabled={sized} value={sized ? cheapest!.mrp : mrp} onChange={(e) => setMrp(e.target.value)} className={`${inputCls} mt-1.5 disabled:bg-canvas disabled:text-muted`} />
                <span className={hint}>{sized ? "Each option has its own MRP below." : "Shown struck through to display the discount."}</span>
              </label>
              <label className={label}>GST rate
                <Select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className={`${inputCls} mt-1.5`}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
                <span className={hint}>Already included in the price. Used on invoices once GST is switched on in Settings.</span>
              </label>
            </div>
          </Card>

          {own && (
            <Card title="Options and prices" description="Optional. For a product that comes in versions: clothes in S, M, L or colours, a charger in 20W or 40W, a phone in 5000 mAh or 7000 mAh, rice in 1 kg or 25 kg. You decide what the customer chooses and name it yourself; each option then has its own price and stock, like on Amazon or Flipkart, instead of a separate product for each."
              actions={<button type="button" className={btn.secondary} onClick={addOption}>+ Add option</button>}>
              {options.length === 0 ? <p className="text-sm text-muted">No options. The product is sold at the single price above.</p> : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>What does the customer choose?
                      <input value={optionNames[0]} maxLength={30} placeholder="Size, Wattage, Battery, Colour…" onChange={(e) => setOptionNames([e.target.value, optionNames[1]])} className={`${inputCls} mt-1.5`} />
                    </label>
                    <label className={label}>A second choice <span className="font-normal text-muted">optional</span>
                      <input value={optionNames[1]} maxLength={30} disabled={!optionNames[0].trim()} placeholder="for example Colour, with Size above" onChange={(e) => setOptionNames([optionNames[0], e.target.value])} className={`${inputCls} mt-1.5 disabled:bg-canvas`} />
                    </label>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted sm:col-span-2">Suggestions:
                      {KIND_HINTS.map((h) => <button key={h} type="button" onClick={() => nameKind(h)} className="rounded-full border border-line px-2.5 py-1 font-medium text-ink-3 hover:border-ink/40">{h}</button>)}
                    </p>
                  </div>
                  {kinds.length > 0 && (
                    <div className="rounded-xl bg-canvas p-3">
                      <p className="text-sm font-medium">Add many at once</p>
                      <p className={hint}>Type the values separated by commas and one row is made for each{kinds.length > 1 ? " combination" : ""}, for example S, M, L, XL.</p>
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        {kinds.map((k, n) => (
                          <label key={k} className="min-w-40 flex-1 text-xs font-medium text-muted">{k} values<input value={listed[n]} aria-label={`${k} values to add`} placeholder={n === 0 ? "S, M, L, XL" : "Black, Blue"} onChange={(e) => setListed(n === 0 ? [e.target.value, listed[1]] : [listed[0], e.target.value])} className={`${inputCls} mt-1 text-ink`} /></label>
                        ))}
                        <button type="button" className={btn.secondary} onClick={createRows}>Create rows</button>
                      </div>
                    </div>
                  )}
                  <ul className="space-y-3">
                    {options.map((o, i) => (
                      <li key={o.id ?? i} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
                        {(kinds.length ? kinds : ["Option"]).map((k, n) => (
                          <label key={n} className="min-w-28 flex-[1.2] text-xs font-medium text-muted">{k}<input value={o.values[n]} maxLength={40} aria-label={`Option ${i + 1} ${k}`} onChange={(e) => setValue(i, n, e.target.value)} className={`${inputCls} mt-1 text-ink`} /></label>
                        ))}
                        <label className="min-w-24 flex-1 text-xs font-medium text-muted">Price (₹)<input type="number" min="0" step="0.01" value={o.price} aria-label={`Option ${i + 1} price`} onChange={(e) => setOption(i, { price: e.target.value })} className={`${inputCls} mt-1 text-ink`} /></label>
                        <label className="min-w-24 flex-1 text-xs font-medium text-muted">MRP (₹)<input type="number" min="0" step="0.01" value={o.mrp} aria-label={`Option ${i + 1} MRP`} onChange={(e) => setOption(i, { mrp: e.target.value })} className={`${inputCls} mt-1 text-ink`} /></label>
                        <label className="min-w-20 flex-[0.8] text-xs font-medium text-muted">Stock<input type="number" min="0" step="1" value={o.stock} aria-label={`Option ${i + 1} stock`} onChange={(e) => setOption(i, { stock: e.target.value })} className={`${inputCls} mt-1 text-ink`} /></label>
                        <label className="min-w-24 flex-1 text-xs font-medium text-muted">Cost (₹)<input type="number" min="0" step="0.01" value={o.cost} aria-label={`Option ${i + 1} cost`} onChange={(e) => setOption(i, { cost: e.target.value })} className={`${inputCls} mt-1 text-ink`} /></label>
                        {images.length > 0 && (
                          <label className="min-w-28 flex-1 text-xs font-medium text-muted">Picture
                            <Select aria-label={`Option ${i + 1} picture`} value={o.image} onChange={(e) => setOption(i, { image: e.target.value })} className={`${inputCls} mt-1 text-ink`}>
                              <option value="">Product picture</option>
                              {images.filter(Boolean).map((u, n) => <option key={u} value={u}>Image {n + 1}</option>)}
                            </Select>
                          </label>
                        )}
                        <button type="button" className={btn.danger} onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>✕</button>
                      </li>
                    ))}
                  </ul>
                  <p className={hint}>The product page shows the lowest price as the starting price, and stock is counted across all options. Pick a picture from the product&apos;s images and the page switches to it when that option is chosen, which suits colours. Cost is private and used for profit in Analytics. Remove every option to go back to a single price.</p>
                </div>
              )}
            </Card>
          )}

          {own && !sized && (
            <Card title="Timed sale" description="Optional. Customers see a countdown on the product page, and the price goes back to the selling price by itself when it ends.">
              <div className="space-y-4 text-sm">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={saleOn} onChange={(e) => setSaleOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                  <span><span className="font-medium">Run a timed sale on this product</span><br /><span className="text-xs text-muted">The sale price applies in the shop, the cart and checkout until the end time. The selling price above is the normal price.</span></span>
                </label>
                {saleOn && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className={label}>Sale price (₹)
                      <input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={`${inputCls} mt-1.5`} />
                      <span className={hint}>Must be lower than the selling price.</span>
                    </label>
                    <label className={label}>Sale ends
                      <input type="datetime-local" value={saleEndsAt} onChange={(e) => setSaleEndsAt(e.target.value)} className={`${inputCls} mt-1.5`} />
                      <span className={hint}>{saleEndsAt && msUntil(toIso(saleEndsAt)!) <= 0 ? "This time has passed, so the sale is over. Pick a new time to run it again." : "In your local time. The sale starts as soon as you save."}</span>
                    </label>
                  </div>
                )}
              </div>
            </Card>
          )}

          {own ? (
            <Card title="Inventory & fulfilment">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={label}>SKU<input required value={sku} onChange={(e) => setSku(e.target.value)} className={`${inputCls} mt-1.5 font-mono`} /></label>
                <label className={label}>Stock quantity<input required type="number" min="0" disabled={sized} value={sized ? String(totalStock) : stock} onChange={(e) => setStock(e.target.value)} className={`${inputCls} mt-1.5 disabled:bg-canvas disabled:text-muted`} />{sized && <span className={hint}>Total of all options.</span>}</label>
                {!sized && (
                <label className={`${label} sm:col-span-2`}>Cost price per unit (₹) <span className="font-normal text-muted">optional</span>
                  <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={`${inputCls} mt-1.5`} />
                  <span className={hint}>Private. Used to calculate profit in Analytics; orders keep the cost at the time of sale.</span>
                </label>
                )}
                <label className={`${label} sm:col-span-2`}>Delivery information<input value={deliveryInfo} onChange={(e) => setDeliveryInfo(e.target.value)} placeholder="Delivered in 3–5 business days" className={`${inputCls} mt-1.5`} /></label>
                <label className={`${label} sm:col-span-2`}>Return policy text<input value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} placeholder="7-day replacement for defects" className={`${inputCls} mt-1.5`} /></label>
                <div className="sm:col-span-2">
                  <p className={label}>Delivery charge</p>
                  <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                    <Select aria-label="Delivery charge" value={chargeMode} onChange={(e) => setChargeMode(e.target.value as "store" | "free" | "charge")} className={inputCls}>
                      <option value="store">Follow the store&apos;s delivery rules</option>
                      <option value="free">Always free delivery</option>
                      <option value="charge">Always charge delivery (heavy or bulky)</option>
                    </Select>
                    {chargeMode === "charge" && <input aria-label="Delivery charge (₹)" type="number" min={0} step="0.01" value={chargeFee} onChange={(e) => setChargeFee(e.target.value)} placeholder="Store fee" className={inputCls} />}
                  </div>
                  <p className={hint}>
                    {chargeMode === "free" ? "Never adds to the delivery charge, and the product page says FREE delivery."
                      : chargeMode === "charge" ? "The charge is added once per order for this product even when the order is large, until the whole order reaches the free-everything amount in Settings. Leave the amount empty to use the store's fee."
                      : "Delivery is charged, or free for bigger orders, as set in Settings (and for the customer's area)."}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className={label}>Can customers return it?</p>
                  <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                    <Select aria-label="Returns" value={returnMode} onChange={(e) => setReturnMode(e.target.value as "default" | "none" | "days")} className={inputCls}>
                      <option value="default">Yes, for the store&apos;s return period</option>
                      <option value="days">Yes, for a number of days I choose</option>
                      <option value="none">No returns on this product</option>
                    </Select>
                    {returnMode === "days" && <input aria-label="Return days" type="number" min={1} max={90} value={returnDays} onChange={(e) => setReturnDays(e.target.value)} placeholder="Days" className={inputCls} />}
                  </div>
                  <p className={hint}>{returnMode === "none" ? "Customers see \u201cNo returns\u201d before they buy. Once it is shipped, no return or refund request can be made for it, and orders keep the rule they were placed under." : "The product page shows the return days with a return icon. Orders keep the number of days they were placed under."}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Affiliate link" description="Customers are redirected here; each click is tracked.">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>Destination platform
                    <Select value={PLATFORMS.includes(platform) ? platform : "Other"} onChange={(e) => setPlatform(e.target.value === "Other" ? "" : e.target.value)} className={`${inputCls} mt-1.5`}>
                      {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </Select>
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
              <fieldset className="space-y-2">
                <legend className={label}>Pack size <span className="font-normal text-muted">optional</span></legend>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <Select aria-label="Measured in" value={packKind} onChange={(e) => setPackKind(e.target.value as PackKind)} className={inputCls}>
                    {PACK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </Select>
                  {packKind === "custom" && <input aria-label="Pack size text" value={packCustom} maxLength={60} onChange={(e) => setPackCustom(e.target.value)} placeholder="600 ml, 800 ml, 1100 ml" className={`${inputCls} sm:col-span-2`} />}
                  {(packKind === "pieces" || packKind === "volume" || packKind === "weight") && (
                    <input aria-label="Pack amount" type="number" min="0" step="any" value={packAmount} onChange={(e) => setPackAmount(e.target.value)} className={inputCls} />
                  )}
                  {(packKind === "volume" || packKind === "weight") && (
                    <Select aria-label="Unit" value={packUnit} onChange={(e) => setPackUnit(e.target.value)} className={inputCls}>
                      {PACK_UNITS[packKind].map((u) => <option key={u} value={u}>{u}</option>)}
                    </Select>
                  )}
                  {packKind === "pieces" && <p className="self-center text-sm text-muted">piece{Number(packAmount) === 1 ? "" : "s"}</p>}
                </div>
                <p className={hint}>{packSize ? <>Shown under the name as <strong className="text-ink">{packSize}</strong>. </> : null}Pick what suits the product: a count for gadgets and electricals (1 piece), ml or litres for shampoo and drinks, grams or kilograms for groceries.</p>
              </fieldset>
              <label className={label}>Sale tag <span className="font-normal text-muted">optional</span>
                <Select value={saleTag} onChange={(e) => setSaleTag(e.target.value)} className={`${inputCls} mt-1.5`}>
                  <option value="">None</option>
                  <option value="TOP_DISCOUNT">Top Discount of the Sale</option>
                  <option value="LOWEST_PRICE">Lowest price in the year</option>
                </Select>
                <span className={hint}>Only use a tag that is true today. Remove it when the sale ends or the price goes up.</span>
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
                      </div>
                    )}
                  </div>
                  <label className="flex items-start gap-3">
                    <input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                    <span><span className="font-medium">Show how many were bought</span><br /><span className="text-xs text-muted">Counted from real orders (not cancelled or refunded), so it appears once someone has bought it. Shown as, for example, “1.2K+ bought”. “Only few left” shows by itself when stock is at or below the low-stock level in Settings.</span></span>
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" checked={multiBuy} onChange={(e) => setMultiBuy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                      <span><span className="font-medium">Multi-buy offer</span><br /><span className="text-xs text-muted">A real extra saving in the cart and at checkout when a customer buys enough of this product.</span></span>
                    </label>
                    {multiBuy && (
                      <div className="ml-7 flex flex-wrap items-end gap-3">
                        <label className={label}>Buy at least
                          <input type="number" min={2} max={10} value={multiBuyQty} onChange={(e) => setMultiBuyQty(e.target.value)} className={`${inputCls} mt-1.5 !w-24`} />
                        </label>
                        <label className={label}>Save extra (%)
                          <input type="number" min={1} max={50} value={multiBuyPercent} onChange={(e) => setMultiBuyPercent(e.target.value)} className={`${inputCls} mt-1.5 !w-24`} />
                        </label>
                        <p className="pb-2 text-xs text-muted">Shown as “Buy {multiBuyQty || "…"} items, save extra {multiBuyPercent || "…"}%”.</p>
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

          <Card title="Colour and size options" description="Optional. Give products of the same item (different colours or sizes) the same group name and they show as options of each other on the product page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>Group name
                <input value={variantGroup} maxLength={80} onChange={(e) => setVariantGroup(e.target.value)} placeholder="cello-sapphire-casserole" className={`${inputCls} mt-1.5 font-mono`} />
                <span className={hint}>Letters, numbers, spaces and dashes. Use the same name on each colour or size of this item.</span>
              </label>
              <label className={label}>Colour
                <input value={colorName} maxLength={40} onChange={(e) => setColorName(e.target.value)} placeholder="Blue" className={`${inputCls} mt-1.5`} />
                <span className={hint}>The size comes from the Pack size above, so each product in the group needs its own colour and pack size.</span>
              </label>
            </div>
          </Card>

          <Card title="Warranty and manufacturer" description="Optional, shown on the product page. Packaged goods usually need the manufacturer or packer and the country of origin.">
            <div className="space-y-4">
              <label className={label}>Warranty
                <input value={warranty} maxLength={200} onChange={(e) => setWarranty(e.target.value)} placeholder="1 year manufacturer warranty" className={`${inputCls} mt-1.5`} />
              </label>
              <label className={label}>Manufacturer, packer and country of origin
                <textarea value={manufacturerInfo} maxLength={1000} rows={3} onChange={(e) => setManufacturerInfo(e.target.value)} placeholder={"Country of origin: India\nManufactured by: Name, address"} className={`${inputCls} mt-1.5`} />
              </label>
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
