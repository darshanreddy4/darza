import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { API_URL, imgSized, type Product } from "@/lib/api";
import { Money } from "@/lib/currency";
import { RatingSummary, ReviewCard, type ReviewItem } from "@/components/ReviewParts";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;
const SORTS = [["newest", "Newest first"], ["highest", "Highest rated"], ["lowest", "Lowest rated"]] as const;

interface Props { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
interface ReviewPage { average: number | null; count: number; page: number; pages: number; breakdown: Record<number, number>; items: ReviewItem[] }

async function getProduct(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API failed: ${res.status}`);
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  return { title: `Customer reviews for ${p.name}`, alternates: { canonical: `/products/${p.slug}/reviews` } };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Every review for one product on one page, with sorting and page links.
export default async function AllReviewsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const sort = SORTS.some(([k]) => k === first(query.sort)) ? first(query.sort)! : "newest";
  const page = Math.max(1, Math.floor(Number(first(query.page))) || 1);

  const product = await getProduct(slug);
  if (!product) notFound();
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(slug)}/reviews?page=${page}&limit=${PER_PAGE}&sort=${sort}`, { cache: "no-store" });
  if (!res.ok) notFound();
  const data: ReviewPage = await res.json();

  const href = (over: { page?: number; sort?: string }) => {
    const q = new URLSearchParams({ sort: over.sort ?? sort, page: String(over.page ?? 1) });
    return `/products/${product.slug}/reviews?${q}`;
  };
  const image = product.images[0];

  return (
    <div className="space-y-8">
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> /{" "}
        <Link href={`/products/${product.slug}`} className="hover:text-ink">{product.name}</Link> /{" "}
        <span className="text-ink">Reviews</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-card">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-canvas">
          {image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imgSized(image.url, 160)} alt="" className="h-full w-full object-cover" />
            : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Customer reviews</h1>
          <p className="mt-0.5 truncate text-sm text-muted">{product.name} · <Money paise={product.pricePaise} /></p>
        </div>
        <Link href={`/products/${product.slug}`} className="rounded-xl border border-ink px-5 py-2.5 text-sm font-semibold hover:bg-ink hover:text-white">Back to product</Link>
      </header>

      <section className="rounded-3xl border border-line bg-white p-7 shadow-card" aria-label="Rating summary">
        {data.count > 0 ? <RatingSummary data={data} /> : <p className="text-sm text-muted">No reviews yet.</p>}
      </section>

      {data.count > 0 && (
        <section aria-label="All reviews" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{data.count.toLocaleString("en-IN")} {data.count === 1 ? "review" : "reviews"}</p>
            <ul className="flex flex-wrap gap-2" aria-label="Sort reviews">
              {SORTS.map(([key, text]) => (
                <li key={key}>
                  <Link href={href({ sort: key })} aria-current={sort === key ? "true" : undefined}
                    className={`block rounded-full border px-4 py-1.5 text-sm font-medium ${sort === key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{text}</Link>
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {data.items.map((r) => <li key={r.id}><ReviewCard r={r} clamp={false} /></li>)}
          </ul>
          {data.pages > 1 && (
            <nav aria-label="Review pages" className="flex items-center justify-center gap-4 pt-2 text-sm">
              {data.page > 1 ? <Link href={href({ page: data.page - 1 })} rel="prev" className="rounded-xl border border-line px-4 py-2 font-semibold hover:border-ink">← Previous</Link> : <span />}
              <span className="text-muted">Page {data.page} of {data.pages}</span>
              {data.page < data.pages ? <Link href={href({ page: data.page + 1 })} rel="next" className="rounded-xl border border-line px-4 py-2 font-semibold hover:border-ink">Next →</Link> : <span />}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
