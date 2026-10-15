import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SocialIcon } from "@/components/SocialIcons";
import { getBusiness } from "@/lib/business";
import { contactLinks, getSite, whatsappUrl } from "@/lib/site-profile";
import { describe } from "@/lib/seo";

const DEFAULT_ABOUT = "We are a curated shopping destination. You can buy our own products directly from us, or discover hand-picked products and finish the purchase on trusted partner marketplaces. Every product says clearly who the seller is, so you always know where you are buying.";

export async function generateMetadata(): Promise<Metadata> {
  const [site, biz] = await Promise.all([getSite(), getBusiness()]);
  return { title: "About us", description: describe(site.about || site.tagline || `Learn about ${biz.name}: who we are, how we work and how to reach us.`) };
}

export default async function AboutPage() {
  const [site, biz] = await Promise.all([getSite(), getBusiness()]);
  const paragraphs = (site.about || DEFAULT_ABOUT).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const links = contactLinks(site, biz.email);
  const wa = whatsappUrl(site);
  const care: [string, string | undefined][] = [
    ["Hours", site.careHours],
    ["Phone", biz.phone],
    ["Email", biz.email],
    ["Address", biz.address],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-4">
        {site.logoUrl && <Logo light={false} logoUrl={site.logoUrl} name={biz.name} />}
        <h1 className="text-4xl font-bold">About {biz.name}</h1>
        {site.tagline && <p className="text-lg text-muted">{site.tagline}</p>}
      </header>

      <article className="space-y-4 rounded-3xl border border-line bg-white p-7 leading-relaxed text-ink-3 shadow-card sm:p-10">
        {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </article>

      <section className="grid gap-6 rounded-3xl border border-line bg-white p-7 shadow-card sm:grid-cols-2 sm:p-10">
        <div>
          <h2 className="text-xl font-bold">Customer care</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {care.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>
            ))}
          </dl>
          {site.careNote && <p className="mt-4 text-sm text-muted">{site.careNote}</p>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-brand-600">Chat on WhatsApp</a>}
          <p className="mt-5 text-sm"><Link href="/contact" className="font-semibold text-brand-700 underline">Contact &amp; grievance details</Link></p>
        </div>
        {links.length > 0 && (
          <div>
            <h2 className="text-xl font-bold">Connect with us</h2>
            <ul className="mt-4 space-y-2">
              {links.map((l) => (
                <li key={`${l.key}-${l.url}`}>
                  <a href={l.url} target={l.key === "email" ? undefined : "_blank"} rel="noopener noreferrer me" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-canvas">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700"><SocialIcon name={l.key} /></span>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
