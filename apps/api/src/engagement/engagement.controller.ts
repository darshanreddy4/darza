import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit, RequireVerified, type JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { CacheService } from "../cache/cache.service";
import { ProductsService, withImages } from "../products/products.service";
import { StorageService } from "../storage/storage.service";
import { ReviewDto, TrackViewDto } from "./engagement.dto";
import { reviewerName } from "./reviewer-name";

const THIRTY_MIN = 30 * 60 * 1000;

@Controller()
export class EngagementController {
  constructor(private prisma: PrismaService, private products: ProductsService, private cache: CacheService, private storage: StorageService) {}

  // Counts one view per visitor per product every 30 minutes.
  @Post("track/view")
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async trackView(@Body() dto: TrackViewDto) {
    const product = await this.prisma.product.findFirst({ where: { slug: dto.slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) return;
    const recent = await this.prisma.productView.findFirst({
      where: { productId: product.id, visitorId: dto.visitorId, createdAt: { gte: new Date(Date.now() - THIRTY_MIN) } },
      select: { id: true },
    });
    if (!recent) await this.prisma.productView.create({ data: { productId: product.id, visitorId: dto.visitorId } });
  }

  // ---- wishlist ----

  @Get("wishlist")
  @UseGuards(AuthGuard)
  async wishlist(@Req() req: { user: JwtPayload }) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId: req.user.sub, product: { status: "PUBLISHED" } },
      include: { product: { include: withImages } },
      orderBy: { createdAt: "desc" },
    });
    return this.products.toPublicList(rows.map((r) => r.product));
  }

  @Post("wishlist/:productId")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async addWishlist(@Req() req: { user: JwtPayload }, @Param("productId") productId: string) {
    const exists = await this.prisma.product.findFirst({ where: { id: productId, status: "PUBLISHED" }, select: { id: true } });
    if (!exists) throw new NotFoundException();
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user.sub, productId } },
      update: {},
      create: { userId: req.user.sub, productId },
    });
  }

  @Delete("wishlist/:productId")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async removeWishlist(@Req() req: { user: JwtPayload }, @Param("productId") productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: req.user.sub, productId } });
  }

  // ---- reviews ----

  @Get("products/:slug/reviews")
  async reviews(@Param("slug") slug: string, @Query("page") page?: string, @Query("limit") limit?: string, @Query("sort") sort?: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new NotFoundException();
    const size = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 50));
    const current = Math.max(1, Math.floor(Number(page)) || 1);
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      sort === "highest" ? [{ rating: "desc" }, { createdAt: "desc" }] : sort === "lowest" ? [{ rating: "asc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }];
    const [items, agg, byRating, gallery, mediaCount] = await Promise.all([
      this.prisma.review.findMany({ where: { productId: product.id }, include: { user: { select: { name: true, email: true, phone: true } }, media: { orderBy: { position: "asc" } } }, orderBy, skip: (current - 1) * size, take: size }),
      this.prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.review.groupBy({ by: ["rating"], where: { productId: product.id }, _count: { _all: true } }),
      this.prisma.reviewMedia.findMany({ where: { review: { productId: product.id } }, orderBy: [{ review: { createdAt: "desc" } }, { position: "asc" }], take: 12, select: { id: true, type: true, url: true } }),
      this.prisma.reviewMedia.count({ where: { review: { productId: product.id } } }),
    ]);
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of byRating) breakdown[g.rating] = g._count._all;
    return {
      average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      count: agg._count._all,
      page: current,
      pages: Math.max(1, Math.ceil(agg._count._all / size)),
      breakdown,
      // Pictures and videos from all reviews, newest first, for the strip above the reviews.
      gallery, mediaCount,
      items: items.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body, verified: r.verified, createdAt: r.createdAt,
        author: reviewerName(r.user),
        media: r.media.map((m) => ({ id: m.id, type: m.type, url: m.url })),
      })),
    };
  }

  @Post("products/:slug/reviews")
  @UseGuards(AuthGuard)
  @RequireVerified()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async submitReview(@Req() req: { user: JwtPayload }, @Param("slug") slug: string, @Body() dto: ReviewDto) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new NotFoundException();
    const verified = (await this.prisma.orderItem.count({
      where: { productId: product.id, order: { userId: req.user.sub, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } } },
    })) > 0;
    const data = { rating: dto.rating, title: dto.title?.trim() || null, body: dto.body.trim(), verified };

    // Only pictures and videos uploaded here: up to 5 photos and 1 video, each of the right kind and really stored.
    const media = dto.media;
    if (media) {
      const photoExt = /\.(webp|jpg|png)$/, videoExt = /\.(mp4|webm)$/;
      if (media.some((m) => (m.type === "IMAGE" ? !photoExt.test(m.url) : !videoExt.test(m.url)))) throw new BadRequestException("A picture or video does not match its type.");
      if (media.filter((m) => m.type === "IMAGE").length > 5) throw new BadRequestException("Add up to 5 photos.");
      if (media.filter((m) => m.type === "VIDEO").length > 1) throw new BadRequestException("Add one video at most.");
      if (new Set(media.map((m) => m.url)).size !== media.length) throw new BadRequestException("Each picture or video can only be added once.");
      for (const m of media) if (!(await this.storage.get(m.url.replace("/uploads/", "")))) throw new BadRequestException("One of the files could not be found. Upload it again.");
    }
    const files = media ? { deleteMany: {}, create: media.map((m, position) => ({ type: m.type, url: m.url, position })) } : undefined;
    await this.prisma.review.upsert({
      where: { userId_productId: { userId: req.user.sub, productId: product.id } },
      update: { ...data, ...(files && { media: files }) },
      create: { ...data, userId: req.user.sub, productId: product.id, ...(files && { media: { create: files.create } }) },
    });
    await this.cache.invalidate();
    return { ok: true };
  }

  @Get("admin/reviews")
  @UseGuards(AuthGuard)
  @Permit("reviews.moderate")
  adminReviews(@Query("productId") productId?: string) {
    return this.prisma.review.findMany({
      where: productId ? { productId } : undefined,
      include: { user: { select: { name: true, email: true } }, product: { select: { name: true } }, media: { select: { id: true, type: true, url: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Delete("admin/reviews/:id")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Permit("reviews.moderate")
  async deleteReview(@Param("id") id: string) {
    await this.prisma.review.deleteMany({ where: { id } });
    await this.cache.invalidate();
  }
}
