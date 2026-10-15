import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type JwtPayload } from "../auth/auth.guard";
import { AddressDto } from "./address.dto";
import { AddressesService } from "./addresses.service";

@Controller("addresses")
@UseGuards(AuthGuard)
export class AddressesController {
  constructor(private addresses: AddressesService) {}

  @Get() list(@Req() req: { user: JwtPayload }) { return this.addresses.list(req.user.sub); }
  @Post() create(@Req() req: { user: JwtPayload }, @Body() dto: AddressDto) { return this.addresses.create(req.user.sub, dto); }
  @Put(":id") update(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: AddressDto) { return this.addresses.update(req.user.sub, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@Req() req: { user: JwtPayload }, @Param("id") id: string) { await this.addresses.remove(req.user.sub, id); }
}
