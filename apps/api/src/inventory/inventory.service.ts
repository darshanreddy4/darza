import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type StockReason } from "@prisma/client";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { readItem, writeMovement } from "./ledger";
import { itemKey, mainQuantity } from "./ledger-rules";
import type { AdjustStockDto, ReceiveStockDto, TransferStockDto, WarehouseDto } from "./inventory.dto";

type Tx = Prisma.TransactionClient;
const PAGE_SIZE = 50;

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  // Every warehouse with the units it holds; the main one holds what the others do not.
  async warehouses() {
    const [list, held, plain, optioned] = await Promise.all([
      this.prisma.warehouse.findMany({ orderBy: [{ isMain: "desc" }, { name: "asc" }] }),
      this.prisma.warehouseStock.groupBy({ by: ["warehouseId"], _sum: { quantity: true } }),
      this.prisma.product.aggregate({ _sum: { stock: true }, where: { productType: "OWN", options: { none: {} } } }),
      this.prisma.productOption.aggregate({ _sum: { stock: true }, where: { product: { productType: "OWN" } } }),
    ]);
    const heldBy = new Map(held.map((h) => [h.warehouseId, h._sum.quantity ?? 0]));
    const total = (plain._sum.stock ?? 0) + (optioned._sum.stock ?? 0);
    return list.map((w) => ({ ...w, units: w.isMain ? mainQuantity(total, [...heldBy.values()]) : heldBy.get(w.id) ?? 0 }));
  }

  async createWarehouse(dto: WarehouseDto) {
    try {
      return await this.prisma.warehouse.create({ data: { name: dto.name.trim(), code: dto.code.toUpperCase(), address: dto.address?.trim() || null } });
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  async updateWarehouse(id: string, dto: WarehouseDto) {
    const w = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!w) throw new NotFoundException();
    const active = dto.active ?? w.active;
    if (!active && w.isMain) throw new BadRequestException("The main warehouse cannot be switched off.");
    if (!active && w.active) {
      const held = await this.prisma.warehouseStock.aggregate({ _sum: { quantity: true }, where: { warehouseId: id } });
      if ((held._sum.quantity ?? 0) > 0) throw new ConflictException("This warehouse still holds stock. Move it to another warehouse first.");
    }
    try {
      return await this.prisma.warehouse.update({ where: { id }, data: { name: dto.name.trim(), code: dto.code.toUpperCase(), address: dto.address?.trim() || null, active } });
    } catch (e) {
      throw this.mapDuplicate(e);
    }
  }

  async removeWarehouse(id: string) {
    const w = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!w) throw new NotFoundException();
    if (w.isMain) throw new BadRequestException("The main warehouse cannot be deleted.");
    const [held, moves] = await Promise.all([
      this.prisma.warehouseStock.aggregate({ _sum: { quantity: true }, where: { warehouseId: id } }),
      this.prisma.stockMovement.count({ where: { warehouseId: id } }),
    ]);
    if ((held._sum.quantity ?? 0) > 0) throw new ConflictException("This warehouse still holds stock. Move it to another warehouse first.");
    if (moves > 0) throw new ConflictException("This warehouse has stock history. Switch it off instead of deleting it.");
    await this.prisma.warehouse.delete({ where: { id } });
    return { ok: true };
  }

  // Units of a product (each option separately) in every warehouse.
  async levels(productId: string) {
    const [product, warehouses, rows] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, sku: true, productType: true, stock: true, options: { orderBy: { position: "asc" }, select: { id: true, label: true, stock: true } } } }),
      this.prisma.warehouse.findMany({ where: { active: true }, orderBy: [{ isMain: "desc" }, { name: "asc" }], select: { id: true, name: true, code: true, isMain: true } }),
      this.prisma.warehouseStock.findMany({ where: { productId, quantity: { gt: 0 } } }),
    ]);
    if (!product) throw new NotFoundException();
    const items = product.options.length
      ? product.options.map((o) => ({ optionId: o.id as string | null, label: o.label as string | null, total: o.stock }))
      : [{ optionId: null, label: null, total: product.stock ?? 0 }];
    return {
      product: { id: product.id, name: product.name, sku: product.sku, tracked: product.productType === "OWN" },
      warehouses,
      items: items.map((it) => {
        const held = rows.filter((r) => r.itemKey === itemKey(it.optionId));
        const heldIn = new Map(held.map((r) => [r.warehouseId, r.quantity]));
        return { ...it, byWarehouse: warehouses.map((w) => ({ warehouseId: w.id, quantity: w.isMain ? mainQuantity(it.total, held.map((r) => r.quantity)) : heldIn.get(w.id) ?? 0 })) };
      }),
    };
  }

  async movements(q: { productId?: string; warehouseId?: string; reason?: StockReason }, page: number) {
    const where: Prisma.StockMovementWhereInput = { ...(q.productId && { productId: q.productId }), ...(q.warehouseId && { warehouseId: q.warehouseId }), ...(q.reason && { reason: q.reason }) };
    const safe = Math.max(1, page);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (safe - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { warehouse: { select: { name: true, code: true } } } }),
    ]);
    return { total, page: safe, pageSize: PAGE_SIZE, items };
  }

  // New units arrive in a warehouse (a delivery from the supplier).
  async receive(dto: ReceiveStockDto, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const item = await this.target(tx, dto.productId, dto.optionId);
      const wh = await this.warehouse(tx, dto.warehouseId);
      await this.addToTotal(tx, item, dto.quantity);
      if (!wh.isMain) await this.addToShelf(tx, wh.id, item, dto.quantity);
      await this.log(tx, item, wh.id, dto.quantity, "RECEIVED", dto.note, actorId);
    });
    await this.cache.invalidate();
    return { ok: true };
  }

  // A count that did not match: units found, lost or damaged in one warehouse.
  async adjust(dto: AdjustStockDto, actorId: string) {
    if (dto.delta === 0) throw new BadRequestException("Enter how many units to add or take away.");
    if (!dto.note?.trim()) throw new BadRequestException("Say why the count changed, for example damaged in the warehouse or found in a recount.");
    await this.prisma.$transaction(async (tx) => {
      const item = await this.target(tx, dto.productId, dto.optionId);
      const wh = await this.warehouse(tx, dto.warehouseId);
      if (dto.delta < 0) {
        const have = await this.held(tx, wh, item);
        if (-dto.delta > have) throw new BadRequestException(`Only ${have} ${have === 1 ? "unit is" : "units are"} in ${wh.name}.`);
      }
      await this.addToTotal(tx, item, dto.delta);
      if (!wh.isMain) await this.addToShelf(tx, wh.id, item, dto.delta);
      await this.log(tx, item, wh.id, dto.delta, "ADJUSTMENT", dto.note, actorId);
    });
    await this.cache.invalidate();
    return { ok: true };
  }

  // Units move from one warehouse to another; the total on sale stays the same.
  async transfer(dto: TransferStockDto, actorId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException("Choose two different warehouses.");
    await this.prisma.$transaction(async (tx) => {
      const item = await this.target(tx, dto.productId, dto.optionId);
      const from = await this.warehouse(tx, dto.fromWarehouseId);
      const to = await this.warehouse(tx, dto.toWarehouseId);
      const have = await this.held(tx, from, item);
      if (dto.quantity > have) throw new BadRequestException(`Only ${have} ${have === 1 ? "unit is" : "units are"} in ${from.name}.`);
      if (!from.isMain) await this.addToShelf(tx, from.id, item, -dto.quantity);
      if (!to.isMain) await this.addToShelf(tx, to.id, item, dto.quantity);
      const tail = dto.note?.trim() ? `. ${dto.note.trim()}` : "";
      await this.log(tx, item, from.id, -dto.quantity, "TRANSFER", `Moved to ${to.name}${tail}`, actorId);
      await this.log(tx, item, to.id, dto.quantity, "TRANSFER", `Moved from ${from.name}${tail}`, actorId);
    });
    return { ok: true };
  }

  // The item to change, with its product row locked so two changes to the same stock never interleave.
  private async target(tx: Tx, productId: string, optionId?: string) {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const product = await tx.product.findUnique({ where: { id: productId }, select: { productType: true, options: { select: { id: true } } } });
    if (!product) throw new NotFoundException("That product no longer exists.");
    if (product.productType !== "OWN") throw new BadRequestException("Only our own products have stock.");
    if (product.options.length && !optionId) throw new BadRequestException("Choose which option.");
    if (optionId && !product.options.some((o) => o.id === optionId)) throw new BadRequestException("That option does not belong to this product.");
    const item = await readItem(tx, productId, optionId ?? null);
    if (!item) throw new NotFoundException();
    return item;
  }

  private async warehouse(tx: Tx, id: string) {
    const w = await tx.warehouse.findUnique({ where: { id } });
    if (!w) throw new NotFoundException("That warehouse does not exist.");
    if (!w.active) throw new BadRequestException(`${w.name} is switched off.`);
    return w;
  }

  // Units of the item a warehouse holds now.
  private async held(tx: Tx, wh: { id: string; isMain: boolean }, item: { productId: string; optionId: string | null; stock: number }) {
    const rows = await tx.warehouseStock.findMany({ where: { productId: item.productId, itemKey: itemKey(item.optionId) } });
    return wh.isMain ? mainQuantity(item.stock, rows.map((r) => r.quantity)) : rows.find((r) => r.warehouseId === wh.id)?.quantity ?? 0;
  }

  private async addToTotal(tx: Tx, item: { productId: string; optionId: string | null }, delta: number) {
    if (item.optionId) await tx.productOption.update({ where: { id: item.optionId }, data: { stock: { increment: delta } } });
    await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: delta } } });
  }

  private addToShelf(tx: Tx, warehouseId: string, item: { productId: string; optionId: string | null }, delta: number) {
    const key = itemKey(item.optionId);
    return tx.warehouseStock.upsert({
      where: { warehouseId_productId_itemKey: { warehouseId, productId: item.productId, itemKey: key } },
      create: { warehouseId, productId: item.productId, optionId: item.optionId, itemKey: key, quantity: delta },
      update: { quantity: { increment: delta } },
    });
  }

  private async log(tx: Tx, item: { productId: string; optionId: string | null; productName: string; optionLabel: string | null }, warehouseId: string, delta: number, reason: StockReason, note: string | undefined, actorId: string) {
    const now = await readItem(tx, item.productId, item.optionId);
    await writeMovement(tx, { ...item, warehouseId, delta, balanceAfter: now?.stock ?? 0, reason, note: note?.trim() || null, actorId });
  }

  private mapDuplicate(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return new ConflictException("A warehouse with this name or code already exists.");
    return e;
  }
}
