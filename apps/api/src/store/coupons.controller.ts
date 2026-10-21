import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Permit, type JwtPayload } from "../auth/auth.guard";
import { CouponDto } from "./coupon.dto";
import { CouponsService } from "./coupons.service";

@Controller()
export class MyCouponsController {
  constructor(private coupons: CouponsService) {}

  // Personal codes the signed-in customer can still use.
  @Get("coupons/mine") @UseGuards(AuthGuard)
  mine(@Req() req: { user: JwtPayload }) { return this.coupons.mine(req.user.sub); }
}

@Controller("admin/coupons")
@UseGuards(AuthGuard) @Permit("coupons.manage")
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Get() list() { return this.coupons.list(); }
  @Get(":id/usage") usage(@Param("id") id: string) { return this.coupons.usage(id); }
  @Post() create(@Body() dto: CouponDto) { return this.coupons.create(dto); }
  @Put(":id") update(@Param("id") id: string, @Body() dto: CouponDto) { return this.coupons.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.coupons.remove(id); }
}
