import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_URL, formatPrice, imgSrc, type Product } from "@/lib/api";
import { absoluteUrl, breadcrumbJsonLd, describe, productJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { getBrand, getSiteUrl } from "@/lib/site-profile";
import { PurchaseActions } from "@/components/PurchaseActions";
import { ProductCarousel } from "@/components/ProductCarousel";
import { ProductGallery } from "@/components/ProductGallery";
import { SellerBadge, discountPercent } from "@/components/ProductCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { Questions } from "@/components/Questions";
import { Reviews } from "@/components/Reviews";
import { Stars } from "@/components/Stars";
import { ViewTracker } from "@/components/ViewTracker";
import { WishlistButton } from "@/components/WishlistButton";
import { CompareButton } from "@/components/CompareButton";

export const dynamic = "force-dynamic";

// Shared by the page and its metadata so one request serves both.
const getProduct = cache(async (slug: string): Promise<Product | null> => {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
});

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [p, base] = await Promise.all([getProduct(slug), getSiteUrl()]);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = describe(p.highlights?.[0] ? `${p.highlights.slice(0, 3).join(" · ")}. ${p.description}` : p.description);
  const image = p.images[0] ? imgSrc(p.images[0].url) : undefined;
  const title = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.name} by ${p.brand}` : p.name;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(base, `/products/${p.slug}`) },
    openGraph: { type: "website", title, description, url: absoluteUrl(base, `/products/${p.slug}`), images: image ? [{ url: image, alt: p.images[0].alt ?? p.name }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

interface Related {
  category: { name: string; slug: string };
  brand?: string;
  similar: Product[];
  sameBrand: Product[];
  alsoViewed: Product[];
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const encoded = encodeURIComponent(slug);
  const [product, relatedRes] = await Promise.all([
    getProduct(slug),
    fetch(`${API_URL}/products/${encoded}/related`, { cache: "no-store" }).catch(() => null),
  ]);
  if (!product) notFound();
  const [base, brand] = await Promise.all([getSiteUrl(), getBrand()]);
  const related: Related | null = relatedRes?.ok ? await relatedRes.json() : null;

  const discount = discountPercent(product);
  const specs = Object.entries(product.specifications ?? {});
  const own = product.productType === "OWN";
  const highlights = product.highlights ?? [];
  const details: [string, React.ReactNode][] = [
    ...(product.brand ? [["Brand", product.brand] as [string, React.ReactNode]] : []),
    ...(product.category ? [["Category", <Link key="c" href={`/products?category=${product.category.slug}`} className="text-brand-700 hover:underline">{product.category.parent ? `${product.category.parent.name} › ` : ""}{product.category.name}</Link>] as [string, React.ReactNode]] : []),
    ["Sold by", product.sellerName],
    ["Fulfilment", own ? `Sold and fulfilled by ${product.sellerName || brand}` : `Purchased on ${product.platform}`],
    ...(own && product.deliveryInfo ? [["Delivery", product.deliveryInfo] as [string, React.ReactNode]] : []),
    ...(own && product.returnPolicy ? [["Returns", product.returnPolicy] as [string, React.ReactNode]] : []),
    ...specs.map(([k, v]) => [k, v] as [string, React.ReactNode]),
  ];
  const card = "scroll-mt-44 rounded-3xl border border-line bg-white p-7 shadow-card";

  return (
    <div className="space-y-10">
      <JsonLd data={productJsonLd(product, base)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", path: "/" },
        ...(product.category?.parent ? [{ name: product.category.parent.name, path: `/products?category=${product.category.parent.slug}` }] : []),
        ...(product.category ? [{ name: product.category.name, path: `/products?category=${product.category.slug}` }] : []),
        { name: product.name, path: `/products/${product.slug}` },
      ], base)} />
      <ViewTracker slug={product.slug} />
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        {product.category && <>{product.category.parent && <><Link href={`/products?category=${product.category.parent.slug}`} className="hover:text-ink">{product.category.parent.name}</Link> / </>}<Link href={`/products?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> / </>}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0 lg:sticky lg:top-40 lg:self-start">
          <ProductGallery key={product.id} images={product.images} videoUrls={product.videoUrls ?? []} name={product.name} />
        </div>

        <div className="lg:sticky lg:top-40 lg:self-start">
          <div className="space-y-5 rounded-3xl border border-line bg-white p-7 shadow-card">
            <SellerBadge product={product} />
            <div>
              <h1 className="text-3xl font-bold leading-tight">{product.name}</h1>
              {product.brand && <p className="mt-1 text-sm text-muted">by {product.brand}</p>}
              {product.ratingCount > 0 && product.ratingAvg !== null && (
                <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm"><Stars value={product.ratingAvg} size={16} /> <strong>{product.ratingAvg}</strong> <span className="text-muted underline">{product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"}</span></a>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-4xl font-bold">{formatPrice(product.pricePaise)}</span>
                {discount > 0 && (
                  <>
                    <span className="text-muted line-through">{formatPrice(product.mrpPaise!)}</span>
                    <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-semibold text-brand-800">Save {discount}%</span>
                  </>
                )}
              </div>
              {!own && <p className="mt-1 text-xs text-muted">Price may change on {product.platform}. Check the final price there.</p>}
            </div>

            <PurchaseActions product={product} />
            <WishlistButton productId={product.id} label className="w-full rounded-xl border border-line py-2.5 hover:border-rose-300" />
            <CompareButton productId={product.id} label className="w-full rounded-xl border border-line py-2.5 hover:border-brand-300" />

            <dl className="divide-y divide-line rounded-2xl bg-canvas text-sm">
              <Row label="Sold by" value={product.sellerName} />
              {own && product.deliveryInfo && <Row label="Delivery" value={product.deliveryInfo} />}
              {own && product.returnPolicy && <Row label="Returns" value={product.returnPolicy} />}
              {!own && <Row label="Delivery & returns" value={`Handled by ${product.platform}`} />}
            </dl>
          </div>
        </div>
      </div>

      <nav aria-label="On this page" className="no-scrollbar -mt-2 flex gap-2 overflow-x-auto text-sm">
        {[["#about", "About this item"], ["#details", "Product details"], ["#reviews", "Reviews"], ["#questions", "Questions"], ["#related", "Related products"]].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-line bg-white px-4 py-1.5 font-medium text-ink-3 hover:border-brand-500 hover:text-brand-700">{label}</a>
        ))}
      </nav>

      <section id="about" className={card}>
        <h2 className="text-xl font-bold">About this item</h2>
        {highlights.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex gap-3 leading-relaxed text-ink-3">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-brand-600"><path d="M5 12l5 5L20 7" /></svg>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-3">{product.description}</p>
        )}
      </section>

      {highlights.length > 0 && (
        <section className={card}>
          <h2 className="text-xl font-bold">Product description</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-3">{product.description}</p>
        </section>
      )}

      <section id="details" className={card}>
        <h2 className="text-xl font-bold">Product details</h2>
        <dl className="mt-4 overflow-hidden rounded-2xl border border-line text-sm">
          {details.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="grid grid-cols-[minmax(110px,1fr)_2fr] border-b border-line last:border-0 sm:grid-cols-[220px_1fr]">
              <dt className="bg-canvas px-4 py-3 font-semibold text-ink-3">{k}</dt>
              <dd className="px-4 py-3">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Reviews slug={product.slug} />

      <Questions slug={product.slug} />

      <div id="related" className="scroll-mt-44 space-y-12 border-t border-line pt-10">
        {related && (
          <>
            <ProductCarousel title={`Related products in ${related.category.name}`} subtitle="Customers exploring this product also looked at" href={`/products?category=${related.category.slug}`} items={related.similar} />
            <ProductCarousel title="Customers who viewed this also viewed" items={related.alsoViewed} />
            {related.brand && <ProductCarousel title={`More from ${related.brand}`} href={`/products?q=${encodeURIComponent(related.brand)}`} items={related.sameBrand} />}
          </>
        )}
        <RecentlyViewed productId={product.id} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 font-medium">{value}</dd>
    </div>
  );
}
