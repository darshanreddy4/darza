import type { Metadata } from "next";
import { getBusiness } from "@/lib/business";
import { LegalPage, List, Section } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Cancellation & Refund Policy", description: `How to cancel a ${brand} order, when items can be returned or replaced, and how and when refunds are paid.` };
}

export default async function RefundPage() {
  const { name: brand } = await getBusiness();
  return (
    <LegalPage title="Cancellation & Refund Policy" intro={`This policy applies to products sold and fulfilled by ${brand}. For partner products, the partner marketplace's policy applies.`}>
      <Section title="1. Cancelling an order">
        <List items={[
          "To cancel an order, write to us with your order number before it is shipped. We will confirm by email once it is cancelled.",
          "If we cancel an order before it ships, you get back everything you paid for it, including the delivery charge.",
          "Once an order has shipped, you can refuse delivery or request a return under the rules below.",
          "An online order that is not paid within 30 minutes is released automatically. If a payment still reaches us after that, it is refunded automatically.",
        ]} />
      </Section>
      <Section title="2. Returns and replacements">
        <p>Each product page states its return or replacement terms (for example, a 7-day replacement for defects). To qualify, the item should be unused, in original packaging and with all accessories. Some items may not be returnable for hygiene or safety reasons; this is stated on the product page. Once an order is delivered, a Return or refund button appears next to it in My orders for a limited number of days (7 by default); use it to tell us what went wrong, and we will email you our decision.</p>
      </Section>
      <Section title="3. Wrong, damaged or defective items">
        <p>If you receive the wrong, damaged or defective product, contact us within the return window with your order number and photos. We will arrange a replacement or refund, and the delivery charge is refunded as well.</p>
      </Section>
      <Section title="4. Refunds">
        <List items={[
          "Online payments are refunded to the original payment method (card, UPI or bank account) through our payment provider. We start the refund as soon as the cancellation or return is approved. Banks usually show the credit within 5 to 7 business days; some take longer.",
          "We email you when a refund has been issued.",
          "Pay-on-delivery orders cancelled before delivery need no refund because nothing has been paid. If you return a delivered pay-on-delivery order, we refund by bank or UPI transfer to the details you give us.",
          "If you used a coupon, the refund is the amount you actually paid, after the discount.",
          "If you return an item that is not defective and was not sent in error, we may keep the delivery charge. This is stated on the product page where it applies.",
        ]} />
      </Section>
      <Section title="5. Partner products">
        <p>Cancellations, returns and refunds for products you buy on a partner marketplace are handled entirely by that marketplace under its own policy.</p>
      </Section>
      <Section title="6. Not happy with how we handled it?">
        <p>Write to our Grievance Officer. The details are on the <a href="/contact" className="text-brand-700 underline">Contact &amp; Grievance</a> page.</p>
      </Section>
    </LegalPage>
  );
}
