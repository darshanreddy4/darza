import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Prisma } from "@prisma/client";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { CacheService } from "../cache/cache.service";
import { applyBrand } from "../site/brand";
import { SiteService } from "../site/site.module";
import { BannerDto, ReorderBannersDto } from "./banner.dto";

function toData(dto: BannerDto) {
  const startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
  const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
  if (startsAt && endsAt && endsAt <= startsAt) throw new BadRequestException("The end date must be after the start date");
  if (dto.showCountdown && !endsAt) throw new BadRequestException("Set a \"Hide after\" date to show a countdown timer");
  return {
    title: dto.title?.trim() ?? "",
    subtitle: dto.subtitle?.trim() || null,
    imageUrl: dto.imageUrl,
    ctaLabel: dto.ctaLabel?.trim() || null,
    linkUrl: dto.linkUrl || null,
    textTone: dto.textTone ?? "LIGHT",
    active: dto.active ?? true,
    startsAt,
    endsAt,
    showCountdown: dto.showCountdown ?? false,
    videoUrl: dto.videoUrl || null,
    sponsorName: dto.sponsorName?.trim() || null,
    textPosition: dto.textPosition ?? "middle-left",
    buttonPosition: dto.buttonPosition || null,
  } satisfies Prisma.BannerUncheckedCreateInput;
}

@Controller()
export class BannersController {
  constructor(private prisma: PrismaService, private cache: CacheService, private site: SiteService) {}

  // Live banners only: switched on and inside their schedule.
  // The switched-on rows are cached; the schedule is checked on every request so banners start and end on time.
  @Get("banners")
  async listPublic() {
    const now = new Date();
    const brand = await this.site.brandName();
    const rows = await this.cache.wrap("banners", {}, 60, () =>
      this.prisma.banner.findMany({
        where: { active: true },
        orderBy: [{ position: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, subtitle: true, imageUrl: true, ctaLabel: true, linkUrl: true, textTone: true, startsAt: true, endsAt: true, showCountdown: true, videoUrl: true, sponsorName: true, textPosition: true, buttonPosition: true },
      }),
    );
    return rows
      .map((b) => ({ ...b, startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null }))
      .filter((b) => (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now))
      // serverNow lets the browser correct for a wrong device clock when counting down.
      .map(({ startsAt, ...b }) => applyBrand({ ...b, endsAt: b.showCountdown ? b.endsAt : null, serverNow: now.toISOString() }, brand));
  }

  @Post("banners/:id/impression")
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async impression(@Param("id") id: string) {
    await this.prisma.banner.updateMany({ where: { id, active: true }, data: { impressionCount: { increment: 1 } } });
  }

  @Post("banners/:id/click")
  @HttpCode(204)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async click(@Param("id") id: string) {
    await this.prisma.banner.updateMany({ where: { id }, data: { clickCount: { increment: 1 } } });
  }

  @Get("admin/banners")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  listAdmin() {
    return this.prisma.banner.findMany({ orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  }

  @Get("admin/banners/:id")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  async get(@Param("id") id: string) {
    const b = await this.prisma.banner.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    return b;
  }

  @Post("admin/banners")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  async create(@Body() dto: BannerDto) {
    const last = await this.prisma.banner.aggregate({ _max: { position: true } });
    const created = await this.prisma.banner.create({ data: { ...toData(dto), position: (last._max.position ?? -1) + 1 } });
    await this.cache.invalidate();
    return created;
  }

  // Persists the admin's drag order: ids in the order they should appear.
  @Put("admin/banners-order")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  async reorder(@Body() dto: ReorderBannersDto) {
    await this.prisma.$transaction(dto.ids.map((id, position) => this.prisma.banner.updateMany({ where: { id }, data: { position } })));
    await this.cache.invalidate();
    return { ok: true };
  }

  @Put("admin/banners/:id")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  async update(@Param("id") id: string, @Body() dto: BannerDto) {
    await this.get(id);
    const updated = await this.prisma.banner.update({ where: { id }, data: toData(dto) });
    await this.cache.invalidate();
    return updated;
  }

  @Delete("admin/banners/:id")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  async remove(@Param("id") id: string) {
    await this.prisma.banner.deleteMany({ where: { id } });
    await this.cache.invalidate();
    return { ok: true };
  }
}
