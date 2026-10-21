import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validateSync, type ValidationError } from "class-validator";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { SearchService } from "../search/search.service";
import { recordDifferences, snapshotStock } from "../inventory/ledger";
import { ProductDto } from "./product.dto";
import { MAX_IMPORT_ROWS, PRODUCT_COLUMNS, productsToCsv, readProductSheet, rowChanges, type ParsedOption } from "./product-csv";
import { ProductsService, withImages, type ProductWithImages } from "./products.service";

export interface ImportReport {
  dryRun: boolean;
  rows: number;
  created: number;
  updated: number;
  // Nothing is saved while there are errors.
  errors: { row: number; slug: string; message: string }[];
  applied: boolean;
}

const messages = (errors: ValidationError[], prefix = ""): string[] =>
  errors.flatMap((e) => [...Object.values(e.constraints ?? {}).map((m) => `${prefix}${m}`), ...messages(e.children ?? [], `${prefix}${e.property} `)]);

// The product as the import sees it, so cells left blank keep their current value.
function toDto(p: ProductWithImages): Record<string, unknown> {
  return {
    name: p.name, slug: p.slug, description: p.description, brand: p.brand ?? undefined, specifications: p.specifications, categoryId: p.categoryId, productType: p.productType,
    status: p.status, featured: p.featured, pricePaise: p.pricePaise, mrpPaise: p.mrpPaise ?? undefined, sellerName: p.sellerName, deliveryInfo: p.deliveryInfo ?? undefined,
    returnPolicy: p.returnPolicy ?? undefined, showRating: p.showRating, dealLabel: p.dealLabel ?? undefined, deliveryDays: p.deliveryDays ?? undefined, freeDelivery: p.freeDelivery, chargeDelivery: p.chargeDelivery, deliveryFeePaise: p.deliveryFeePaise ?? undefined,
    showAddToCart: p.showAddToCart, packSize: p.packSize ?? undefined, salePricePaise: p.salePricePaise ?? undefined, returnDays: p.returnDays ?? undefined, saleEndsAt: p.saleEndsAt?.toISOString(), variantGroup: p.variantGroup ?? undefined, colorName: p.colorName ?? undefined, warranty: p.warranty ?? undefined, manufacturerInfo: p.manufacturerInfo ?? undefined, saleTag: p.saleTag ?? undefined, showSold: p.showSold, multiBuyQty: p.multiBuyQty ?? undefined, multiBuyPercent: p.multiBuyPercent ?? undefined,
    gstRatePercent: p.gstRatePercent, hsnCode: p.hsnCode ?? undefined, onlineOnly: p.onlineOnly, advancePercent: p.advancePercent ?? undefined, sku: p.sku ?? undefined, stock: p.stock ?? undefined, costPaise: p.costPaise ?? undefined, weightGrams: p.weightGrams ?? undefined,
    platform: p.platform ?? undefined, affiliateUrl: p.affiliateUrl ?? undefined, affiliateDisclosure: p.affiliateDisclosure ?? undefined,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? undefined })), videoUrls: p.videoUrls, highlights: p.highlights,
    // Kept as they are, so a product with options keeps the price and stock worked out from them.
    options: p.options.map((o) => ({ id: o.id, label: o.label, values: o.values, imageUrl: o.imageUrl ?? undefined, pricePaise: o.pricePaise, mrpPaise: o.mrpPaise ?? undefined, stock: o.stock, costPaise: o.costPaise ?? undefined, sku: o.sku ?? undefined, weightGrams: o.weightGrams ?? undefined })),
    optionNames: p.optionNames,
  };
}

@Injectable()
export class ProductImportService {
  constructor(private prisma: PrismaService, private products: ProductsService, private search: SearchService, private cache: CacheService) {}

  async exportCsv(withCosts = true) {
    const rows = await this.prisma.product.findMany({ include: { ...withImages, category: { select: { slug: true } } }, orderBy: { createdAt: "asc" }, take: 20_000 });
    // Cost prices are left blank for people who may not see them.
    return "\uFEFF" + productsToCsv(withCosts ? rows : rows.map((r) => ({ ...r, costPaise: null, options: r.options.map((o) => ({ ...o, costPaise: null })) })));
  }

