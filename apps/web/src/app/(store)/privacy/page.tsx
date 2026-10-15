import type { Metadata } from "next";
import { LegalPage, List, Section } from "@/components/LegalPage";
import { business, getBusiness } from "@/lib/business";
import { adsEnabled } from "@/lib/ads";

export async function generateMetadata(): Promise<Metadata> {
  const brand = (await getBusiness()).name;
  return { title: "Privacy Policy", description: `What personal information ${brand} collects, why we collect it, who we share it with, and how you can access, correct or delete it.` };
}

export default async function PrivacyPage() {
  const [ads, biz] = await Promise.all([adsEnabled(), getBusiness()]);
  const name = business.legalName || biz.name;
  return (
    <LegalPage title="Privacy Policy" intro={`This policy explains what personal information ${name} (“${biz.name}”, “we”) collects through this website, why, who it is shared with, and the choices you have. It is written to follow the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`}>
      <Section title="1. Information we collect">
        <List items={[
          "Account details: your name, email address, a securely hashed password, and whether you have confirmed your email address.",
          "Order details: the items you buy, delivery address and phone number (including addresses you save to your account), the coupon you used, and the payment status and payment reference. Card and UPI details are entered with our payment provider; we never see or store them.",
          "Activity on the site: products you view, your wishlist, and reviews you write.",
          "Technical data: an anonymous visitor ID stored in your browser to count product views and show recently viewed items. When you click a partner link we record the product, the time, your browser type and a hashed version of your IP address, so clicks can be counted without storing your IP address.",
          "Anything you send us when you contact support or the Grievance Officer.",
        ]} />
      </Section>
      <Section title="2. Why we use it">
        <List items={[
          "To create and secure your account, confirm your email address and let you reset your password.",
          "To take, deliver, invoice, cancel and refund orders, and to provide support.",
          "To send you service emails about your account and orders. We do not send marketing emails unless you ask for them.",
          "To show recently viewed and related products and reviews, and to understand which products interest customers so we can improve the site.",
          "To prevent fraud and abuse, and to meet legal duties such as tax and accounting records.",
        ]} />
        <p>We rely on your consent or on the need to provide the service you asked for. You can withdraw consent at any time, though we may then be unable to provide parts of the service.</p>
      </Section>
      <Section title="3. Who we share it with">
        <List items={[
          "Razorpay, our payment provider, to take online payments and issue refunds.",
          "Amazon Web Services (Amazon SES), which sends our emails on our behalf.",
          "Delivery partners, who receive your name, address and phone number to deliver your order.",
          "Our hosting and technology providers, who process data only on our instructions.",
          "Partner marketplaces, only when you choose to click through to them. They then collect data under their own policies.",
          "YouTube or other video sites, when you play an embedded video. They may set their own cookies.",
          ...(ads ? ["Google (AdSense), which shows ads on our site. Google and its partners may use cookies and similar technology to show and measure ads, and receive technical data such as your IP address and browser details."] : []),
          "Government or law-enforcement authorities where the law requires it.",
        ]} />
        <p>We do not sell your personal information. Some of our providers may process data on servers outside India.</p>
      </Section>
      <Section title="4. Cookies and local storage">
        <List items={[
          "Login cookie: when you log in we set a secure, HTTP-only cookie that keeps you signed in for up to 7 days, or until you log out. It cannot be read by scripts on the page.",
          "Browser storage: your cart, recently viewed products and anonymous visitor ID are kept in your browser so the site works as expected.",
        ]} />
        <p>These are essential to the features you use. {ads
          ? "Our pages show ads served by Google AdSense, so Google and its partners may set advertising cookies in your browser. You can manage or switch off personalised ads in Google's Ads Settings, or by using your browser's cookie controls. Apart from this, we do not use advertising or cross-site tracking cookies."
          : "We do not use advertising or cross-site tracking cookies."} Videos embedded from other sites may set their own cookies when played.</p>
      </Section>
      <Section title="5. How long we keep it">
        <p>We keep your account until you ask us to delete it. Order, invoice and payment records are kept for the period that tax, accounting and consumer laws require, even after an account is deleted, and are then erased or anonymised. Password-reset and email-confirmation links expire automatically.</p>
      </Section>
      <Section title="6. Security">
        <p>Passwords are stored only as salted hashes, and the site is served over an encrypted connection. Admin access is limited to authorised staff. No system is perfectly secure, so please use a strong, unique password and tell us at once if you suspect unauthorised use of your account.</p>
      </Section>
      <Section title="7. Your rights">
        <p>You may ask us for a summary of the personal data we hold, ask us to correct, complete or erase it, withdraw your consent, and nominate another person to exercise these rights for you if you die or become unable to. Account deletion is currently handled by our team rather than from your account page: write to us using the details on the <a href="/contact" className="text-brand-700 underline">Contact &amp; Grievance</a> page, from the email address on your account, and we will act on it subject to the retention duties above.</p>
        <p>If you are not satisfied with our response, you may complain to the Data Protection Board of India once that body is in place.</p>
      </Section>
      <Section title="8. Children">
        <p>The site is not intended for children under 18 and we do not knowingly collect their information. If you believe a child has given us data, please contact us and we will delete it.</p>
      </Section>
      <Section title="9. Changes">
        <p>When we change this policy we update the date at the top. If a change is significant we will tell you by email or on the site.</p>
      </Section>
    </LegalPage>
  );
}
