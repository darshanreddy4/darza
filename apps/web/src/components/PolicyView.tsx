import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { RichText, fillPlaceholders } from "@/components/Markdown";
import { adsEnabled } from "@/lib/ads";
import { getBusiness } from "@/lib/business";
import { getPageContent } from "@/lib/pages";
import { defaultPolicy, type PolicySlug } from "@/lib/policy-defaults";
import { getSiteUrl } from "@/lib/site-profile";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : undefined);

// The values behind placeholders such as {brand} in page text.
export async function placeholderValues() {
  const [biz, website] = await Promise.all([getBusiness(), getSiteUrl()]);
  return {
    brand: biz.name, company: biz.legalName || biz.name, addressSuffix: biz.address ? `, ${biz.address}` : "", address: biz.address, email: biz.email,
    phone: biz.phone, gstin: biz.gstin, grievanceOfficer: biz.grievanceOfficer, grievanceEmail: biz.grievanceEmail, website,
  };
}

export async function policyMetadata(slug: PolicySlug): Promise<Metadata> {
  const def = defaultPolicy(slug)!;
  const [page, biz] = await Promise.all([getPageContent(slug), getBusiness()]);
  return { title: page?.title || def.title, description: def.description(biz.name) };
}

// A built-in policy page: the admin's own text when they wrote it, else the standard wording. Hidden pages are not found.
export async function PolicyView({ slug }: { slug: PolicySlug }) {
  const def = defaultPolicy(slug)!;
  const [page, values, ads] = await Promise.all([getPageContent(slug), placeholderValues(), adsEnabled()]);
  if (!page || !page.enabled) notFound();
  const custom = page.body.trim() !== "";
  const source = fillPlaceholders(custom ? page.body : def.body({ ads }), values);
  return (
    <LegalPage title={page.title || def.title} updated={custom ? formatDate(page.updatedAt) : undefined}>
      <RichText source={source} />
    </LegalPage>
  );
}

// A page the admin added.
export async function CustomPageView({ slug }: { slug: string }) {
  const [page, values] = await Promise.all([getPageContent(slug), placeholderValues()]);
  if (!page || !page.custom || !page.enabled) notFound();
  return (
    <LegalPage title={page.title} updated={formatDate(page.updatedAt)}>
      <RichText source={fillPlaceholders(page.body, values)} />
    </LegalPage>
  );
}

export async function customPageMetadata(slug: string): Promise<Metadata> {
  const page = await getPageContent(slug);
  return { title: page?.title ?? "Page" };
}

