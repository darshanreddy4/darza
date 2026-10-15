import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, Length, MaxLength } from "class-validator";
import type { Response } from "express";
import { AuthGuard, type JwtPayload } from "../auth/auth.guard";
import { clearSessionCookie } from "../auth/session-cookie";
import { AccountService } from "./account.service";

class DeleteAccountDto {
  @IsString() @MaxLength(20) confirm!: string;
  @IsOptional() @IsString() @MaxLength(128) password?: string;
  @IsOptional() @IsString() @Length(6, 6) code?: string;
  @IsOptional() @IsString() @Length(20, 4096) googleCredential?: string;
}

@Controller("me")
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private account: AccountService) {}

  @Get("export")
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  async export(@Req() req: { user: JwtPayload }, @Res({ passthrough: true }) res: Response) {
    const data = await this.account.export(req.user.sub);
    res.setHeader("content-disposition", 'attachment; filename="my-data.json"');
    res.setHeader("cache-control", "no-store");
    return data;
  }

  @Post("delete/code")
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  sendCode(@Req() req: { user: JwtPayload }) {
    return this.account.sendDeleteCode(req.user.sub);
  }

  @Post("delete")
  @HttpCode(204)
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  async delete(@Req() req: { user: JwtPayload }, @Body() dto: DeleteAccountDto, @Res({ passthrough: true }) res: Response) {
    await this.account.delete(req.user.sub, dto.confirm, { password: dto.password, code: dto.code, googleCredential: dto.googleCredential });
    clearSessionCookie(res);
  }
}
