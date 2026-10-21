import { BadRequestException, Body, Controller, Get, Global, Injectable, Module, Post, Put, UseGuards } from "@nestjs/common";
import { randomBytes } from "crypto";
import sharp from "sharp";
import type { Prisma, SiteProfile } from "@prisma/client";
import { AuthGuard, Permit } from "../auth/auth.guard";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage/storage.service";
import { removeBackground } from "./logo-background";
import { webOrigins } from "../auth/session-cookie";
import { DEFAULT_BRAND } from "./brand";
import { DEFAULT_LOGO_DESIGN, sanitizeLogoDesign } from "./logo-design";
import { EMPTY_PROFILE, sanitizeProfile, type OtherLink, type SiteProfileData } from "./profile";

@Injectable()
export class SiteService {
  constructor(private prisma: PrismaService, private cache: CacheService, private storage: StorageService) {}

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
    const data = { ...p, logoDesign: p.logoDesign as unknown as Prisma.InputJsonValue, socials: p.socials as Prisma.InputJsonValue, otherLinks: p.otherLinks as unknown as Prisma.InputJsonValue };
    await this.prisma.siteProfile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    await this.cache.invalidate();
    return p;
  }

  // Saves a copy of an uploaded logo with its plain background turned transparent and returns the new picture's address.
  async transparentLogo(body: { url?: unknown; strength?: unknown }) {
    const match = typeof body?.url === "string" ? /^\/uploads\/([a-f0-9]{32}\.(?:png|jpg|webp|gif))$/.exec(body.url) : null;
    if (!match) throw new BadRequestException("Upload the logo from your computer first; only uploaded pictures can be cleaned up.");
    const tolerance = { low: 30, medium: 55, high: 85 }[String(body.strength ?? "medium")] ?? 55;
    const original = await this.storage.get(match[1]);
    if (!original) throw new BadRequestException("That logo could not be found. Upload it again.");

    const { data, info } = await sharp(original).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const cleared = removeBackground({ data: pixels, width: info.width, height: info.height }, tolerance);
    if (cleared === 0) throw new BadRequestException("No plain background was found around the logo, or it is already transparent.");

    const png = await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const name = `${randomBytes(16).toString("hex")}.png`;
    await this.storage.put(name, png, "image/png");
    return { url: `/uploads/${name}` };
  }
}

// A stored design that no longer validates falls back to the default instead of breaking the storefront.
function storedDesign(v: unknown) {
  const d = sanitizeLogoDesign(v);
  return "design" in d ? d.design : DEFAULT_LOGO_DESIGN;
}

function toData(r: SiteProfile): SiteProfileData {
  return {
    brandName: r.brandName, siteUrl: r.siteUrl, logoUrl: r.logoUrl, logoOnBadge: r.logoOnBadge, logoDesign: storedDesign(r.logoDesign), tagline: r.tagline,
    legalName: r.legalName, gstin: r.gstin, grievanceOfficer: r.grievanceOfficer, grievanceEmail: r.grievanceEmail,
    announcement: r.announcement, announcementOn: r.announcementOn, transparencyNote: r.transparencyNote, transparencyOn: r.transparencyOn, about: r.about,
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
  @UseGuards(AuthGuard) @Permit("brand.manage")
  get() {
    return this.site.get();
  }

  @Post("admin/site-profile/transparent-logo")
  @UseGuards(AuthGuard) @Permit("brand.manage")
  transparentLogo(@Body() body: { url?: unknown; strength?: unknown }) {
    return this.site.transparentLogo(body);
  }

  @Put("admin/site-profile")
  @UseGuards(AuthGuard) @Permit("brand.manage")
  save(@Body() body: unknown) {
    return this.site.save(body);
  }
}

@Global()
@Module({ controllers: [SiteController], providers: [SiteService], exports: [SiteService] })
export class SiteModule {}
