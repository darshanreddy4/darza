import { Body, Controller, ForbiddenException, Get, Param, ParseEnumPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ReturnStatus } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, RequireVerified, Roles, type JwtPayload } from "../auth/auth.guard";
import { ADMIN_AND_STAFF, canDecideReturn } from "../auth/permissions";
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
  @Roles(...ADMIN_AND_STAFF)
  list(@Query("status", new ParseEnumPipe(ReturnStatus, { optional: true })) status?: ReturnStatus) {
    return this.returns.list(status);
  }

  @Patch("admin/returns/:id")
  @Roles(...ADMIN_AND_STAFF)
  decide(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: DecideReturnDto) {
    if (!canDecideReturn(req.user.role, dto.action)) throw new ForbiddenException("Only an admin can refund a return.");
    return this.returns.decide(id, dto);
  }
}
