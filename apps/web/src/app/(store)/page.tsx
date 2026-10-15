import { api, type Category, type Product } from "@/lib/api";
import type { AdsenseConfig, CategorySliderConfig, ProductSliderConfig, TileCarouselConfig, CategoriesConfig, FaqConfig, HomeWidget, ProductsConfig, PromoConfig, SpacerConfig, TextConfig, TilesConfig, TrustConfig } from "@/lib/home";
import { HeroBanners, type BannerData } from "@/components/HeroBanners";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/seo";
import { getBusiness } from "@/lib/business";
import { contactLinks, getSite, getSiteUrl } from "@/lib/site-profile";
import { imgSrc } from "@/lib/api";
import { Hero, HowItWorks } from "@/components/home/Static";
import { AdsenseSlot } from "@/components/home/AdsenseSlot";
import { CategoriesWidget, CategorySliderWidget, ProductSliderWidget, TileCarouselWidget, FaqWidget, ProductsWidget, PromoWidget, SpacerWidget, TextWidget, TilesWidget, TrustWidget } from "@/components/home/Widgets";

export const dynamic = "force-dynamic";

export const metadata = { alternates: { canonical: "/" } };

type LiveWidget = HomeWidget & { products?: Product[] };

export default async function Home() {
  // The page is a list of widgets that the admin arranges under Admin → Home page.
  const [{ widgets }, site, biz, base] = await Promise.all([api<{ widgets: LiveWidget[] }>("/home"), getSite(), getBusiness(), getSiteUrl()]);
  const follow = contactLinks(site).filter((l) => l.key !== "email" && l.key !== "whatsapp").map((l) => l.url);
  const has = (type: string) => widgets.some((w) => w.type === type);
  const [categories, banners] = await Promise.all([
    has("categories") || has("category-slider") ? api<Category[]>("/categories") : ([] as Category[]),
    has("banners") ? api<BannerData[]>("/banners").catch(() => [] as BannerData[]) : ([] as BannerData[]),
  ]);

  return (
    <div className="space-y-16">
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", name: biz.name, url: absoluteUrl(base, "/"), ...(site.logoUrl && { logo: site.logoUrl.startsWith("/") ? imgSrc(site.logoUrl) : site.logoUrl }), ...(follow.length > 0 && { sameAs: follow }), ...((biz.email || biz.phone) && { contactPoint: { "@type": "ContactPoint", contactType: "customer support", ...(biz.email && { email: biz.email }), ...(biz.phone && { telephone: biz.phone }) } }) },
        { "@context": "https://schema.org", "@type": "WebSite", name: biz.name, url: absoluteUrl(base, "/"), potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl(base, "/products")}?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
      ]} />
      {widgets.map((w) => <Widget key={w.id} widget={w} categories={categories} banners={banners} brand={biz.name} />)}
    </div>
  );
}

function Widget({ widget: w, categories, banners, brand }: { widget: LiveWidget; categories: Category[]; banners: BannerData[]; brand: string }) {
  switch (w.type) {
    case "banners": return banners.length > 0 ? <HeroBanners banners={banners} /> : <Hero brand={brand} />;
    case "trust-bar": return <TrustWidget config={w.config as unknown as TrustConfig} />;
    case "categories": return <CategoriesWidget config={w.config as unknown as CategoriesConfig} categories={categories} />;
    case "products": return <ProductsWidget config={w.config as unknown as ProductsConfig} products={w.products ?? []} />;
    case "product-slider": return <ProductSliderWidget config={w.config as unknown as ProductSliderConfig} products={w.products ?? []} />;
    case "category-slider": return <CategorySliderWidget config={w.config as unknown as CategorySliderConfig} categories={categories} />;
    case "promo-banner": return <PromoWidget config={w.config as unknown as PromoConfig} />;
    case "image-tiles": return <TilesWidget config={w.config as unknown as TilesConfig} />;
    case "tile-carousel": return <TileCarouselWidget config={w.config as unknown as TileCarouselConfig} />;
    case "text": return <TextWidget config={w.config as unknown as TextConfig} />;
    case "faq": return <FaqWidget config={w.config as unknown as FaqConfig} />;
    case "how-it-works": return <HowItWorks brand={brand} />;
    case "spacer": return <SpacerWidget config={w.config as unknown as SpacerConfig} />;
    case "adsense": return <AdsenseSlot config={w.config as unknown as AdsenseConfig} />;
    default: return null;
  }
}
