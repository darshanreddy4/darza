import { Body, ConflictException, Controller, DefaultValuePipe, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UseGuards, BadRequestException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { AuthGuard, Roles, type JwtPayload } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { toCsv } from "./csv";
import { validateRoleChange } from "./role-rules";
import { formatAddress, pickContact, summariseOrders } from "./user-stats";
import { SetRoleDto } from "./users.dto";

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 10_000;

function userFilter(q?: string, role?: string, verified?: string): Prisma.UserWhereInput {
  const search = q?.trim().slice(0, 100);
  return {
    // Customers who deleted their account only remain as the name on old orders.
    deletedAt: null,
    ...(role === "ADMIN" || role === "STAFF" || role === "CUSTOMER" ? { role } : {}),
    ...(verified === "true" ? { OR: [{ emailVerifiedAt: { not: null } }, { phoneVerifiedAt: { not: null } }] } : verified === "false" ? { emailVerifiedAt: null, phoneVerifiedAt: null } : {}),
    ...(search ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { phone: { contains: search.replace(/[\s()-]/g, "") } }] } : {}),
  };
}

@Controller("admin/users")
@UseGuards(AuthGuard)
@Roles("ADMIN")
export class UsersController {
  private readonly logger = new Logger("Users");

  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query("q") q?: string,
    @Query("role") role?: string,
    @Query("verified") verified?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
  ) {
    const where = userFilter(q, role, verified);
    const safePage = Math.max(1, page);
    const [total, admins, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { role: "ADMIN" } }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, email: true, phone: true, googleId: true, name: true, role: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true },
      }),
    ]);

    // Orders that were actually paid for or are on their way; cancelled and refunded ones do not count as spend.
    const stats = await this.prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } },
      _count: { _all: true },
      _sum: { totalPaise: true },
    });
    const byUser = new Map(stats.map((s) => [s.userId, s]));
    const contacts = await this.contacts(users.map((u) => u.id));

    return {
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
      admins,
      items: users.map(({ emailVerifiedAt, phoneVerifiedAt, googleId, phone: loginPhone, ...u }) => ({
        ...u,
        emailVerified: emailVerifiedAt !== null || phoneVerifiedAt !== null,
        // How this person signs in; a number they signed up with wins over the one on a delivery address.
        signIn: [u.email ? "email" : null, loginPhone ? "phone" : null, googleId ? "google" : null].filter(Boolean),
        phone: loginPhone ?? contacts.get(u.id)?.phone ?? "",
        address: contacts.get(u.id)?.address ?? "",
        orders: byUser.get(u.id)?._count._all ?? 0,
        spentPaise: byUser.get(u.id)?._sum.totalPaise ?? 0,
      })),
    };
  }

  // Everyone matching the current filters as a spreadsheet file.
  @Get("export")
  async exportCsv(
    @Res({ passthrough: true }) res: Response,
    @Query("q") q?: string,
    @Query("role") role?: string,
    @Query("verified") verified?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: userFilter(q, role, verified),
      orderBy: { createdAt: "desc" },
      take: EXPORT_LIMIT,
      select: { id: true, email: true, phone: true, googleId: true, name: true, role: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true },
    });
    const ids = users.map((u) => u.id);
    const [contacts, stats, refunds] = await Promise.all([
      this.contacts(ids),
      this.prisma.order.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } }, _count: { _all: true }, _sum: { totalPaise: true } }),
      this.prisma.order.groupBy({ by: ["userId"], where: { userId: { in: ids }, refundedPaise: { gt: 0 } }, _sum: { refundedPaise: true } }),
    ]);
    const orders = new Map(stats.map((s) => [s.userId, s]));
    const refunded = new Map(refunds.map((s) => [s.userId, s._sum.refundedPaise ?? 0]));
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="dmg-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    return "\uFEFF" + toCsv(
      ["Name", "Email", "Email verified", "Role", "Phone", "Address", "Joined", "Orders", "Spent (INR)", "Refunded (INR)"],
      users.map((u) => [
        u.name, u.email ?? "", u.emailVerifiedAt || u.phoneVerifiedAt ? "Yes" : "No", u.role,
        u.phone ?? contacts.get(u.id)?.phone ?? "", contacts.get(u.id)?.address ?? "",
        u.createdAt.toISOString().slice(0, 10),
        orders.get(u.id)?._count._all ?? 0, rupees(orders.get(u.id)?._sum.totalPaise ?? 0), rupees(refunded.get(u.id) ?? 0),
      ]),
    );
  }

  // Who the user is and everything they have bought from us.
  @Get(":id")
  async detail(@Param("id") id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, phone: true, googleId: true, name: true, role: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true,
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        orders: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, status: true, totalPaise: true, refundedPaise: true, paymentMethod: true, createdAt: true, shippingAddr: true,
            items: { select: { productId: true, quantity: true, pricePaise: true, product: { select: { name: true, slug: true } } } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException();

    const statsOrders = user.orders.map((o) => ({
      id: o.id, status: o.status, totalPaise: o.totalPaise, refundedPaise: o.refundedPaise,
      items: o.items.map((i) => ({ productId: i.productId, name: i.product.name, slug: i.product.slug, quantity: i.quantity, pricePaise: i.pricePaise })),
    }));
    const { products, ...summary } = summariseOrders(statsOrders);

    return {
      user: {
        id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role,
        emailVerified: user.emailVerifiedAt !== null || user.phoneVerifiedAt !== null, google: user.googleId !== null, createdAt: user.createdAt,
      },
      contact: pickContact(user.addresses, user.orders[0]?.shippingAddr),
      addresses: user.addresses.map((a) => ({ id: a.id, label: a.label, name: a.name, phone: a.phone, address: formatAddress(a), isDefault: a.isDefault })),
      summary,
      products,
      orders: user.orders.map((o) => ({
        id: o.id, status: o.status, totalPaise: o.totalPaise, refundedPaise: o.refundedPaise, paymentMethod: o.paymentMethod, createdAt: o.createdAt,
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
      })),
    };
  }

  // Phone and address for each user: a saved address, else the delivery details of their latest order.
  private async contacts(ids: string[]) {
    const [addresses, latest] = await Promise.all([
      this.prisma.address.findMany({ where: { userId: { in: ids } } }),
      this.prisma.order.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: "desc" }, distinct: ["userId"], select: { userId: true, shippingAddr: true } }),
    ]);
    const latestBy = new Map(latest.map((o) => [o.userId, o.shippingAddr]));
    return new Map(ids.map((id) => [id, pickContact(addresses.filter((a) => a.userId === id), latestBy.get(id))]));
  }

  @Patch(":id/role")
  async setRole(@Req() req: { user: JwtPayload }, @Param("id") id: string, @Body() dto: SetRoleDto) {
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
          if (!target) throw new NotFoundException();
          const problem = validateRoleChange({
            actorId: req.user.sub,
            targetId: id,
            currentRole: target.role,
            newRole: dto.role,
            adminCount: await tx.user.count({ where: { role: "ADMIN" } }),
          });
          if (problem) throw new BadRequestException(problem);
          return tx.user.update({ where: { id }, data: { role: dto.role }, select: { id: true, email: true, role: true } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.logger.log(`Admin ${req.user.sub} set role of ${updated.email} to ${updated.role}`);
      return { id: updated.id, role: updated.role };
    } catch (e) {
      // Two admins changing roles at the same moment: the database rejects one so the last admin can never be removed.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") throw new ConflictException("Another change was happening at the same time. Please try again.");
      throw e;
    }
  }

  // Ends every login session of a user (a lost phone, a shared computer); they sign in again with their password.
  @Post(":id/sign-out")
  async signOut(@Req() req: { user: JwtPayload }, @Param("id") id: string) {
    if (id === req.user.sub) throw new BadRequestException("Use Log out for your own account.");
    const res = await this.prisma.user.updateMany({ where: { id }, data: { tokenVersion: { increment: 1 } } });
    if (!res.count) throw new NotFoundException();
    this.logger.log(`Admin ${req.user.sub} signed out all sessions of user ${id}`);
    return { ok: true };
  }
}
