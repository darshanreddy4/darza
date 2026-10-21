import { Body, Controller, ForbiddenException, Get, Param, ParseEnumPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReturnStatus } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit, RequireVerified, type JwtPayload } from "../auth/auth.guard";
import { canDecideReturn } from "../auth/permissions";
import { DecideReturnDto, RequestReturnDto } from "./order.dto";
import { ReturnsService } from "./returns.service";

@Controller()
@UseGuards(AuthGuard)
export class ReturnsController {
  constructor(private returns: ReturnsService) {}

  @Post("orders/:id/return")
  @RequireVerified()
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  request(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: RequestReturnDto) {
    return this.returns.request(req.user.sub, id, dto);
  }

  @Get("admin/returns")
  @Permit("returns.view")
  list(@Query("status", new ParseEnumPipe(ReturnStatus, { optional: true })) status?: ReturnStatus) {
    return this.returns.list(status);
  }

  @Patch("admin/returns/:id")
  @Permit("returns.decide", "returns.refund")
  decide(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: DecideReturnDto) {
    if (!canDecideReturn(req.user.permissions, dto.action)) throw new ForbiddenException("Your role cannot do this: refunds need the refund permission, approving or declining needs the decide permission.");
    return this.returns.decide(id, dto);
  }
}
