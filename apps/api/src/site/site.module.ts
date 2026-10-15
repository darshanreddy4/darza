import { BadRequestException, Body, Controller, Get, Global, Injectable, Module, Put, UseGuards } from "@nestjs/common";
import type { Prisma, SiteProfile } from "@prisma/client";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { webOrigins } from "../auth/session-cookie";
import { DEFAULT_BRAND } from "./brand";
import { EMPTY_PROFILE, sanitizeProfile, type OtherLink, type SiteProfileData } from "./profile";

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  async get(): Promise<SiteProfileData> {
    const row = await this.prisma.siteProfile.findUnique({ where: { id: "default" } });
    return row ? toData(row) : EMPTY_PROFILE;
  }

  // Shown to every visitor, so it is cached like the rest of the storefront.
  publicProfile() {
    return this.cache.wrap("site-profile", {}, 60, () => this.get());
  }

  // The name shown to customers: what the admin set, else the BRAND_NAME setting, else "DMG".
  async brandName() {
    return (await this.publicProfile()).brandName || DEFAULT_BRAND;
  }

  // Where links in emails point: the admin's website address, else the first configured WEB_ORIGIN.
  async webOrigin() {
    return (await this.publicProfile()).siteUrl || webOrigins()[0];
  }

  async save(input: unknown) {
    const result = sanitizeProfile(input);
    if ("errors" in result) throw new BadRequestException(result.errors);
    const p = result.profile;
    const data = { ...p, socials: p.socials as Prisma.InputJsonValue, otherLinks: p.otherLinks as unknown as Prisma.InputJsonValue };
    await this.prisma.siteProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    await this.cache.invalidate();
    return p;
  }
}

function toData(r: SiteProfile): SiteProfileData {
  return {
    brandName: r.brandName, siteUrl: r.siteUrl, logoUrl: r.logoUrl, logoOnBadge: r.logoOnBadge, tagline: r.tagline, about: r.about,
    email: r.email, phone: r.phone, address: r.address, careHours: r.careHours, careNote: r.careNote,
    whatsapp: r.whatsapp, whatsappMessage: r.whatsappMessage, whatsappButton: r.whatsappButton,
    socials: r.socials as SiteProfileData["socials"], otherLinks: r.otherLinks as unknown as OtherLink[],
  };
}

@Controller()
export class SiteController {
  constructor(private site: SiteService) {}

  @Get("site")
  publicProfile() {
    return this.site.publicProfile();
  }

  @Get("admin/site-profile")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  get() {
    return this.site.get();
  }

  @Put("admin/site-profile")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  save(@Body() body: unknown) {
    return this.site.save(body);
  }
}

@Global()
@Module({ controllers: [SiteController], providers: [SiteService], exports: [SiteService] })
export class SiteModule {}
