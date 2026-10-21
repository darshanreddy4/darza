import { Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit, type JwtPayload } from "../auth/auth.guard";
import { StockAlertsService } from "./stock-alerts.service";

@Controller()
export class StockAlertsController {
  constructor(private alerts: StockAlertsService) {}

  @Get("products/:slug/stock-alert")
  @UseGuards(AuthGuard)
  status(@Req() req: { user: JwtPayload }, @Param("slug") slug: string) {
    return this.alerts.status(req.user.sub, slug);
  }

  @Post("products/:slug/stock-alert")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async subscribe(@Req() req: { user: JwtPayload }, @Param("slug") slug: string) {
    await this.alerts.subscribe(req.user.sub, slug);
  }

  @Delete("products/:slug/stock-alert")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async unsubscribe(@Req() req: { user: JwtPayload }, @Param("slug") slug: string) {
    await this.alerts.unsubscribe(req.user.sub, slug);
  }

  @Get("admin/stock-alerts")
  @UseGuards(AuthGuard)
  @Permit("inventory.view")
  waiting() {
    return this.alerts.waiting();
  }
}
