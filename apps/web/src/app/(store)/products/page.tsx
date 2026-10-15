import Link from "next/link";
import type { Metadata } from "next";
import { api, type Category, type ProductList } from "@/lib/api";
import { absoluteUrl } from "@/lib/seo";
import { getBrand, getSiteUrl } from "@/lib/site-profile";
import { buildCategoryTree } from "@/lib/categories";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/products">): Promise<Metadata> {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(sp.q);
  const category = one(sp.category);
  const type = one(sp.type);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  // Search results and filtered views are for shoppers; only the category pages and the full list belong in search engines.
  if (q || type || one(sp.featured)) return { title: q ? `Results for “${q}”` : "Products", robots: { index: false, follow: true } };

  const [brand, base] = await Promise.all([getBrand(), getSiteUrl()]);
  const name = category ? (await api<Category[]>("/categories").catch(() => [] as Category[])).find((c) => c.slug === category)?.name : undefined;
  if (category && !name) return { title: "Products", robots: { index: false } };
  const title = name ?? "All products";
  const description = name
    ? `Shop ${name} at ${brand}: products sold by us and hand-picked deals from trusted marketplaces.`
    : `Browse every ${brand} product: items sold by us and hand-picked deals from trusted partner marketplaces.`;
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const path = `/products${params.size ? `?${params}` : ""}`;
  return { title: page > 1 ? `${title} (page ${page})` : title, description, alternates: { canonical: absoluteUrl(base, path) }, openGraph: { title, description, url: absoluteUrl(base, path) } };
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(sp.q);
  const category = one(sp.category);
  const type = one(sp.type);
  const featured = one(sp.featured);
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const params = new URLSearchParams({ page: String(page), limit: "24" });
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (type) params.set("type", type);
  if (featured === "true") params.set("featured", "true");

  const [categories, list] = await Promise.all([
    api<Category[]>("/categories"),
    api<ProductList>(`/products?${params}`),
  ]);

  const href = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q, category, type, featured, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/products?${next}`;
  };
  const pages = Math.ceil(list.total / list.limit);
  const brand = await getBrand();
  const activeCategory = categories.find((c) => c.slug === category);
  const tree = buildCategoryTree(categories);
  const activeParent = activeCategory?.parentId ? categories.find((c) => c.id === activeCategory.parentId) : activeCategory;
  const activeBranch = tree.find((p) => p.id === activeParent?.id);
  const title = q ? `Results for “${q}”` : activeCategory?.name ?? (type === "OWN" ? `Sold by ${brand}` : type === "AFFILIATE" ? "Partner deals" : "All products");

  return (
    <div className="space-y-6">
      <div>
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink">Home</Link> /{" "}
          <Link href="/products" className="hover:text-ink">Products</Link>
          {activeParent && <> / <Link href={href({ category: activeParent.slug, page: undefined })} className={activeCategory?.id === activeParent.id ? "text-ink" : "hover:text-ink"}>{activeParent.name}</Link></>}
          {activeCategory && activeCategory.id !== activeParent?.id && <> / <span className="text-ink">{activeCategory.name}</span></>}
        </nav>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{list.total} {list.total === 1 ? "product" : "products"}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit space-y-6 rounded-2xl border border-line bg-white p-5 text-sm shadow-card lg:sticky lg:top-40">
          <FilterGroup title="Categories">
            {activeBranch ? (
              <>
                <FilterLink href={href({ category: undefined, page: undefined })} active={false}>‹ All categories</FilterLink>
                <FilterLink href={href({ category: activeBranch.slug, page: undefined })} active={category === activeBranch.slug} count={activeBranch.productCount}>{activeBranch.name}</FilterLink>
                {activeBranch.children.map((c) => (
                  <FilterLink key={c.id} href={href({ category: c.slug, page: undefined })} active={category === c.slug} count={c.productCount} indent>{c.name}</FilterLink>
                ))}
              </>
            ) : (
              <>
                <FilterLink href={href({ category: undefined, page: undefined })} active={!category}>All categories</FilterLink>
                {tree.map((c) => (
                  <FilterLink key={c.id} href={href({ category: c.slug, page: undefined })} active={false} count={c.productCount}>{c.name}</FilterLink>
                ))}
              </>
            )}
          </FilterGroup>
          <FilterGroup title="Buy from">
            <FilterLink href={href({ type: undefined, page: undefined })} active={!type}>Everyone</FilterLink>
            <FilterLink href={href({ type: "OWN", page: undefined })} active={type === "OWN"}>{brand}</FilterLink>
            <FilterLink href={href({ type: "AFFILIATE", page: undefined })} active={type === "AFFILIATE"}>Partner marketplaces</FilterLink>
          </FilterGroup>
        </aside>

        <section>
          {activeBranch && activeBranch.children.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2" aria-label="Subcategories">
              {activeBranch.children.map((c) => (
                <Link key={c.id} href={href({ category: c.slug, page: undefined })} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${category === c.slug ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-brand-500"}`}>
                  {c.name} <span className="opacity-60">{c.productCount}</span>
                </Link>
              ))}
            </div>
          )}
          {list.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white p-16 text-center">
              <p className="text-lg font-semibold">No products found</p>
              <p className="mt-1 text-sm text-muted">Try a different search or clear your filters.</p>
              <Link href="/products" className="mt-5 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white">Clear filters</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {list.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          {pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3 text-sm">
              {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-xl border border-line bg-white px-4 py-2 font-medium hover:border-ink">← Previous</Link>}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded-xl border border-line bg-white px-4 py-2 font-medium hover:border-ink">Next →</Link>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function FilterLink({ href, active, count, indent, children }: { href: string; active: boolean; count?: number; indent?: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={`flex items-center justify-between rounded-lg px-3 py-2 ${indent ? "ml-4" : ""} ${active ? "bg-brand-50 font-semibold text-brand-800" : "text-ink-3 hover:bg-canvas"}`}>
        <span>{children}</span>
        {count !== undefined && <span className="text-xs text-muted">{count}</span>}
      </Link>
    </li>
  );
}
