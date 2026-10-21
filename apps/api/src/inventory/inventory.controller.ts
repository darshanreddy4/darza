import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Permit, type JwtPayload } from "../auth/auth.guard";
import { AdjustStockDto, MovementQueryDto, ReceiveStockDto, TransferStockDto, WarehouseDto } from "./inventory.dto";
import { InventoryService } from "./inventory.service";

// Warehouses, where each product's units are kept, and the history of every change to them.
@Controller("admin")
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get("warehouses")
  @Permit("inventory.view")
  warehouses() { return this.inventory.warehouses(); }

  @Post("warehouses")
  @Permit("inventory.manage")
  createWarehouse(@Body() dto: WarehouseDto) { return this.inventory.createWarehouse(dto); }

  @Put("warehouses/:id")
  @Permit("inventory.manage")
  updateWarehouse(@Param("id") id: string, @Body() dto: WarehouseDto) { return this.inventory.updateWarehouse(id, dto); }

  @Delete("warehouses/:id")
  @HttpCode(200)
  @Permit("inventory.manage")
  removeWarehouse(@Param("id") id: string) { return this.inventory.removeWarehouse(id); }

  @Get("stock/levels/:productId")
  @Permit("inventory.view")
  levels(@Param("productId") productId: string) { return this.inventory.levels(productId); }

  @Get("stock/movements")
  @Permit("inventory.view")
  movements(@Query() q: MovementQueryDto) {
    return this.inventory.movements(q, q.page ?? 1);
  }

  @Post("stock/receive")
  @HttpCode(200)
  @Permit("inventory.manage")
  receive(@Req() req: { user: JwtPayload }, @Body() dto: ReceiveStockDto) { return this.inventory.receive(dto, req.user.sub); }

  @Post("stock/adjust")
  @HttpCode(200)
  @Permit("inventory.manage")
  adjust(@Req() req: { user: JwtPayload }, @Body() dto: AdjustStockDto) { return this.inventory.adjust(dto, req.user.sub); }

  @Post("stock/transfer")
  @HttpCode(200)
  @Permit("inventory.manage")
  transfer(@Req() req: { user: JwtPayload }, @Body() dto: TransferStockDto) { return this.inventory.transfer(dto, req.user.sub); }
}
