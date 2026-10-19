"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminApi, useAdminQuery, slugify } from "@/lib/admin";
import { DEFAULT_ANNOUNCEMENT, DEFAULT_TRANSPARENCY, PLACEHOLDERS, POLICY_DEFAULTS } from "@/lib/policy-defaults";
import { fillPlaceholders, InlineRichText, RichText } from "@/components/Markdown";
import { useBrand } from "@/components/BrandProvider";
import { Alert, Badge, Card, PageHeader, Skeleton, btn, inputCls } from "@/components/admin/ui";
import type { SiteProfile } from "@/lib/site-profile";

interface PageRowDto { slug: string; title: string; body: string; enabled: boolean; custom: boolean; position: number; updatedAt: string }

interface Draft { slug: string | null; custom: boolean; title: string; address: string; enabled: boolean; useOwn: boolean; body: string }

const label = "block text-sm font-medium";
const hint = "mt-1 block text-xs font-normal text-muted";

export default function PagesAdmin() {
  const pages = useAdminQuery<{ items: PageRowDto[] }>("/admin/pages");
  const site = useAdminQuery<SiteProfile>("/admin/site-profile");
  if (!pages.data || !site.data) return pages.error || site.error ? <Alert tone="error">{pages.error || site.error}</Alert> : <Skeleton />;
  return <PagesForm rows={pages.data.items} site={site.data} reload={pages.reload} />;
}

