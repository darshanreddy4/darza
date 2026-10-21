import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { SearchService } from "./search.service";

@Controller()
export class SearchController {
  constructor(private search: SearchService, private prisma: PrismaService) {}

  // Typeahead for the header search box.
  @Get("search/suggest")
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async suggest(@Query("q") raw = "") {
    const q = raw.trim().slice(0, 80);
    if (q.length < 2) return { items: [] };

    const hits = await this.search.suggest(q);
    if (hits) {
      return { items: hits.map((h) => ({ name: h.name, slug: h.slug, image: h.image, pricePaise: h.pricePaise, category: h.categoryName })) };
    }
    const rows = await this.prisma.product.findMany({
      where: { status: "PUBLISHED", name: { contains: q, mode: "insensitive" } },
      select: { name: true, slug: true, pricePaise: true, category: { select: { name: true } }, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
      take: 6,
    });
    return { items: rows.map((r) => ({ name: r.name, slug: r.slug, image: r.images[0]?.url ?? null, pricePaise: r.pricePaise, category: r.category.name })) };
  }

  @Get("admin/search/status")
  @UseGuards(AuthGuard)
  @Permit("settings.manage")
  status() {
    return this.search.status();
  }

  @Post("admin/search/reindex")
  @UseGuards(AuthGuard)
  @Permit("settings.manage")
  reindex() {
    return this.search.reindexAll();
  }
}
