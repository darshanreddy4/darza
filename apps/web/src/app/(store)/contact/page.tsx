import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";
import { SocialIcon } from "@/components/SocialIcons";
import { getBusiness } from "@/lib/business";
import { contactLinks, getSite, whatsappUrl } from "@/lib/site-profile";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Contact & Grievance", description: `How to reach ${brand} customer support and our Grievance Officer, and how quickly we respond to complaints.` };
}

export default async function ContactPage() {
  const [biz, site] = await Promise.all([getBusiness(), getSite()]);
  const links = contactLinks(site, biz.email);
  const wa = whatsappUrl(site);
  const rows: [string, string | undefined][] = [
    ["Business name", biz.legalName || biz.name],
    ["Registered address", biz.address],
    ["Support email", biz.email],
    ["Support phone", biz.phone],
    ["Customer care hours", site.careHours],
    ["GSTIN", biz.gstin],
  ];
  return (
    <LegalPage title="Contact & Grievance">
      <Section title="Customer support">
        <dl className="overflow-hidden rounded-2xl border border-line text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[150px_1fr] border-b border-line last:border-0">
              <dt className="bg-canvas px-4 py-3 font-semibold text-ink-3">{k}</dt>
              <dd className="px-4 py-3">{v}</dd>
            </div>
          ))}
        </dl>
        {site.careNote && <p>{site.careNote}</p>}
        <p>Please include your order number when you write to us. For partner products, contact the partner marketplace directly.</p>
        {(wa || links.length > 0) && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {links.map((l) => (
              <li key={`${l.key}-${l.url}`}>
                <a href={l.url} target={l.key === "email" ? undefined : "_blank"} rel="noopener noreferrer me" className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brand-500 hover:text-brand-700">
                  <SocialIcon name={l.key} size={16} /> {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Grievance officer">
        {biz.grievanceOfficer ? (
          <p>If you have a complaint about the site, a product, your order or your personal data, write to our Grievance Officer, <strong>{biz.grievanceOfficer}</strong>{biz.grievanceEmail ? <> at <a href={`mailto:${biz.grievanceEmail}`} className="text-brand-700 underline">{biz.grievanceEmail}</a></> : null}. We acknowledge every complaint within 48 hours and aim to resolve it within one month.</p>
        ) : (
          <p>Grievance officer details will be published here.</p>
        )}
      </Section>
      <Section title="Requests about your personal data">
        <p>To see, correct or delete the personal data we hold about you, write to the same address from the email address on your account. See our <a href="/privacy" className="text-brand-700 underline">Privacy Policy</a> for details.</p>
      </Section>
    </LegalPage>
  );
}
