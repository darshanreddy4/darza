import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Put, UseGuards } from "@nestjs/common";
import type { PolicyPage } from "@prisma/client";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { MAX_CUSTOM_PAGES, isBuiltin, sanitizePage, slugProblem, slugify } from "./pages";

const toDto = (p: PolicyPage) => ({ slug: p.slug, title: p.title, body: p.body, enabled: p.enabled, custom: p.custom, position: p.position, updatedAt: p.updatedAt });

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  // Every page the admin changed or added, without the text: the footer and menus only need to know what exists.
  list() {
    return this.cache.wrap("pages-list", {}, 60, async () => {
      const rows = await this.prisma.policyPage.findMany({ orderBy: { position: "asc" } });
      return { pages: rows.map((p) => ({ slug: p.slug, title: p.title, enabled: p.enabled, custom: p.custom, position: p.position, customText: p.body !== "" })) };
    });
  }

  // One page for a visitor. A built-in page with nothing saved is reported as enabled with no text, so the site shows its standard wording.
  async getPublic(slug: string) {
    const row = await this.cache.wrap("page", { slug }, 60, () => this.prisma.policyPage.findUnique({ where: { slug } }));
    if (!row) {
      if (isBuiltin(slug)) return { slug, title: "", body: "", enabled: true, custom: false, position: 0, updatedAt: null };
      throw new NotFoundException();
    }
    if (row.custom && !row.enabled) throw new NotFoundException();
    return toDto(row);
  }

  async adminList() {
    const rows = await this.prisma.policyPage.findMany({ orderBy: { position: "asc" } });
    return { items: rows.map(toDto) };
  }

  async create(input: unknown) {
    const result = sanitizePage(input, true);
    if ("errors" in result) throw new BadRequestException(result.errors);
    const raw = (input as { slug?: unknown })?.slug;
    const slug = typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : slugify(result.page.title);
    const problem = slugProblem(slug);
    if (problem) throw new BadRequestException(problem);
    if (await this.prisma.policyPage.findUnique({ where: { slug } })) throw new BadRequestException(`A page with the address "${slug}" already exists`);
    const customCount = await this.prisma.policyPage.count({ where: { custom: true } });
    if (customCount >= MAX_CUSTOM_PAGES) throw new BadRequestException(`You can add up to ${MAX_CUSTOM_PAGES} pages`);
    const last = await this.prisma.policyPage.aggregate({ _max: { position: true } });
    const row = await this.prisma.policyPage.create({ data: { slug, ...result.page, custom: true, position: (last._max.position ?? 0) + 1 } });
    await this.cache.invalidate();
    return toDto(row);
  }

  async update(slug: string, input: unknown) {
    if (isBuiltin(slug)) {
      const result = sanitizePage(input, false);
      if ("errors" in result) throw new BadRequestException(result.errors);
      const row = await this.prisma.policyPage.upsert({ where: { slug }, create: { slug, ...result.page, custom: false }, update: result.page });
      await this.cache.invalidate();
      return toDto(row);
    }
    const existing = await this.prisma.policyPage.findUnique({ where: { slug } });
    if (!existing?.custom) throw new NotFoundException();
    const result = sanitizePage(input, true);
    if ("errors" in result) throw new BadRequestException(result.errors);
    const row = await this.prisma.policyPage.update({ where: { slug }, data: result.page });
    await this.cache.invalidate();
    return toDto(row);
  }

  // A custom page is deleted; a built-in page goes back to its standard text and shows again.
  async remove(slug: string) {
    const existing = await this.prisma.policyPage.findUnique({ where: { slug } });
    if (!existing) {
      if (isBuiltin(slug)) return { ok: true };
      throw new NotFoundException();
    }
    await this.prisma.policyPage.delete({ where: { slug } });
    await this.cache.invalidate();
    return { ok: true };
  }
}

@Controller()
export class PagesController {
  constructor(private pages: PagesService) {}

  @Get("pages")
  list() {
    return this.pages.list();
  }

  @Get("pages/:slug")
  one(@Param("slug") slug: string) {
    return this.pages.getPublic(slug);
  }

  @Get("admin/pages")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  adminList() {
    return this.pages.adminList();
  }

  @Post("admin/pages")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  create(@Body() body: unknown) {
    return this.pages.create(body);
  }

  @Put("admin/pages/:id")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.pages.update(id, body);
  }

  @Delete("admin/pages/:id")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.pages.remove(id);
  }
}

@Module({ controllers: [PagesController], providers: [PagesService] })
export class PagesModule {}
