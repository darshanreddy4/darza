import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
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

  @Get("admin/settings")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  get() {
    return this.settings.get();
  }

  @Put("admin/settings")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
