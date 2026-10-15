import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, RequireVerified, Roles, type JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { CacheService } from "../cache/cache.service";
import { ProductsService, withImages } from "../products/products.service";
import { ReviewDto, TrackViewDto } from "./engagement.dto";

const THIRTY_MIN = 30 * 60 * 1000;

@Controller()
export class EngagementController {
  constructor(private prisma: PrismaService, private products: ProductsService, private cache: CacheService) {}

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
  async reviews(@Param("slug") slug: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new NotFoundException();
    const [items, agg] = await Promise.all([
      this.prisma.review.findMany({ where: { productId: product.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    return {
      average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
      count: agg._count._all,
      items: items.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body, verified: r.verified, createdAt: r.createdAt,
        author: r.user.name.split(" ")[0],
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
    await this.prisma.review.upsert({
      where: { userId_productId: { userId: req.user.sub, productId: product.id } },
      update: data,
      create: { ...data, userId: req.user.sub, productId: product.id },
    });
    await this.cache.invalidate();
    return { ok: true };
  }

  @Get("admin/reviews")
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  adminReviews(@Query("productId") productId?: string) {
    return this.prisma.review.findMany({
      where: productId ? { productId } : undefined,
      include: { user: { select: { name: true, email: true } }, product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Delete("admin/reviews/:id")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles("ADMIN")
  async deleteReview(@Param("id") id: string) {
    await this.prisma.review.deleteMany({ where: { id } });
    await this.cache.invalidate();
  }
}
