import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { UpdateAppearanceDto } from "./appearance.dto";
import { AppearanceService } from "./appearance.service";

@Controller()
export class AppearanceController {
  constructor(private appearance: AppearanceService) {}

  // Every page asks for this: the look chosen by the admin and the currencies shoppers may switch between.
  @Get("appearance")
  @Throttle({ default: { ttl: 60_000, limit: 240 } })
  publicAppearance() {
    return this.appearance.publicAppearance();
  }

  @Get("admin/appearance")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  admin() {
    return this.appearance.adminView();
  }

  @Put("admin/appearance")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  update(@Body() dto: UpdateAppearanceDto) {
    return this.appearance.update(dto);
  }

  @Post("admin/appearance/refresh-rates")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseGuards(AuthGuard) @Roles("ADMIN")
  refresh() {
    return this.appearance.refreshRates();
  }
}
