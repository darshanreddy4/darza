"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAdminApi, useAdminQuery, type AdminBanner, type AdminCategory } from "@/lib/admin";
import { HeroBanners } from "@/components/HeroBanners";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { VideoUploader } from "@/components/admin/VideoUploader";
import { PositionPicker } from "@/components/admin/PositionPicker";
import { DEFAULT_TEXT_POSITION, isBannerPosition, type BannerPosition } from "@/lib/banner-position";
import { Alert, Card, btn, inputCls } from "@/components/admin/ui";
import { useBrand } from "@/components/BrandProvider";

// <input type="datetime-local"> works in local time without a timezone suffix.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function BannerForm({ initial }: { initial?: AdminBanner }) {
  const brand = useBrand();
  const router = useRouter();
  const call = useAdminApi();
  const cats = useAdminQuery<AdminCategory[]>("/admin/categories");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [images, setImages] = useState<string[]>(initial ? [initial.imageUrl] : []);
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [tone, setTone] = useState<"LIGHT" | "DARK">(initial?.textTone ?? "LIGHT");
  const [active, setActive] = useState(initial?.active ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [showCountdown, setShowCountdown] = useState(initial?.showCountdown ?? false);
  const [videoUrl, setVideoUrl] = useState<string | null>(initial?.videoUrl ?? null);
  const [sponsorName, setSponsorName] = useState(initial?.sponsorName ?? "");
  const [textPosition, setTextPosition] = useState<BannerPosition>(isBannerPosition(initial?.textPosition) ? initial.textPosition : DEFAULT_TEXT_POSITION);
  const [buttonPosition, setButtonPosition] = useState<BannerPosition | null>(isBannerPosition(initial?.buttonPosition) ? initial.buttonPosition : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const quickLinks = [
    { label: "All products", url: "/products" },
    { label: `Sold by ${brand}`, url: "/products?type=OWN" },
    { label: "Partner deals", url: "/products?type=AFFILIATE" },
    ...(cats.data ?? []).map((c) => ({ label: c.name, url: `/products?category=${c.slug}` })),
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (images.length === 0) return setError("Add a banner image");
    if (showCountdown && !endsAt) return setError("Set a \"Hide after\" date to show a countdown timer");
    setBusy(true);
    try {
      await call(initial ? `/admin/banners/${initial.id}` : "/admin/banners", {
        method: initial ? "PUT" : "POST",
        body: JSON.stringify({
          title: title.trim(), subtitle: subtitle.trim() || null, imageUrl: images[0], ctaLabel: ctaLabel.trim() || null,
          linkUrl: linkUrl.trim() || null, textTone: tone, active, startsAt: toIso(startsAt), endsAt: toIso(endsAt), showCountdown: showCountdown && !!endsAt,
          videoUrl, sponsorName: sponsorName.trim() || null, textPosition, buttonPosition,
        }),
      });
      router.push("/admin/banners");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const label = "block text-sm font-medium";
  const hint = "mt-1 text-xs text-muted";

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}

      <Card title="Live preview" description="Exactly how this banner looks on the home page.">
        {images[0] ? (
          <div className="pointer-events-none">
            <HeroBanners banners={[{ id: "preview", title, subtitle: subtitle || null, imageUrl: images[0], ctaLabel: ctaLabel || null, linkUrl: linkUrl || null, textTone: tone, endsAt: showCountdown && endsAt ? toIso(endsAt) : null, videoUrl, sponsorName: sponsorName.trim() || null, textPosition, buttonPosition }]} />
          </div>
        ) : (
          <p className="rounded-2xl bg-canvas px-4 py-10 text-center text-sm text-muted">Add an image to see the preview.</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Image" description="Wide images work best: about 1600 × 600 pixels.">
            <ImageUploader images={images} setImages={setImages} max={1} hint="recommended 1600×600" />
          </Card>

          <Card title="Video" description="Optional. Upload a short clip (up to 60 seconds) or paste a YouTube link. It plays silently in place of the image, with a sound button for visitors. The image above is shown while it loads and for visitors who prefer reduced motion.">
            <VideoUploader value={videoUrl} onChange={setVideoUrl} />
          </Card>

          <Card title="Text" description="Optional. Leave the headline empty for an image or video only banner.">
            <div className="space-y-4">
              <label className={label}>Headline <span className="font-normal text-muted">optional</span>
                <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="Festive sale" />
              </label>
              <label className={label}>Supporting line <span className="font-normal text-muted">optional</span>
                <input value={subtitle} maxLength={220} onChange={(e) => setSubtitle(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="Up to 40% off on selected products" />
              </label>
              <label className={label}>Advertiser / sponsor <span className="font-normal text-muted">optional</span>
                <input value={sponsorName} maxLength={60} onChange={(e) => setSponsorName(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="e.g. Brand name" />
                <span className={hint}>For paid placements. Shows an “Ad · Brand” label on the banner so visitors can tell it is an advertisement. Impressions and clicks are tracked for reporting.</span>
              </label>
              <div>
                <p className={label}>Text position</p>
                <div className="mt-1.5"><PositionPicker value={textPosition} onChange={setTextPosition} label="Text position" /></div>
                <p className={hint}>Where the headline, supporting line and countdown sit on the banner.</p>
              </div>
              <div role="radiogroup" aria-label="Text colour" className="grid gap-3 sm:grid-cols-2">
                {([["LIGHT", "Light text", "Use on dark or busy images"], ["DARK", "Dark text", "Use on light images"]] as const).map(([v, t, d]) => (
                  <button type="button" key={v} role="radio" aria-checked={tone === v} onClick={() => setTone(v)}
                    className={`rounded-xl border-2 p-3 text-left transition ${tone === v ? "border-brand-500 bg-brand-50" : "border-line hover:border-ink/30"}`}>
                    <p className="font-semibold">{t}</p><p className="text-xs text-muted">{d}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Button & link" description="Where customers go when they click the banner.">
            <div className="space-y-4">
              <label className={label}>Button text <span className="font-normal text-muted">optional</span>
                <input value={ctaLabel} maxLength={40} onChange={(e) => setCtaLabel(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="Shop now" />
              </label>
              <label className={label}>Link
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={`${inputCls} mt-1.5`} placeholder="/products?type=OWN or https://…" />
                <span className={hint}>A page on this site (starting with /) or a full https:// address. Leave empty for a banner without a link.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((q) => (
                  <button type="button" key={q.url} onClick={() => setLinkUrl(q.url)} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium hover:border-brand-500">{q.label}</button>
                ))}
              </div>
              <div>
                <p className={label}>Button position</p>
                <label className="mt-1.5 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={buttonPosition === null} onChange={(e) => setButtonPosition(e.target.checked ? null : textPosition)} className="h-4 w-4 accent-emerald-600" />
                  Keep the button under the text
                </label>
                <div className="mt-2"><PositionPicker value={buttonPosition ?? textPosition} onChange={setButtonPosition} label="Button position" disabled={buttonPosition === null} /></div>
                <p className={hint}>Untick to place the button in a different spot from the text. Without button text, clicking anywhere on the banner opens the link.</p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card title="Visibility">
            <div className="space-y-4 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Active</span><br /><span className="text-xs text-muted">Turn off to hide without deleting.</span></span>
              </label>
              <label className={label}>Show from <span className="font-normal text-muted">optional</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputCls} mt-1.5`} />
              </label>
              <label className={label}>Hide after <span className="font-normal text-muted">optional</span>
                <input type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} className={`${inputCls} mt-1.5`} />
              </label>
              <label className={`flex items-start gap-3 ${endsAt ? "" : "opacity-50"}`}>
                <input type="checkbox" checked={showCountdown && !!endsAt} disabled={!endsAt} onChange={(e) => setShowCountdown(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span><span className="font-medium">Show countdown timer</span><br /><span className="text-xs text-muted">{endsAt ? "Visitors see how long is left. The banner disappears when time runs out." : "Set a \"Hide after\" date first."}</span></span>
              </label>
            </div>
          </Card>
          <div className="flex gap-3">
            <button disabled={busy} className={`${btn.primary} flex-1 py-2.5`}>{busy ? "Saving…" : initial ? "Save changes" : "Create banner"}</button>
            <button type="button" className={btn.secondary} onClick={() => router.push("/admin/banners")}>Cancel</button>
          </div>
        </aside>
      </div>
    </form>
  );
}