  async importCsv(csv: string, dryRun: boolean, canSetCosts = true, actorId?: string): Promise<ImportReport> {
    const { header, records } = readProductSheet(csv);
    if (!header.includes("slug")) throw new BadRequestException(`The first row must be a header that includes a "slug" column. Known columns: ${PRODUCT_COLUMNS.join(", ")}.`);
    const unknown = header.filter((h) => h && !(PRODUCT_COLUMNS as readonly string[]).includes(h));
    if (unknown.length) throw new BadRequestException(`Unknown column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Known columns: ${PRODUCT_COLUMNS.join(", ")}.`);
    if (records.length === 0) throw new BadRequestException("The file has no product rows.");
    if (records.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Import up to ${MAX_IMPORT_ROWS} products at a time.`);

    const [categories, existing, others] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, slug: true, name: true } }),
      this.prisma.product.findMany({ where: { slug: { in: records.map((r) => (r.cells.slug ?? "").toLowerCase()).filter(Boolean) } }, include: withImages }),
      this.prisma.product.findMany({ where: { sku: { not: null } }, select: { slug: true, sku: true } }),
    ]);
    const bySlug = new Map(existing.map((p) => [p.slug, p]));
    const category = (ref: string) => categories.find((c) => c.slug === ref.toLowerCase()) ?? categories.find((c) => c.name.toLowerCase() === ref.toLowerCase());

    const errors: ImportReport["errors"] = [];
    const plans: { slug: string; existing?: ProductWithImages; data: ReturnType<ProductsService["normalise"]>; dto: ProductDto }[] = [];
    const seen = new Set<string>();
    // SKU -> slug for the whole catalogue after the import, to catch clashes before the database does.
    const skuOwner = new Map(others.map((o) => [o.sku!, o.slug]));

    for (const rec of records) {
      const change = rowChanges(rec.cells);
      const fail = (message: string) => errors.push({ row: rec.line, slug: change.slug, message });
      change.errors.forEach(fail);
      if (change.errors.length) continue;
      if (seen.has(change.slug)) { fail("this slug appears more than once in the file"); continue; }
      seen.add(change.slug);

      const current = bySlug.get(change.slug);
      const merged: Record<string, unknown> = { ...(current ? toDto(current) : { images: [] }), ...change.values, slug: change.slug };
      if (current && merged.productType !== current.productType) { fail("the type of an existing product cannot be changed"); continue; }
      if (change.categoryRef) {
        const found = category(change.categoryRef);
        if (!found) { fail(`category "${change.categoryRef}" does not exist; use the slug of an existing category`); continue; }
        merged.categoryId = found.id;
      }
      if (!current) {
        const missing = (["name", "type", "category", "price", "description"] as const).filter((c) => !rec.cells[c]);
        if (missing.length) { fail(`new products need ${missing.join(", ")}`); continue; }
      }

      if (current && Array.isArray(change.values.options) && change.values.options.length > 0) {
        // Options named again in the sheet stay the same options (so carts and orders keep pointing at them), with their picture.
        merged.options = (change.values.options as ParsedOption[]).map((o) => {
          const old = current.options.find((x) => x.label.toLowerCase() === o.values.join(" / ").toLowerCase());
          return { ...o, id: old?.id, imageUrl: old?.imageUrl ?? undefined, costPaise: o.costPaise ?? old?.costPaise ?? undefined, sku: o.sku ?? old?.sku ?? undefined, weightGrams: o.weightGrams ?? old?.weightGrams ?? undefined };
        });
      }

      if (!canSetCosts) {
        // Costs typed into the sheet are ignored for people who may not see them; what is on file stays.
        merged.costPaise = current?.costPaise ?? undefined;
        if (Array.isArray(merged.options)) merged.options = (merged.options as { id?: string }[]).map((o) => ({ ...o, costPaise: current?.options.find((x) => x.id === o.id)?.costPaise ?? undefined }));
      }

      const problems = messages(validateSync(plainToInstance(ProductDto, merged), { forbidUnknownValues: false }));
      if (problems.length) { problems.forEach(fail); continue; }
      try {
        const dto = plainToInstance(ProductDto, merged);
        const data = this.products.normalise(dto);
        const sku = (merged.sku as string | undefined) ?? undefined;
        if (current?.sku && current.sku !== sku) skuOwner.delete(current.sku);
        if (sku) {
          const owner = skuOwner.get(sku);
          if (owner && owner !== change.slug) { fail(`SKU ${sku} is already used by ${owner}`); continue; }
          skuOwner.set(sku, change.slug);
        }
        plans.push({ slug: change.slug, existing: current, data, dto });
      } catch (e) {
        const detail = e instanceof BadRequestException ? e.getResponse() : null;
        const list = typeof detail === "object" && detail && "message" in detail ? [(detail as { message: string | string[] }).message].flat() : [(e as Error).message];
        list.forEach(fail);
      }
    }

    const created = plans.filter((p) => !p.existing).length;
    const report: ImportReport = { dryRun, rows: records.length, created, updated: plans.length - created, errors, applied: false };
    if (dryRun || errors.length) return report;

    const saved = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      const before = await snapshotStock(tx, plans.flatMap((p) => (p.existing ? [p.existing.id] : [])));
      for (const p of plans) {
        await this.products.assertProductSkuFree(tx, p.existing?.id ?? null, p.dto.sku);
        if (p.existing) {
          const { images, ...rest } = p.data;
          await tx.product.update({ where: { id: p.existing.id }, data: { ...rest, images: { deleteMany: {}, create: images.create } } });
          await this.products.saveOptions(tx, p.existing.id, p.existing.options.map((o) => o.id), p.dto);
          ids.push(p.existing.id);
        } else {
          const made = await tx.product.create({ data: p.data as Prisma.ProductCreateInput });
          await this.products.saveOptions(tx, made.id, [], p.dto);
          ids.push(made.id);
        }
      }
      await recordDifferences(tx, before, await snapshotStock(tx, ids), { reason: "IMPORT", note: "CSV import", actorId });
      return ids;
    }, { timeout: 60_000 });

    if (saved.length > 25) await this.search.reindexAll();
    else await Promise.all(saved.map((id) => this.search.sync(id)));
    await this.cache.invalidate();
    return { ...report, applied: true };
  }
}
