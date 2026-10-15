import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseEnumPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { AllowAnonymous, AuthGuard, RequireVerified, Roles, type JwtPayload } from "../auth/auth.guard";
import { ADMIN_AND_STAFF, canSetOrderStatus, withoutCost } from "../auth/permissions";
import { RazorpayService } from "../payments/razorpay.service";
import { verifyWebhookSignature } from "../payments/signature";
import { Throttle } from "@nestjs/throttler";
import { CancelOrderDto, CreateOrderDto, QuoteDto, UpdateOrderStatusDto, VerifyPaymentDto } from "./order.dto";
import { InvoiceService } from "./invoice.service";
import { OrdersService } from "./orders.service";

@Controller()
export class OrdersController {
  constructor(private orders: OrdersService, private razorpay: RazorpayService, private invoices: InvoiceService) {}

  @Get("payments/config")
  paymentConfig() {
    return { online: this.razorpay.enabled, keyId: this.razorpay.enabled ? this.razorpay.keyId : null };
  }

  // Razorpay calls this server-to-server; the signature covers the raw body.
  @Post("payments/razorpay/webhook")
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = String(req.headers["x-razorpay-signature"] ?? "");
    if (!this.razorpay.webhookSecret || !req.rawBody || !verifyWebhookSignature(req.rawBody, signature, this.razorpay.webhookSecret)) {
      throw new BadRequestException("Invalid signature");
    }
    const body = JSON.parse(req.rawBody.toString("utf8"));
    if (body.event === "payment.captured" || body.event === "order.paid") {
      const payment = body.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) await this.orders.markPaid(payment.order_id, payment.id);
    }
    return { ok: true };
  }

  // Open to guests so they can see delivery charges and try a coupon; a signed-in customer also gets their personal codes.
  @Post("checkout/quote")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @AllowAnonymous("soft")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  quote(@Req() req: { user?: JwtPayload }, @Body() dto: QuoteDto) {
    return this.orders.quote(dto, req.user?.sub);
  }

  @Get("orders/:id/invoice")
  @UseGuards(AuthGuard)
  invoice(@Req() req: { user: JwtPayload }, @Param("id") id: string) {
    return this.invoices.get(id, req.user);
  }

  @Post("orders")
  @UseGuards(AuthGuard)
  @RequireVerified()
  create(@Req() req: { user: JwtPayload }, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.sub, dto);
  }

  @Get("orders")
  @UseGuards(AuthGuard)
  mine(@Req() req: { user: JwtPayload }) {
    return this.orders.mine(req.user.sub);
  }

  // Customers can cancel on their own until the order ships; paid online orders are refunded automatically.
  @Post("orders/:id/cancel")
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  cancel(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancelByCustomer(req.user.sub, id, dto.reason, dto.details);
  }

  @Post("orders/:id/payment")
  @UseGuards(AuthGuard)
  startPayment(@Req() req: { user: JwtPayload }, @Param("id") id: string) {
    return this.orders.startPayment(req.user.sub, id);
  }

  @Post("orders/:id/verify")
  @UseGuards(AuthGuard)
  verify(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: VerifyPaymentDto) {
    return this.orders.verify(req.user.sub, id, dto);
  }

  @Get("admin/orders")
  @UseGuards(AuthGuard)
  @Roles(...ADMIN_AND_STAFF)
  async listAdmin(@Req() req: { user: JwtPayload }, @Query("status", new ParseEnumPipe(OrderStatus, { optional: true })) status?: OrderStatus) {
    const orders = await this.orders.listAdmin(status);
    return orders.map((o) => ({ ...o, items: o.items.map((i) => withoutCost(req.user.role, i)) }));
  }

  @Patch("admin/orders/:id/status")
  @UseGuards(AuthGuard)
  @Roles(...ADMIN_AND_STAFF)
  updateStatus(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: UpdateOrderStatusDto) {
    if (!canSetOrderStatus(req.user.role, dto.status)) throw new ForbiddenException("Only an admin can cancel or refund an order.");
    return this.orders.updateStatus(id, dto.status);
  }
}
