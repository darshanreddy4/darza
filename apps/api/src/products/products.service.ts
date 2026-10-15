import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CacheService } from "../cache/cache.service";
import { applyBrand } from "../site/brand";
import { SiteService } from "../site/site.module";
import { SearchService } from "../search/search.service";
import { ProductDto } from "./product.dto";
import { DEFAULT_AFFILIATE_DISCLOSURE, validateProductRules } from "./product-rules";
import { isSupportedVideoUrl } from "./video-url";
import { buildAdminProductQuery, type AdminProductQuery } from "./admin-query";
import { publicCardFields } from "./card-options";
import { planBulkPatch, validateBulkChanges } from "./bulk-update";
import type { BulkUpdateProductsDto } from "./bulk-update.dto";

export interface ListQuery {
  q?: string;
  category?: string;
  type?: "OWN" | "AFFILIATE";
  featured?: boolean;
  page: number;
  limit: number;
}

export const withImages = { images: { orderBy: { position: "asc" } } } satisfies Prisma.ProductInclude;
export type ProductWithImages = Prisma.ProductGetPayload<{ include: typeof withImages }>;
type Rating = { avg: number; count: number };

// Short, so stock and price changes made outside the admin (orders) show up quickly.
const PUBLIC_TTL = 30;

// Hides the raw affiliate URL (clicks go through /go/:slug), SKU, cost and exact stock.
function toPublic(p: ProductWithImages, rating: Rating | undefined, brand: string) {
  const { sku, stock, affiliateUrl, status, costPaise, ...rest } = p;
  // Our own products are sold under the brand name unless the admin typed another seller.
  return applyBrand({
    ...rest,
    sellerName: p.productType === "OWN" && !p.sellerName.trim() ? brand : p.sellerName,
    ...publicCardFields(p),
    inStock: p.productType === "OWN" ? (stock ?? 0) > 0 : null,
    ratingAvg: rating ? Math.round(rating.avg * 10) / 10 : null,
    ratingCount: rating?.count ?? 0,
  }, brand);
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private search: SearchService, private cache: CacheService, private site: SiteService) {}

  listPublic(q: ListQuery) {
    return this.cache.wrap("products", { ...q }, PUBLIC_TTL, () => this.loadPublicList(q));
  }

  private async loadPublicList(q: ListQuery) {
    if (q.q) {
      const hit = await this.search.search({ q: q.q, category: q.category, type: q.type, featured: q.featured, page: q.page, limit: q.limit });
      if (hit) return { total: hit.total, page: q.page, limit: q.limit, items: await this.byIds(hit.ids) };
    }

    const where: Prisma.ProductWhereInput = {
      status: "PUBLISHED",
      ...(q.type && { productType: q.type }),
      ...(q.featured && { featured: true }),
      ...(q.category && { category: { OR: [{ slug: q.category }, { parent: { slug: q.category } }] } }),
      ...(q.q && {
        OR: [
          { name: { contains: q.q, mode: "insensitive" } },
          { brand: { contains: q.q, mode: "insensitive" } },
          { description: { contains: q.q, mode: "insensitive" } },
        ],
      }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where, include: withImages, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.limit, take: q.limit,
      }),
    ]);
    return { total, page: q.page, limit: q.limit, items: await this.toPublicList(items) };
  }

  async toPublicList(products: ProductWithImages[]) {
    const groups = await this.prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const byId = new Map(groups.map((g) => [g.productId, { avg: g._avg.rating ?? 0, count: g._count._all }]));
    const brand = await this.site.brandName();
    return products.map((p) => toPublic(p, byId.get(p.id), brand));
  }

  getPublic(slug: string) {
    return this.cache.wrap("product", { slug }, PUBLIC_TTL, () => this.loadPublic(slug));
  }

  // Every published product, for the sitemap.
  async sitemap() {
    return this.cache.wrap("sitemap", {}, 300, async () => {
      const [products, categories] = await Promise.all([
        this.prisma.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }),
        this.prisma.category.findMany({ where: { products: { some: { status: "PUBLISHED" } } }, select: { slug: true } }),
      ]);
      return { products, categories };
    });
  }

  private async loadPublic(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: { ...withImages, category: { include: { parent: { select: { name: true, slug: true } } } } },
    });
    if (!p) throw new NotFoundException();
    const [pub] = await this.toPublicList([p]);
    return { ...pub, category: p.category };
  }

  async resolveAffiliateRedirect(slug: string, meta: { ip?: string; userAgent?: string; referrer?: string }) {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: "PUBLISHED", productType: "AFFILIATE" },
      select: { id: true, affiliateUrl: true, platform: true },
    });
    if (!p?.affiliateUrl) throw new NotFoundException();
    const salt = process.env.JWT_SECRET ?? "";
    await this.prisma.affiliateClick.create({
      data: {
        productId: p.id,
        platform: p.platform,
        referrer: meta.referrer?.slice(0, 500),
        userAgent: meta.userAgent?.slice(0, 300),
        ipHash: meta.ip ? createHash("sha256").update(salt + meta.ip).digest("hex") : undefined,
      },
    });
    return p.affiliateUrl;
  }

  async byIds(ids: string[]) {
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, include: withImages });
    const order = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return this.toPublicList(rows);
  }

  // Same category first, then neighbouring categories; plus same brand and products other visitors also viewed.
  related(slug: string) {
    return this.cache.wrap("related", { slug }, 60, () => this.loadRelated(slug));
  }

  private async loadRelated(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true, brand: true, categoryId: true, category: { select: { id: true, name: true, slug: true, parentId: true } } },
    });
    if (!product) throw new NotFoundException();
    const LIMIT = 12;
    const published = { status: "PUBLISHED" as const, id: { not: product.id } };
    const order = [{ featured: "desc" as const }, { createdAt: "desc" as const }];

    const sameCategory = await this.prisma.product.findMany({ where: { ...published, categoryId: product.categoryId }, include: withImages, orderBy: order, take: LIMIT });
    let similar = sameCategory;
    if (similar.length < LIMIT) {
      const parentId = product.category.parentId ?? product.category.id;
      const near = await this.prisma.category.findMany({
        where: { OR: [{ id: parentId }, { parentId }], NOT: { id: product.categoryId } },
        select: { id: true },
      });
      const more = await this.prisma.product.findMany({
        where: { ...published, categoryId: { in: near.map((c) => c.id) }, id: { notIn: [product.id, ...similar.map((p) => p.id)] } },
        include: withImages, orderBy: order, take: LIMIT - similar.length,
      });
      similar = [...similar, ...more];
    }

    const brand = product.brand?.trim();
    const sameBrand = brand
      ? await this.prisma.product.findMany({
          where: { ...published, brand: { equals: brand, mode: "insensitive" } },
          include: withImages, orderBy: order, take: 10,
        })
      : [];

    const co = await this.prisma.$queryRaw<{ productId: string }[]>`
      SELECT v2."productId", COUNT(DISTINCT v2."visitorId")::int AS visitors
      FROM "ProductView" v1
      JOIN "ProductView" v2 ON v2."visitorId" = v1."visitorId" AND v2."productId" <> v1."productId"
      JOIN "Product" p ON p.id = v2."productId" AND p.status::text = 'PUBLISHED'
      WHERE v1."productId" = ${product.id}
      GROUP BY v2."productId" ORDER BY visitors DESC LIMIT 10`;
    const alsoViewed = co.length ? await this.byIds(co.map((r) => r.productId)) : [];

    const [similarPub, brandPub] = await Promise.all([this.toPublicList(similar), this.toPublicList(sameBrand)]);
    return { category: { name: product.category.name, slug: product.category.slug }, brand, similar: similarPub, sameBrand: brandPub, alsoViewed };
  }

  // ---- admin ----

  async listAdmin(query: AdminProductQuery) {
    const { lowStockThreshold } = await this.prisma.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
    return this.prisma.product.findMany({ include: withImages, ...buildAdminProductQuery(query, lowStockThreshold) });
  }

  async getAdmin(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: withImages });
    if (!p) throw new NotFoundException();
    return p;
  }

  async create(dto: ProductDto) {
    const data = this.normalise(dto);
    try {
      const created = await this.prisma.product.create({ data, include: withImages });
      await this.search.sync(created.id);
      await this.cache.invalidate();
      return created;
    } catch (e) {
      throw this.mapDbError(e);
    }
  }

  async update(id: string, dto: ProductDto) {
    await this.getAdmin(id);
    const { images, ...data } = this.normalise(dto);
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: { ...data, images: { deleteMany: {}, create: images.create } },
        include: withImages,
      });
      await this.search.sync(id);
      await this.cache.invalidate();
      return updated;
    } catch (e) {
      throw this.mapDbError(e);
    }
  }

  // Applies one change to many products at once; all updates commit together or not at all.
  async bulkUpdate(dto: BulkUpdateProductsDto) {
    const problems = validateBulkChanges(dto.changes);
    if (problems.length) throw new BadRequestException(problems);

    const ids = [...new Set(dto.ids)];
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, productType: true, pricePaise: true, mrpPaise: true } });
    const plans = rows.map((row) => ({ row, ...planBulkPatch(row, dto.changes) }));
    const toUpdate = plans.filter((p) => !p.skipReason && Object.keys(p.patch).length > 0);

    // Before/after prices for the first few products, so the admin can sanity-check a bulk price change.
    const num = (v: unknown, fallback: number | null) => (v === undefined ? fallback : typeof v === "number" || v === null ? v : fallback);
    const examples = toUpdate.slice(0, 5).map((p) => ({
      name: p.row.name,
      before: { pricePaise: p.row.pricePaise, mrpPaise: p.row.mrpPaise },
      after: { pricePaise: num(p.patch.pricePaise, p.row.pricePaise) as number, mrpPaise: num(p.patch.mrpPaise, p.row.mrpPaise) },
    }));
    const summary = {
      updated: toUpdate.length,
      missing: ids.length - rows.length,
      mrpRemoved: toUpdate.filter((p) => p.mrpDropped).length,
      skipped: plans.filter((p) => p.skipReason).map((p) => ({ id: p.row.id, name: p.row.name, reason: p.skipReason! })),
      examples,
    };
    if (dto.dryRun) return { ...summary, dryRun: true };

    await this.prisma.$transaction(toUpdate.map((p) => this.prisma.product.update({ where: { id: p.row.id }, data: p.patch })));

    // The search index holds price, featured and publish state.
    if (toUpdate.length > 25) await this.search.reindexAll();
    else await Promise.all(toUpdate.map((p) => this.search.sync(p.row.id)));
    await this.cache.invalidate();

    return { ...summary, dryRun: false };
  }

  async remove(id: string) {
    const hasOrders = await this.prisma.orderItem.count({ where: { productId: id } });
    if (hasOrders) throw new ConflictException("Product has orders; unpublish it instead");
    await this.prisma.product.delete({ where: { id } }).catch((e) => { throw this.mapDbError(e); });
    await this.search.remove(id);
    await this.cache.invalidate();
    return { ok: true };
  }

  async clickReport(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const groups = await this.prisma.affiliateClick.groupBy({
      by: ["productId", "platform"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: groups.map((g) => g.productId) } },
      select: { id: true, name: true, slug: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return groups.map((g) => ({ product: byId.get(g.productId), platform: g.platform, clicks: g._count._all }));
  }

  // Checks a product against the business rules and turns it into what the database stores; throws when it is not valid.
  normalise(dto: ProductDto) {
    const problems = validateProductRules(dto);
    if (problems.length) throw new BadRequestException(problems);
    const videoUrls = [...new Set(dto.videoUrls ?? [])];
    const badVideo = videoUrls.find((u) => !isSupportedVideoUrl(u));
    if (badVideo) throw new BadRequestException(`Unsupported video link: ${badVideo}. Use an https YouTube, Vimeo or .mp4/.webm link.`);
    const isAffiliate = dto.productType === "AFFILIATE";
    return {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      brand: dto.brand ?? null,
      specifications: (dto.specifications ?? {}) as Prisma.InputJsonValue,
      category: { connect: { id: dto.categoryId } },
      productType: dto.productType,
      status: dto.status ?? "DRAFT",
      featured: dto.featured ?? false,
      pricePaise: dto.pricePaise,
      mrpPaise: dto.mrpPaise ?? null,
      sellerName: isAffiliate ? (dto.sellerName?.trim() && dto.sellerName !== "DMG" ? dto.sellerName : dto.platform!) : dto.sellerName?.trim() ?? "",
      deliveryInfo: dto.deliveryInfo ?? null,
      returnPolicy: dto.returnPolicy ?? null,
      gstRatePercent: dto.gstRatePercent ?? 18,
      showRating: dto.showRating ?? true,
      dealLabel: dto.dealLabel?.trim() || null,
      // Delivery and the cart button only apply to our own products.
      deliveryDays: isAffiliate ? null : dto.deliveryDays ?? null,
      freeDelivery: isAffiliate ? false : dto.freeDelivery ?? false,
      showAddToCart: isAffiliate ? false : dto.showAddToCart ?? false,
      sku: isAffiliate ? null : dto.sku,
      stock: isAffiliate ? null : dto.stock,
      costPaise: isAffiliate ? null : dto.costPaise ?? null,
      platform: isAffiliate ? dto.platform : null,
      affiliateUrl: isAffiliate ? dto.affiliateUrl : null,
      affiliateDisclosure: isAffiliate ? dto.affiliateDisclosure ?? DEFAULT_AFFILIATE_DISCLOSURE : null,
      images: { create: dto.images.map((img, position) => ({ url: img.url, alt: img.alt, position })) },
      videoUrls,
      highlights: (dto.highlights ?? []).map((h) => h.trim()).filter(Boolean),
    } satisfies Prisma.ProductCreateInput;
  }

  private mapDbError(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return new ConflictException("Slug or SKU already exists");
      if (e.code === "P2025") return new NotFoundException();
      if (e.code === "P2003" || e.code === "P2018") return new BadRequestException("Invalid category");
    }
    return e;
  }
}
