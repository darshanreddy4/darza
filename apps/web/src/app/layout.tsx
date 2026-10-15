import type { Metadata } from "next";
import { Geist, Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { CompareProvider } from "@/lib/compare";
import { DEFAULT_BRAND, getBrand, getSite, getSiteUrl } from "@/lib/site-profile";
import { BrandProvider } from "@/components/BrandProvider";
import { CartSync } from "@/components/CartSync";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const [brand, base] = await Promise.all([getBrand(), getSiteUrl()]);
  return {
    metadataBase: new URL(base),
    title: { default: `${brand} — Discover products. Choose where to buy.`, template: `%s — ${brand}` },
    description: `A curated shopping platform: buy ${brand} products directly or discover selected products from trusted partner marketplaces.`,
    applicationName: brand,
    openGraph: { type: "website", siteName: brand, locale: "en_IN" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <html lang="en" className={`${geistSans.variable} ${sora.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <BrandProvider name={site.brandName || DEFAULT_BRAND} logoUrl={site.logoUrl} logoOnBadge={site.logoOnBadge}>
          <AuthProvider>
            <CartProvider><CartSync /><WishlistProvider><CompareProvider>{children}</CompareProvider></WishlistProvider></CartProvider>
          </AuthProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
