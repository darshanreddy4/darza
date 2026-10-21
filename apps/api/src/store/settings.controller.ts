import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard, Permit } from "../auth/auth.guard";
import { UpdateSettingsDto } from "./settings.dto";
import { SettingsService } from "./settings.service";

@Controller()
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // Delivery charges are shown to every visitor in the cart.
  @Get("store/config")
  config() {
    return this.settings.publicConfig();
  }

  @Get("store/delivery")
  delivery(@Query("pincode") pincode = "") {
    return this.settings.deliveryTo(pincode.slice(0, 6));
  }

  @Get("admin/settings")
  @UseGuards(AuthGuard) @Permit("settings.manage")
  get() {
    return this.settings.get();
  }

  @Put("admin/settings")
  @UseGuards(AuthGuard) @Permit("settings.manage")
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
