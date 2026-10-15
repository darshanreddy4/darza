import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

const INDEX = "products";

export interface SearchDoc {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string;
  highlights: string[];
  categoryName: string;
  parentCategoryName: string | null;
  categorySlugs: string[];
  productType: "OWN" | "AFFILIATE";
  featured: boolean;
  pricePaise: number;
  mrpPaise: number | null;
  image: string | null;
  createdAt: number;
}

export interface SearchQuery { q: string; category?: string; type?: "OWN" | "AFFILIATE"; featured?: boolean; page: number; limit: number }

const SAFE_SLUG = /^[a-z0-9-]{1,100}$/;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly log = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) {}

  get enabled() { return !!process.env.MEILI_URL; }

  async onModuleInit() {
    if (!this.enabled) return this.log.log("MEILI_URL not set; using database search");
    // Index in the background so a slow or missing search server never blocks API startup.
    this.reindexAll().catch((e) => this.log.warn(`Search index unavailable, falling back to database search: ${(e as Error).message}`));
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${process.env.MEILI_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.MEILI_MASTER_KEY ?? ""}`, ...init.headers },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Meilisearch ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private async waitForTask(taskUid: number) {
    for (let i = 0; i < 60; i++) {
      const t = await this.request<{ status: string; error?: { message: string } }>(`/tasks/${taskUid}`);
      if (t.status === "succeeded") return;
      if (t.status === "failed" || t.status === "canceled") throw new Error(t.error?.message ?? `task ${t.status}`);
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("Meilisearch task timed out");
  }

  private async ensureIndex() {
    try {
      await this.request(`/indexes/${INDEX}`);
    } catch {
      const t = await this.request<{ taskUid: number }>("/indexes", { method: "POST", body: JSON.stringify({ uid: INDEX, primaryKey: "id" }) });
      await this.waitForTask(t.taskUid);
    }
    const t = await this.request<{ taskUid: number }>(`/indexes/${INDEX}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["name", "brand", "categoryName", "parentCategoryName", "highlights", "description"],
        filterableAttributes: ["categorySlugs", "productType", "featured"],
        sortableAttributes: ["pricePaise", "createdAt"],
        pagination: { maxTotalHits: 2000 },
      }),
    });
    await this.waitForTask(t.taskUid);
  }

  private toDoc(p: {
    id: string; name: string; slug: string; brand: string | null; description: string; highlights: string[];
    productType: "OWN" | "AFFILIATE"; featured: boolean; pricePaise: number; mrpPaise: number | null; createdAt: Date;
    category: { name: string; slug: string; parent: { name: string; slug: string } | null };
    images: { url: string }[];
  }): SearchDoc {
    return {
      id: p.id, name: p.name, slug: p.slug, brand: p.brand, description: p.description.slice(0, 2000), highlights: p.highlights,
      categoryName: p.category.name, parentCategoryName: p.category.parent?.name ?? null,
      categorySlugs: [p.category.slug, ...(p.category.parent ? [p.category.parent.slug] : [])],
      productType: p.productType, featured: p.featured, pricePaise: p.pricePaise, mrpPaise: p.mrpPaise,
      image: p.images[0]?.url ?? null, createdAt: p.createdAt.getTime(),
    };
  }

  private readonly select = {
    id: true, name: true, slug: true, brand: true, description: true, highlights: true, productType: true, featured: true,
    pricePaise: true, mrpPaise: true, createdAt: true,
    category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
    images: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
  };

  // Rebuilds the whole index from the database (startup, category renames, admin action).
  async reindexAll(): Promise<{ indexed: number }> {
    if (!this.enabled) return { indexed: 0 };
    await this.ensureIndex();
    const products = await this.prisma.product.findMany({ where: { status: "PUBLISHED" }, select: this.select });
    const clear = await this.request<{ taskUid: number }>(`/indexes/${INDEX}/documents`, { method: "DELETE" });
    await this.waitForTask(clear.taskUid);
    if (products.length) {
      const add = await this.request<{ taskUid: number }>(`/indexes/${INDEX}/documents`, { method: "POST", body: JSON.stringify(products.map((p) => this.toDoc(p))) });
      await this.waitForTask(add.taskUid);
    }
    this.log.log(`Indexed ${products.length} product(s)`);
    return { indexed: products.length };
  }

  // Keeps one product in sync after it changes; failures are logged, never thrown.
  async sync(productId: string) {
    if (!this.enabled) return;
    try {
      const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { ...this.select, status: true } });
      if (p && p.status === "PUBLISHED") {
        await this.request(`/indexes/${INDEX}/documents`, { method: "POST", body: JSON.stringify([this.toDoc(p)]) });
      } else {
        await this.request(`/indexes/${INDEX}/documents/${encodeURIComponent(productId)}`, { method: "DELETE" });
      }
    } catch (e) {
      this.log.warn(`Could not sync product ${productId}: ${(e as Error).message}`);
    }
  }

  async remove(productId: string) {
    if (!this.enabled) return;
    await this.request(`/indexes/${INDEX}/documents/${encodeURIComponent(productId)}`, { method: "DELETE" }).catch((e) => this.log.warn(String(e)));
  }

  // Returns ranked product ids, or null when search is unavailable so callers can fall back to the database.
  async search(q: SearchQuery): Promise<{ ids: string[]; total: number } | null> {
    if (!this.enabled) return null;
    try {
      const r = await this.request<{ hits: { id: string }[]; totalHits: number }>(`/indexes/${INDEX}/search`, {
        method: "POST",
        body: JSON.stringify({ q: q.q, filter: this.filters(q), page: q.page, hitsPerPage: q.limit, attributesToRetrieve: ["id"] }),
      });
      return { ids: r.hits.map((h) => h.id), total: r.totalHits };
    } catch (e) {
      this.log.warn(`Search failed, falling back to database: ${(e as Error).message}`);
      return null;
    }
  }

  async suggest(q: string) {
    if (!this.enabled) return null;
    try {
      const r = await this.request<{ hits: SearchDoc[] }>(`/indexes/${INDEX}/search`, {
        method: "POST",
        body: JSON.stringify({ q, limit: 6, attributesToRetrieve: ["id", "name", "slug", "image", "pricePaise", "categoryName", "brand"] }),
      });
      return r.hits;
    } catch (e) {
      this.log.warn(`Suggest failed: ${(e as Error).message}`);
      return null;
    }
  }

  async status() {
    if (!this.enabled) return { enabled: false, healthy: false, documents: 0 };
    try {
      const s = await this.request<{ numberOfDocuments: number }>(`/indexes/${INDEX}/stats`);
      return { enabled: true, healthy: true, documents: s.numberOfDocuments };
    } catch {
      return { enabled: true, healthy: false, documents: 0 };
    }
  }

  private filters(q: SearchQuery): string[] {
    const f: string[] = [];
    if (q.category && SAFE_SLUG.test(q.category)) f.push(`categorySlugs = "${q.category}"`);
    if (q.type) f.push(`productType = "${q.type}"`);
    if (q.featured) f.push("featured = true");
    return f;
  }
}
