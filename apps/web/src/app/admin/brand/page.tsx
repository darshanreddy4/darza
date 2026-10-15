"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAdminApi, useAdminQuery } from "@/lib/admin";
import { SOCIAL_PLATFORMS, type SiteProfile } from "@/lib/site-profile";
import { Alert, Card, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/ImageField";
import { Logo } from "@/components/Logo";
import { useBrand } from "@/components/BrandProvider";
import { SocialIcon } from "@/components/SocialIcons";

const label = "block text-sm font-medium";
const hint = "mt-1 block text-xs font-normal text-muted";

function Field({ name, hint: h, children, className = "" }: { name: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`${label} ${className}`}>{name}<span className="mt-1.5 block">{children}</span>{h && <span className={hint}>{h}</span>}</label>;
}

export default function BrandPage() {
  const loaded = useAdminQuery<SiteProfile>("/admin/site-profile");
  if (!loaded.data) return loaded.error ? <Alert tone="error">{loaded.error}</Alert> : <Skeleton />;
  return <BrandForm initial={loaded.data} />;
}

function BrandForm({ initial }: { initial: SiteProfile }) {
  const call = useAdminApi();
  const currentBrand = useBrand();
  const [form, setForm] = useState<SiteProfile>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(form) !== saved;

  const set = (patch: Partial<SiteProfile>) => { setForm((f) => ({ ...f, ...patch })); setNotice(""); };
  const text = (key: keyof SiteProfile, max: number, props: { placeholder?: string; type?: string } = {}) => (
    <input className={inputCls} maxLength={max} value={form[key] as string} onChange={(e) => set({ [key]: e.target.value })} {...props} />
  );

  async function save() {
    setError(""); setBusy(true);
    try {
      const next = await call<SiteProfile>("/admin/site-profile", { method: "PUT", body: JSON.stringify(form) });
      setForm(next); setSaved(JSON.stringify(next));
      setNotice("Saved. Your storefront now shows these details.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Brand & contact"
        description="Your logo, about us, customer care and social links. They appear in the header, footer, About us and Contact pages."
        actions={
          <>
            <Link href="/about" target="_blank" className={btn.secondary}>View About us ↗</Link>
            <button className={btn.primary} disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
          </>
        }
      />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      {dirty && <p className="mb-4 rounded-xl bg-gold-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-gold/40">You have unsaved changes.</p>}

      <div className="space-y-6">
        <Card title="Logo and brand" description="Leave the logo empty to keep the built-in name and mark.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field name="Brand name" hint="Shown across the store, emails, invoices and page titles: header, footer, Sold by labels, policies, checkout. Change it here and everything follows."><>{text("brandName", 40, { placeholder: "DMG" })}</></Field>
              <Field name="Website address" hint="Your domain, for example https://www.yourbrand.com. Used for links in emails, search engine canonical links and the sitemap. If you move to a new domain, also update WEB_ORIGIN on the server so logins keep working."><>{text("siteUrl", 200, { placeholder: "https://www.yourbrand.com" })}</></Field>
              <Field name="Short tagline" hint="One or two sentences under the logo in the footer."><>{text("tagline", 200)}</></Field>
              <ImageField name="Logo" value={form.logoUrl} onChange={(v) => set({ logoUrl: v })} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={form.logoOnBadge} onChange={(e) => set({ logoOnBadge: e.target.checked })} />
                <span>Show my logo on a white badge<span className={hint}>The header and footer are dark. Switch this on if your logo is dark or has a transparent background that disappears.</span></span>
              </label>
            </div>
            <div>
              <p className={label}>Preview</p>
              <div className="mt-1.5 rounded-2xl bg-ink px-6 py-8"><Logo logoUrl={form.logoUrl} name={form.brandName || currentBrand} onBadge={form.logoOnBadge} /></div>
              <p className={hint}>This is how it looks in the header and footer.</p>
            </div>
          </div>
        </Card>

        <Card title="About us" description="Shown on the About us page. A blank line starts a new paragraph.">
          <textarea className={inputCls} rows={9} maxLength={4000} placeholder="Tell customers who you are, what you sell and why they can trust you." value={form.about} onChange={(e) => set({ about: e.target.value })} />
          <p className={hint}>{form.about.length} / 4000</p>
        </Card>

        <Card title="Contact" description="Also used on the Contact, Terms and Privacy pages.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="Email"><>{text("email", 120, { placeholder: "care@yourbrand.com", type: "email" })}</></Field>
            <Field name="Phone"><>{text("phone", 30, { placeholder: "+91 98765 43210" })}</></Field>
            <Field name="Address" className="sm:col-span-2"><>{text("address", 300, { placeholder: "Street, city, state, pincode" })}</></Field>
          </div>
        </Card>

        <Card title="Customer care" description="Shown in the footer and on the About us and Contact pages.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="Opening hours"><>{text("careHours", 120, { placeholder: "Mon to Sat, 10 am to 6 pm" })}</></Field>
            <Field name="Note for customers"><>{text("careNote", 300, { placeholder: "We reply within one working day." })}</></Field>
            <Field name="WhatsApp number" hint="With the country code, for example 91 98765 43210."><>{text("whatsapp", 30, { placeholder: "91 98765 43210" })}</></Field>
            <Field name="Message customers start with" hint="Optional. Filled in when they tap the WhatsApp link."><>{text("whatsappMessage", 200, { placeholder: "Hi, I need help with my order" })}</></Field>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={form.whatsappButton} disabled={!form.whatsapp.replace(/\D/g, "")} onChange={(e) => set({ whatsappButton: e.target.checked })} />
              <span>Show a floating WhatsApp chat button on every page<span className={hint}>Needs a WhatsApp number above.</span></span>
            </label>
          </div>
        </Card>

        <Card title="Connect with us" description="Paste a link or just the @handle. Only the ones you fill in are shown, as icons in the footer.">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <Field key={p.key} name={p.label}>
                <span className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-3"><SocialIcon name={p.key} /></span>
                  <input className={inputCls} maxLength={300} placeholder={p.placeholder} value={form.socials[p.key] ?? ""} onChange={(e) => set({ socials: { ...form.socials, [p.key]: e.target.value } })} />
                </span>
              </Field>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className={label}>Other links</p>
            <p className={hint}>Anything else, such as a blog, a Google review page or a community group. Up to 6.</p>
            <div className="mt-3 space-y-3">
              {form.otherLinks.map((o, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <input className={inputCls} aria-label={`Other link ${i + 1} name`} maxLength={40} placeholder="Name, e.g. Our blog" value={o.label} onChange={(e) => set({ otherLinks: form.otherLinks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input className={inputCls} aria-label={`Other link ${i + 1} address`} maxLength={500} placeholder="https://" value={o.url} onChange={(e) => set({ otherLinks: form.otherLinks.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                  <button type="button" className={btn.danger} onClick={() => set({ otherLinks: form.otherLinks.filter((_, j) => j !== i) })} aria-label={`Remove other link ${i + 1}`}>Remove</button>
                </div>
              ))}
              {form.otherLinks.length < 6 && <button type="button" className={btn.secondary} onClick={() => set({ otherLinks: [...form.otherLinks, { label: "", url: "" }] })}>+ Add a link</button>}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <button className={btn.primary} disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
      </div>
    </>
  );
}
