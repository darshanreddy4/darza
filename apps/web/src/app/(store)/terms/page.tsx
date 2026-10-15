import type { Metadata } from "next";
import { LegalPage, List, Section } from "@/components/LegalPage";
import { business, getBusiness } from "@/lib/business";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Terms & Conditions", description: `The terms that apply when you use the ${brand} website, buy ${brand} products, or follow links to partner marketplaces.` };
}

export default async function TermsPage() {
  const biz = await getBusiness();
  const name = business.legalName || biz.name;
  return (
    <LegalPage title="Terms & Conditions" intro={`These terms govern your use of the ${biz.name} website and the purchases you make through it. By using the site you agree to them.`}>
      <Section title="1. Who we are">
        <p>{biz.name} is operated by {name}{biz.address ? `, ${biz.address}` : ""}. We offer two kinds of products: products sold and fulfilled by us (&ldquo;{biz.name} products&rdquo;) and products from partner marketplaces that we feature and link to (&ldquo;partner products&rdquo;). Our contact details are on the <a href="/contact" className="text-brand-700 underline">Contact &amp; Grievance</a> page.</p>
      </Section>
      <Section title={`2. ${biz.name} products vs partner products`}>
        <List items={[
          `${biz.name} products are added to the ${biz.name} cart and paid for on this site. We are the seller and handle delivery, returns and refunds.`,
          "Partner products show a button such as “Buy on Amazon”. Clicking it takes you to the partner's site, where the sale is between you and that seller. Their terms, prices, delivery, returns and support apply, not ours.",
          "Each product page states clearly who the seller is.",
        ]} />
      </Section>
      <Section title="3. Your account">
        <List items={[
          "You must be at least 18 and able to enter a binding contract to place an order.",
          "You are responsible for keeping your login details confidential and for activity under your account. Provide accurate information and tell us if you suspect unauthorised use.",
          "To place an order or write a review you must confirm your email address using the link we send you.",
          "We may suspend or close an account that is used for fraud, abuse or to break these terms.",
        ]} />
      </Section>
      <Section title="4. Orders and pricing">
        <List items={[
          "Prices are in Indian rupees. The price on the product page is the price of the item; delivery charges and discounts are added or subtracted in your cart and at checkout, and the total shown there is what you pay.",
          "An order is accepted when we confirm it. We may cancel an order if a product is unavailable, if there is a pricing error, or if we suspect fraud; any payment already received will be refunded in full.",
          "An online order that is not paid within 30 minutes is released automatically and its stock becomes available again. If a payment still arrives after that, it is refunded to you.",
          "For partner products, the price shown here is indicative and may differ on the partner's site. The partner's price at checkout applies.",
        ]} />
      </Section>
      <Section title="5. Delivery charges, coupons and offers">
        <List items={[
          "Delivery charges, and the order value above which delivery is free, are shown in your cart and at checkout. See our Shipping Policy.",
          `Coupon codes have no cash value, apply only to ${biz.name} products, and are subject to their own conditions (for example a minimum order, an expiry date or a limit on uses). We may withdraw or change a coupon that has been misused.`,
          "A discount is shared across the items in your order. If part of an order is cancelled or refunded, we refund the amount you actually paid for it.",
        ]} />
      </Section>
      <Section title="6. Payments and invoices">
        <List items={[
          "You can pay online through our payment gateway (as many methods as it offers, such as cards, UPI and net banking) or, where offered, pay on delivery. Card and UPI details are handled by the payment provider and are not stored by us.",
          `We issue an invoice for each ${biz.name} order, available from My orders. Depending on our registration status it is a tax invoice with GST shown separately, or a bill of supply. The type is printed on the document.`,
        ]} />
      </Section>
      <Section title="7. Reviews and content">
        <p>Reviews you post must be honest and lawful, and based on your own experience. You grant us a non-exclusive right to display them on the site. We may remove content that is abusive, misleading or infringes others&apos; rights. A “verified” label means the reviewer bought the product from us.</p>
      </Section>
      <Section title="8. Acceptable use">
        <p>Do not misuse the site: no scraping at a scale that harms it, no attempts to gain unauthorised access, no automated ordering or coupon abuse, and no uploading of unlawful content.</p>
      </Section>
      <Section title="9. Intellectual property">
        <p>The site design, logo and original content belong to {name}. Product names and images may belong to their respective owners and are used to describe the products.</p>
      </Section>
      <Section title="10. Limitation of liability">
        <p>To the extent permitted by law, we are not liable for indirect or consequential loss, or for the acts of partner marketplaces. Nothing in these terms limits any right you have under applicable consumer protection law, including the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020.</p>
      </Section>
      <Section title="11. Complaints">
        <p>If something goes wrong, write to our Grievance Officer using the details on the <a href="/contact" className="text-brand-700 underline">Contact &amp; Grievance</a> page.</p>
      </Section>
      <Section title="12. Governing law and changes">
        <p>These terms are governed by the laws of India. Courts at the location of our registered office have jurisdiction, subject to any consumer forum rights you have by law. We may update these terms; the date at the top shows the latest version, and an order is governed by the version in force when you placed it.</p>
      </Section>
    </LegalPage>
  );
}
