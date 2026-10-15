import { Body, Controller, Delete, Get, Put, UseGuards } from "@nestjs/common";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { HomeService } from "./home.service";

@Controller()
export class HomeController {
  constructor(private home: HomeService) {}

  @Get("home")
  publicLayout() {
    return this.home.publicLayout();
  }

  @Get("admin/home-layout")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  layout() {
    return this.home.layout();
  }

  // Replaces the whole layout: the admin edits it in the browser and saves it in one go.
  @Put("admin/home-layout")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  save(@Body() body: { widgets?: unknown }) {
    return this.home.save(body?.widgets);
  }

  @Delete("admin/home-layout")
  @UseGuards(AuthGuard) @Roles("ADMIN")
  reset() {
    return this.home.reset();
  }
}