function PagesForm({ rows, site, reload }: { rows: PageRowDto[]; site: SiteProfile; reload: () => void }) {
  const call = useAdminApi();
  const currentBrand = useBrand();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const brand = site.brandName || currentBrand;
  const values = {
    brand, company: site.legalName || brand, addressSuffix: site.address ? `, ${site.address}` : "", address: site.address, email: site.email, phone: site.phone,
    gstin: site.gstin, grievanceOfficer: site.grievanceOfficer, grievanceEmail: site.grievanceEmail || site.email, website: site.siteUrl,
  };

  const byslug = new Map(rows.map((r) => [r.slug, r]));
  const builtins = POLICY_DEFAULTS.map((d) => {
    const row = byslug.get(d.slug);
    return { slug: d.slug, title: d.title, href: `/${d.slug}`, custom: false, state: row && !row.enabled ? "hidden" : row?.body ? "own" : "standard" } as const;
  });
  const extras = rows.filter((r) => r.custom).map((r) => ({ slug: r.slug, title: r.title, href: `/pages/${r.slug}`, custom: true, state: r.enabled ? "own" : "hidden" } as const));

  function edit(slug: string, custom: boolean) {
    setError(""); setNotice("");
    const row = byslug.get(slug);
    const def = POLICY_DEFAULTS.find((d) => d.slug === slug);
    setDraft({ slug, custom, title: row?.title || def?.title || "", address: slug, enabled: row ? row.enabled : true, useOwn: custom || !!row?.body, body: row?.body ?? "" });
  }

  async function save() {
    if (!draft) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      if (draft.slug === null) {
        await call("/admin/pages", { method: "POST", body: JSON.stringify({ title: draft.title, slug: draft.address, body: draft.body, enabled: draft.enabled }) });
      } else {
        await call(`/admin/pages/${draft.slug}`, { method: "PUT", body: JSON.stringify({ title: draft.custom ? draft.title : "", body: draft.useOwn ? draft.body : "", enabled: draft.enabled }) });
      }
      setNotice("Saved. The page is updated on your website.");
      setDraft(null);
      reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!draft?.slug) return;
    const ask = draft.custom ? `Delete the page "${draft.title}"? Its address will stop working.` : "Go back to the standard text for this page?";
    if (!window.confirm(ask)) return;
    setError(""); setBusy(true);
    try {
      await call(`/admin/pages/${draft.slug}`, { method: "DELETE" });
      setNotice(draft.custom ? "The page was deleted." : "This page is back to its standard text.");
      setDraft(null);
      reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const standardText = () => POLICY_DEFAULTS.find((d) => d.slug === draft?.slug)?.body({ ads: false }) ?? "";
  const preview = draft ? fillPlaceholders(draft.useOwn ? draft.body : standardText(), values) : "";

  return (
    <>
      <PageHeader title="Pages & policies" description="Terms, privacy, shipping, refunds and any other page you want in the footer, plus the message bar and the Transparency note." />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <div className="space-y-6">
        <Card
          title="Pages in your footer" description="Each one opens at its own address. Pages you hide disappear from the footer and can no longer be opened."
          actions={<button type="button" className={btn.primary} onClick={() => { setError(""); setNotice(""); setDraft({ slug: null, custom: true, title: "", address: "", enabled: true, useOwn: true, body: "" }); }}>+ Add a page</button>}
        >
          <ul className="divide-y divide-line">
            {[...builtins, ...extras].map((p) => (
              <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-muted">{p.href}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={p.state === "hidden" ? "slate" : p.state === "own" ? "green" : "amber"}>{p.state === "hidden" ? "Hidden" : p.custom ? "Your page" : p.state === "own" ? "Your text" : "Standard text"}</Badge>
                  {p.state !== "hidden" && <Link href={p.href} target="_blank" className="text-sm font-medium text-brand-700 hover:underline">View ↗</Link>}
                  <button type="button" className={btn.secondary} aria-label={`Edit ${p.title}`} onClick={() => edit(p.slug, p.custom)}>Edit</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">About us is edited under Brand &amp; contact, and Contact &amp; Grievance shows the details you enter there.</p>
        </Card>

        {draft && (
          <Card title={draft.slug === null ? "New page" : `Edit: ${draft.title || draft.slug}`}>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                {draft.custom && (
                  <>
                    <label className={label}>Page title
                      <input className={`${inputCls} mt-1.5`} maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value, address: draft.slug === null ? slugify(e.target.value) : draft.address })} placeholder="e.g. Size guide" />
                    </label>
                    <label className={label}>Page address
                      <span className="mt-1.5 flex items-center gap-1 text-sm text-muted">/pages/
                        <input className={inputCls} aria-label="Page address" maxLength={60} disabled={draft.slug !== null} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value.toLowerCase() })} />
                      </span>
                      {draft.slug === null && <span className={hint}>Lowercase letters, numbers and dashes. It cannot be changed later.</span>}
                    </label>
                  </>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                  <span>Show this page on the website<span className={hint}>Switch off to hide it from the footer and take it offline.</span></span>
                </label>

                {!draft.custom && (
                  <div role="radiogroup" aria-label="Which text to use" className="grid gap-2 sm:grid-cols-2">
                    {([[false, "Use the standard text", "Ready-made wording. It uses your brand details."], [true, "Write my own text", "Replace it with your own wording."]] as [boolean, string, string][]).map(([own, name, note]) => (
                      <button key={String(own)} type="button" role="radio" aria-checked={draft.useOwn === own} onClick={() => setDraft({ ...draft, useOwn: own, body: own && !draft.body ? standardText() : draft.body })}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm ${draft.useOwn === own ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/40" : "border-line bg-white hover:border-ink-3"}`}>
                        <span className="block font-semibold">{name}</span><span className="block text-xs text-muted">{note}</span>
                      </button>
                    ))}
                  </div>
                )}

                {draft.useOwn && (
                  <div>
                    <label className={label}>Page text
                      <textarea className={`${inputCls} mt-1.5 font-mono text-[13px] leading-relaxed`} rows={18} maxLength={60000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        placeholder={"## 1. A heading\nA paragraph of text.\n\n- A bullet point\n- Another one"} />
                    </label>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>{draft.body.length.toLocaleString("en-IN")} / 60,000</span>
                      {!draft.custom && <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => { if (!draft.body.trim() || window.confirm("Replace what you wrote with the standard text?")) setDraft({ ...draft, body: standardText() }); }}>Start again from the standard text</button>}
                    </div>
                    <details className="mt-3 rounded-xl border border-line p-3 text-xs text-ink-3">
                      <summary className="cursor-pointer font-semibold">How to format the text</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li><code>## Heading</code> starts a section; <code>### Smaller heading</code> a sub-heading.</li>
                        <li><code>- item</code> makes a bullet list; <code>1. item</code> a numbered list. A blank line starts a new paragraph.</li>
                        <li><code>**bold**</code>, <code>*italic*</code> and <code>[link text](https://example.com)</code> (or <code>[Contact](/contact)</code> for your own pages).</li>
                        <li>Anything else is shown exactly as typed. Words in braces are replaced with your details:</li>
                      </ul>
                      <p className="mt-2 flex flex-wrap gap-1.5">{PLACEHOLDERS.map((p) => <code key={p.token} title={p.meaning} className="rounded bg-canvas px-1.5 py-0.5">{p.token}</code>)}</p>
                    </details>
                  </div>
                )}
              </div>

              <div>
                <p className={label}>Preview</p>
                <div className="mt-1.5 max-h-[34rem] overflow-y-auto rounded-2xl border border-line bg-white p-5">
                  <h3 className="text-2xl font-bold">{draft.title || "Page title"}</h3>
                  <RichText source={preview || "Your text appears here."} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button type="button" className={btn.primary} disabled={busy} onClick={save}>{busy ? "Saving…" : draft.slug === null ? "Add page" : "Save page"}</button>
              <button type="button" className={btn.secondary} onClick={() => setDraft(null)}>Cancel</button>
              {draft.slug !== null && (draft.custom || byslug.has(draft.slug)) && (
                <button type="button" className={`${btn.danger} ml-auto`} disabled={busy} onClick={remove}>{draft.custom ? "Delete page" : "Reset to standard"}</button>
              )}
            </div>
          </Card>
        )}

        <FooterMessages site={site} brand={brand} />
      </div>
    </>
  );
}

function FooterMessages({ site, brand }: { site: SiteProfile; brand: string }) {
  const call = useAdminApi();
  const [form, setForm] = useState({ announcement: site.announcement, announcementOn: site.announcementOn, transparencyNote: site.transparencyNote, transparencyOn: site.transparencyOn });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (patch: Partial<typeof form>) => { setForm((f) => ({ ...f, ...patch })); setNotice(""); };

  async function save() {
    setError(""); setNotice(""); setBusy(true);
    try {
      await call("/admin/site-profile", { method: "PUT", body: JSON.stringify({ ...site, ...form }) });
      setNotice("Saved. The message bar and footer are updated.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Card title="Message bar and footer note" description="The strip above the header and the Transparency box in the footer. Leave the text empty to keep the standard wording.">
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.announcementOn} onChange={(e) => set({ announcementOn: e.target.checked })} /> Show the message bar above the header</label>
          <label className={label}>Message
            <input className={`${inputCls} mt-1.5`} maxLength={200} disabled={!form.announcementOn} value={form.announcement} placeholder={fillPlaceholders(DEFAULT_ANNOUNCEMENT, { brand })} onChange={(e) => set({ announcement: e.target.value })} />
            <span className={hint}>For example “Free delivery on orders above ₹499 this week”. Up to 200 characters.</span>
          </label>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.transparencyOn} onChange={(e) => set({ transparencyOn: e.target.checked })} /> Show the Transparency box in the footer</label>
          <label className={label}>Footer note
            <textarea className={`${inputCls} mt-1.5`} rows={5} maxLength={600} disabled={!form.transparencyOn} value={form.transparencyNote} placeholder={fillPlaceholders(DEFAULT_TRANSPARENCY, { brand })} onChange={(e) => set({ transparencyNote: e.target.value })} />
            <span className={hint}>You can use **bold** and [links](/privacy). Up to 600 characters.</span>
          </label>
          {form.transparencyOn && <div className="rounded-xl bg-ink p-4 text-xs leading-relaxed text-white/70"><InlineRichText source={fillPlaceholders(form.transparencyNote || DEFAULT_TRANSPARENCY, { brand })} /></div>}
        </div>
      </div>
      <div className="mt-5"><button type="button" className={btn.primary} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save message bar and footer note"}</button></div>
    </Card>
  );
}
