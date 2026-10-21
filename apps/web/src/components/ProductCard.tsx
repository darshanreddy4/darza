import Link from "next/link";
import { formatDeliveryDate, imgSet, type Product } from "@/lib/api";
import { Money } from "@/lib/currency";
import { multiBuyText, soldText } from "@/lib/labels";
import { AddToCartButton } from "./AddToCartButton";
import { RatingBadge, SaleTagBadge } from "./ProductBadges";
import { CompareButton } from "./CompareButton";
import { ShareButton } from "./ShareButton";
import { WishlistButton } from "./WishlistButton";

const ExternalIcon = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
  </svg>
);

export function SellerBadge({ product }: { product: Product }) {
  const own = product.productType === "OWN";
  return own ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Sold by {product.sellerName}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-gold/50">
      <ExternalIcon /> Partner · {product.platform}
    </span>
  );
}

const SWATCHES = [
  "from-brand-100 to-brand-200", "from-amber-100 to-orange-200", "from-sky-100 to-indigo-200", "from-rose-100 to-pink-200",
];

export function ImageFallback({ name, className = "" }: { name: string; className?: string }) {
  const swatch = SWATCHES[name.length % SWATCHES.length];
  return (
    <div className={`grid h-full w-full place-items-center bg-linear-to-br ${swatch} ${className}`} aria-hidden>
      <span className="font-display text-5xl font-extrabold text-ink/25">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

export function discountPercent(p: Pick<Product, "pricePaise" | "mrpPaise">) {
  return p.mrpPaise && p.mrpPaise > p.pricePaise ? Math.round(((p.mrpPaise - p.pricePaise) / p.mrpPaise) * 100) : 0;
}

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const discount = discountPercent(product);
  const own = product.productType === "OWN";
  const ratingShown = product.showRating && product.ratingCount > 0 && product.ratingAvg !== null;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative aspect-square overflow-hidden bg-canvas">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img {...imgSet(image.url, "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw", [320, 480, 640])} loading="lazy" decoding="async" alt={image.alt ?? product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <ImageFallback name={product.name} />
        )}
        {product.featured && (
          <span className="absolute bottom-3 left-3 rounded-lg bg-gold px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink">Featured</span>
        )}
        <WishlistButton productId={product.id} className="absolute right-3 top-3 z-10 h-9 w-9 bg-white/90 shadow-card backdrop-blur hover:bg-white" />
        <CompareButton productId={product.id} className="absolute right-3 top-14 z-10 h-9 w-9 bg-white/90 shadow-card backdrop-blur hover:bg-white" />
        <div className="absolute right-3 top-[100px] z-10"><ShareButton slug={product.slug} title={product.name} className="h-9 w-9 bg-white/90 shadow-card backdrop-blur hover:bg-white" /></div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div><SellerBadge product={product} /></div>
        <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-snug">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0">{product.name}</Link>
        </h3>
        {product.brand && <p className="text-xs text-muted">{product.brand}</p>}
        {product.packSize && <p className="text-xs text-muted">{product.packSize}</p>}
        {(ratingShown || product.soldCount > 0) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {ratingShown && <><RatingBadge value={product.ratingAvg!} count={product.ratingCount} /> <span>({product.ratingCount.toLocaleString("en-IN")})</span></>}
            {product.soldCount > 0 && <span className="font-medium text-ink-3">{soldText(product.soldCount)}</span>}
          </p>
        )}
        {product.sale && <p><span className="inline-block rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Limited-time deal</span></p>}
        {product.dealLabel && <p><span className="inline-block rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">{product.dealLabel}</span></p>}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {(product.options?.length ?? 0) > 1 && <span className="text-xs text-muted">From</span>}
            <span className="font-display text-xl font-bold"><Money paise={product.pricePaise} /></span>
            {discount > 0 && <span className="text-xs text-muted line-through"><Money paise={product.mrpPaise!} /></span>}
            {discount > 0 && <span className="text-xs font-semibold text-green-800">{discount}% off</span>}
          </div>
          <span className="text-xs font-semibold text-brand-700 opacity-0 transition group-hover:opacity-100">
            {own ? "View →" : "View deal →"}
          </span>
        </div>
        {own && product.lowStock && <p className="text-xs font-semibold text-red-700">Only few left</p>}
        {product.saleTag && <p><SaleTagBadge tag={product.saleTag} /></p>}
        {product.multiBuy && <p className="text-xs font-semibold text-green-800">{multiBuyText(product.multiBuy)}</p>}
        {!own && <p className="text-[11px] text-muted">Purchase completes on {product.platform}</p>}
        {own && product.inStock === false && <p className="text-[11px] font-medium text-red-600">Out of stock</p>}
        {own && product.onlineOnly && <p className="text-[11px] font-medium text-ink-3">Online payment only</p>}
        {own && !product.onlineOnly && !!product.advancePercent && <p className="text-[11px] font-medium text-ink-3">Pay {product.advancePercent}% now, rest on delivery</p>}
        {own && product.deliveryBy && (
          <p className="text-xs text-ink-3">{product.freeDelivery ? "FREE delivery " : "Delivery by "}<strong>{formatDeliveryDate(product.deliveryBy)}</strong></p>
        )}
        {product.showAddToCart && <AddToCartButton product={product} />}
      </div>
    </div>
  );
}
