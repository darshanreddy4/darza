import { Footer, Header } from "@/components/Layout";
import { CookieNotice } from "@/components/CookieNotice";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { adsEnabled } from "@/lib/ads";
import { getSite, whatsappUrl } from "@/lib/site-profile";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { CompareBar } from "@/components/CompareBar";
import { ThemeScope } from "@/components/ThemeScope";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [ads, site] = await Promise.all([adsEnabled(), getSite()]);
  return (
    <ThemeScope>
      <Header />
      <VerifyEmailBanner />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <Footer />
      <CompareBar />
      <CookieNotice ads={ads} />
      {site.whatsappButton && site.whatsapp && <WhatsAppButton href={whatsappUrl(site)} />}
    </ThemeScope>
  );
}
