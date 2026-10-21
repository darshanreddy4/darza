import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard, Permit, type JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { CartRemindersService } from "./cart-reminders.service";
import { CartSnapshotDto, EmailPreferencesDto, UnsubscribeDto } from "./notifications.dto";
import { userFromUnsubscribeToken } from "./unsubscribe";

@Controller()
export class NotificationsController {
  constructor(private carts: CartRemindersService, private prisma: PrismaService) {}

  // The web app keeps this in step with the browser's cart so a reminder can be sent if checkout never happens.
  @Put("cart/snapshot")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async snapshot(@Req() req: { user: JwtPayload }, @Body() dto: CartSnapshotDto) {
    await this.carts.save(req.user.sub, dto.items);
  }

  @Get("me/email-preferences")
  @UseGuards(AuthGuard)
  async preferences(@Req() req: { user: JwtPayload }) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.sub }, select: { cartRemindersOff: true, email: true } });
    return { cartReminders: !u.cartRemindersOff, hasEmail: !!u.email };
  }

  @Put("me/email-preferences")
  @UseGuards(AuthGuard)
  async setPreferences(@Req() req: { user: JwtPayload }, @Body() dto: EmailPreferencesDto) {
    await this.prisma.user.update({ where: { id: req.user.sub }, data: { cartRemindersOff: !dto.cartReminders } });
    if (!dto.cartReminders) await this.carts.clear(req.user.sub);
    return { cartReminders: dto.cartReminders };
  }

  // Linked from the reminder email, so it works without logging in.
  @Post("unsubscribe")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    const userId = userFromUnsubscribeToken(dto.token);
    if (!userId) throw new BadRequestException("This link is not valid.");
    await this.prisma.user.updateMany({ where: { id: userId }, data: { cartRemindersOff: true } });
    await this.carts.clear(userId);
    return { ok: true };
  }

  @Get("admin/abandoned-carts")
  @UseGuards(AuthGuard)
  @Permit("analytics.view")
  abandoned() {
    return this.carts.abandoned();
  }
}
