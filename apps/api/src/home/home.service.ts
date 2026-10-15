import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { applyBrand } from "../site/brand";
import { SiteService } from "../site/site.module";
import { ProductsService } from "../products/products.service";
import { DEFAULT_LAYOUT, sanitizeLayout, type Widget, type WidgetType } from "./widgets";

const NOT_SOLD = ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] as const;

@Injectable()
export class HomeService {
  constructor(private prisma: PrismaService, private products: ProductsService, private cache: CacheService, private site: SiteService) {}

  // Every widget, switched on or off, as the admin sees it.
  async layout(): Promise<{ widgets: Widget[]; isDefault: boolean }> {
    const rows = await this.prisma.homeWidget.findMany({ orderBy: { position: "asc" } });
    if (rows.length === 0) return { widgets: DEFAULT_LAYOUT, isDefault: true };
    return {
      isDefault: false,
      widgets: rows.map((r) => ({ id: r.id, type: r.type as WidgetType, active: r.active, config: r.config as Record<string, unknown> })),
    };
  }

  async save(input: unknown) {
    if (Array.isArray(input) && input.length === 0) throw new BadRequestException("Add at least one widget, or reset the page to the default layout");
    const result = sanitizeLayout(input);
    if ("errors" in result) throw new BadRequestException(result.errors);
    await this.prisma.$transaction([
      this.prisma.homeWidget.deleteMany(),
      this.prisma.homeWidget.createMany({
        data: result.widgets.map((w, position) => ({ id: w.id, type: w.type, position, active: w.active, config: w.config as Prisma.InputJsonValue })),
      }),
    ]);
    await this.cache.invalidate();
    return this.layout();
  }

  async reset() {
    await this.prisma.homeWidget.deleteMany();
    await this.cache.invalidate();
    return this.layout();
  }

  // The live page: switched-on widgets, with the products each collection shows already looked up.
  publicLayout() {
    return this.cache.wrap("home", {}, 60, async () => {
      const { widgets } = await this.layout();
      const live = widgets.filter((w) => w.active);
      const brand = await this.site.brandName();
      return applyBrand({
        widgets: await Promise.all(live.map(async (w) => ((w.type === "products" || w.type === "product-slider") ? { ...w, products: await this.collection(w.config) } : w))),
      }, brand);
    });
  }

  private async collection(config: Record<string, unknown>) {
    const limit = Number(config.limit) || 4;
    const source = config.source as string;
    switch (source) {
      case "featured": return (await this.products.listPublic({ featured: true, page: 1, limit })).items;
      case "own": return (await this.products.listPublic({ type: "OWN", page: 1, limit })).items;
      case "affiliate": return (await this.products.listPublic({ type: "AFFILIATE", page: 1, limit })).items;
      case "new": return (await this.products.listPublic({ page: 1, limit })).items;
      case "category": return (await this.products.listPublic({ category: String(config.category), page: 1, limit })).items;
      case "bestselling": {
        const rows = await this.prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { status: { notIn: [...NOT_SOLD] } }, product: { status: "PUBLISHED" } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: limit,
        });
        return rows.length ? this.products.byIds(rows.map((r) => r.productId)) : [];
      }
      case "toprated": {
        const rows = await this.prisma.review.groupBy({
          by: ["productId"],
          where: { product: { status: "PUBLISHED" } },
          _avg: { rating: true },
          _count: { _all: true },
          orderBy: [{ _avg: { rating: "desc" } }, { _count: { rating: "desc" } }],
          take: limit,
        });
        return rows.length ? this.products.byIds(rows.map((r) => r.productId)) : [];
      }
      case "picks": {
        const slugs = (config.picks as string[]) ?? [];
        const found = await this.prisma.product.findMany({ where: { slug: { in: slugs }, status: "PUBLISHED" }, select: { id: true, slug: true } });
        const bySlug = new Map(found.map((p) => [p.slug, p.id]));
        const ids = slugs.map((s) => bySlug.get(s)).filter((id): id is string => !!id);
        return ids.length ? this.products.byIds(ids) : [];
      }
      default: return [];
    }
  }
}
