import type { Metadata } from "next";
import { getBusiness } from "@/lib/business";
import { LegalPage, List, Section } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Shipping Policy", description: `Where ${brand} delivers, how long it takes, what delivery costs, and how to track your order.` };
}

export default async function ShippingPage() {
  const { name: brand } = await getBusiness();
  return (
    <LegalPage title="Shipping Policy" intro={`This policy applies to products sold and fulfilled by ${brand}. Partner products are shipped by the partner marketplace.`}>
      <Section title="1. Where we deliver">
        <p>We deliver to serviceable pincodes across India. If we cannot deliver to your address we will tell you before dispatch.</p>
      </Section>
      <Section title="2. Delivery time">
        <p>The estimated delivery date or time is shown on the product page when we have one. Timelines start once the order is confirmed and may be affected by location, weather, public holidays and courier delays.</p>
      </Section>
      <Section title="3. Shipping charges">
        <List items={[
          "A flat delivery charge applies to orders below a minimum value. Orders above it, and products marked free delivery, ship free. The current charge and the free-delivery threshold are shown in your cart and again at checkout, before you pay.",
          "The total on the checkout page is the amount you pay. Coupons can lower the price of items; they do not change the delivery rules unless the coupon says so.",
        ]} />
      </Section>
      <Section title="4. Order tracking">
        <p>You can follow the status of your order under <a href="/orders" className="text-brand-700 underline">My orders</a>: placed, paid, shipped and delivered. We also email you when your order is confirmed, shipped, delivered, cancelled or refunded.</p>
      </Section>
      <Section title="5. Delivery attempts and damaged parcels">
        <List items={[
          "Please ensure someone is available to receive the parcel. Couriers usually make multiple attempts.",
          "If a parcel looks tampered with or damaged, please do not accept it and contact us, or tell us within 48 hours of delivery with photos.",
          "For pay-on-delivery orders, please keep the exact amount ready.",
        ]} />
      </Section>
      <Section title="6. Partner products">
        <p>Orders for partner products are placed on the partner&apos;s site and are shipped and tracked by them. Please contact the partner for delivery queries.</p>
      </Section>
    </LegalPage>
  );
}
