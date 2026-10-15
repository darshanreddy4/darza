import type { Metadata } from "next";
import { LegalPage, List, Section } from "@/components/LegalPage";
import { getBusiness } from "@/lib/business";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Affiliate Disclosure", description: `How ${brand} earns commission on some partner products, and how we label partner products, ${brand} products and sponsored banners.` };
}

export default async function AffiliateDisclosurePage() {
  const business = await getBusiness();
  return (
    <LegalPage title="Affiliate Disclosure">
      <Section title="How partner products work">
        <p>Some products featured on {business.name} contain affiliate links. If you click one and make a purchase on the partner&apos;s website, {business.name} may earn a commission <strong>at no additional cost to you</strong>.</p>
      </Section>
      <Section title="What this means for you">
        <List items={[
          "Partner products are clearly labelled “Partner” on cards and carry a “Buy on <marketplace>” button with an external-link icon. Their product pages carry a disclosure.",
          "You complete payment, delivery, returns and support on the partner's site.",
          "Prices shown here are indicative and can change; the partner's final price applies.",
          "Commissions do not change the price you pay. Our selection is curated by our team, and the possibility of a commission is not the only reason a product appears.",
          "When you click through, we count the click (see our Privacy Policy) so we can see which products interest customers.",
        ]} />
      </Section>
      <Section title={`${business.name} products`}>
        <p>Products marked “Sold by {business.name}” are sold and fulfilled by us directly. You pay on this site and we handle delivery and returns.</p>
      </Section>
      <Section title="Sponsored banners">
        <p>If a banner on our home page is paid for or provided by a brand, it is marked with the sponsor&apos;s name.</p>
      </Section>
    </LegalPage>
  );
}
