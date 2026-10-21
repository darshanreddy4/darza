import { BadRequestException, Body, Controller, DefaultValuePipe, Delete, Get, Headers, Ip, Param, ParseBoolPipe, ParseIntPipe, Post, Put, Query, Redirect, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit, type JwtPayload } from "../auth/auth.guard";
import { hasPermission, withoutCost } from "../auth/permissions";
import { keepCosts } from "./cost-guard";
import { parseAdminProductQuery } from "./admin-query";
import { BulkUpdateProductsDto } from "./bulk-update.dto";
import { ProductDto } from "./product.dto";
import { ProductImportService } from "./product-import.service";
import { ProductsService } from "./products.service";

@Controller()
export class ProductsController {
  constructor(private products: ProductsService, private imports: ProductImportService) {}

  @Get("products")
  list(
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("type") type?: string,
    @Query("featured", new DefaultValuePipe(false), ParseBoolPipe) featured?: boolean,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("limit", new DefaultValuePipe(24), ParseIntPipe) limit = 24,
  ) {
    return this.products.listPublic({
      q: q?.slice(0, 100),
      category,
      type: type === "OWN" || type === "AFFILIATE" ? type : undefined,
      featured,
      page: Math.max(1, page),
      limit: Math.min(60, Math.max(1, limit)),
    });
  }

  @Get("sitemap")
  sitemap() {
    return this.products.sitemap();
  }

  @Get("products/by-ids")
  byIds(@Query("ids") ids = "") {
    const list = [...new Set(ids.split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{10,40}$/.test(s)))].slice(0, 16);
    return list.length ? this.products.byIds(list) : [];
  }

  @Get("products/:slug/related")
  related(@Param("slug") slug: string) {
    return this.products.related(slug);
  }

  @Get("products/:slug")
  get(@Param("slug") slug: string) {
    return this.products.getPublic(slug);
  }

  // Tracked redirect to the external seller.
  @Get("go/:slug")
  @Redirect()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async go(@Param("slug") slug: string, @Ip() ip: string, @Headers("user-agent") userAgent?: string, @Headers("referer") referrer?: string) {
    const url = await this.products.resolveAffiliateRedirect(slug, { ip, userAgent, referrer });
    return { url, statusCode: 302 };
  }

  @Get("admin/products")
  // The home page editor looks products up too, so it may list them (without costs, unless allowed).
  @UseGuards(AuthGuard) @Permit("products.view", "content.manage")
  async listAdmin(@Req() req: { user: JwtPayload }, @Query() query: Record<string, string | undefined>) {
    const rows = await this.products.listAdmin(parseAdminProductQuery(query));
    return rows.map((p) => withoutCost(req.user.permissions, p));
  }

  @Post("admin/products/bulk")
  @UseGuards(AuthGuard) @Permit("products.edit")
  bulkUpdate(@Req() req: { user: JwtPayload }, @Body() dto: BulkUpdateProductsDto) {
    return this.products.bulkUpdate(dto, req.user.sub);
  }

  @Get("admin/products/export")
  @UseGuards(AuthGuard) @Permit("products.edit")
  async exportCsv(@Req() req: { user: JwtPayload }, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`);
    return this.imports.exportCsv(hasPermission(req.user.permissions, "costs.view"));
  }

  // The body is the CSV text itself (Content-Type: text/csv). ?dryRun=true only checks it.
  @Post("admin/products/import")
  @UseGuards(AuthGuard) @Permit("products.edit")
  importCsv(@Req() req: { user: JwtPayload }, @Body() csv: unknown, @Query("dryRun") dryRun?: string) {
    if (typeof csv !== "string" || csv.trim() === "") throw new BadRequestException("Send the CSV file as text/csv.");
    return this.imports.importCsv(csv, dryRun === "true", hasPermission(req.user.permissions, "costs.view"), req.user.sub);
  }

  @Get("admin/products/:id")
  @UseGuards(AuthGuard) @Permit("products.view")
  async getAdmin(@Req() req: { user: JwtPayload }, @Param("id") id: string) {
    return withoutCost(req.user.permissions, await this.products.getAdmin(id));
  }

  @Post("admin/products")
  @UseGuards(AuthGuard) @Permit("products.edit")
  create(@Req() req: { user: JwtPayload }, @Body() dto: ProductDto) {
    return this.products.create(hasPermission(req.user.permissions, "costs.view") ? dto : keepCosts(dto, null), req.user.sub);
  }

  @Put("admin/products/:id")
  @UseGuards(AuthGuard) @Permit("products.edit")
  async update(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: ProductDto) {
    // Without the cost permission the form never saw the costs, so the saved ones stay as they are.
    return this.products.update(id, hasPermission(req.user.permissions, "costs.view") ? dto : keepCosts(dto, await this.products.getAdmin(id)), req.user.sub);
  }

  @Delete("admin/products/:id")
  @UseGuards(AuthGuard) @Permit("products.edit")
  remove(@Param("id") id: string) {
    return this.products.remove(id);
  }

  @Get("admin/reports/clicks")
  @UseGuards(AuthGuard) @Permit("analytics.view")
  clicks(@Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.products.clickReport(Math.min(365, Math.max(1, days)));
  }
}
