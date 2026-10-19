import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AuthService, type IdentityProof } from "../auth/auth.service";
import { CacheService } from "../cache/cache.service";
import { PrismaService } from "../prisma.service";
import { DELETE_CONFIRMATION, deletionBlocker } from "./account-rules";

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService, private auth: AuthService, private cache: CacheService) {}

  // Everything we hold about the customer, as plain data. Password hashes and sign-in tokens are never included.
  async export(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, role: true, createdAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, termsAcceptedAt: true, cartRemindersOff: true, googleId: true, passwordSet: true,
        addresses: { select: { label: true, name: true, phone: true, line1: true, line2: true, city: true, state: true, pincode: true, isDefault: true, createdAt: true } },
        orders: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, status: true, createdAt: true, deliveredAt: true, cancelReason: true, paymentMethod: true, subtotalPaise: true, discountPaise: true, shippingPaise: true, totalPaise: true, refundedPaise: true, couponCode: true, invoiceNumber: true, shippingName: true, shippingAddr: true, whatsappOptIn: true,
            items: { select: { quantity: true, pricePaise: true, returnedQty: true, product: { select: { name: true } } } },
          },
        },
        returns: { orderBy: { createdAt: "desc" }, select: { orderId: true, reason: true, details: true, status: true, adminNote: true, createdAt: true, resolvedAt: true, refundPaise: true, payoutUpi: true, payoutRef: true, paidOutAt: true } },
        reviews: { select: { rating: true, title: true, body: true, createdAt: true, product: { select: { name: true } } } },
        questions: { select: { question: true, answer: true, createdAt: true, product: { select: { name: true } } } },
        wishlist: { select: { createdAt: true, product: { select: { name: true } } } },
        stockAlerts: { select: { createdAt: true, product: { select: { name: true } } } },
        couponAccess: { select: { coupon: { select: { code: true } } } },
        cartSnapshot: { select: { items: true, savedAt: true } },
      },
    });
    if (!user) throw new NotFoundException();
    const { googleId, passwordSet, couponAccess, ...profile } = user;
    return {
      exportedAt: new Date().toISOString(),
      note: "A copy of the personal data this store holds about your account. Amounts are in paise (100 paise = 1 rupee).",
      signInMethods: { email: !!profile.email, phone: !!profile.phone, google: !!googleId, password: passwordSet },
      ...profile,
      coupons: couponAccess.map((c) => ({ code: c.coupon.code })),
    };
  }

  sendDeleteCode(userId: string) {
    return this.auth.sendIdentityCode(userId);
  }

  // Removes the customer's personal details and signs them out everywhere. Orders stay, as invoices must be kept for tax records.
  async delete(userId: string, confirm: string, proof: IdentityProof) {
    if (confirm !== DELETE_CONFIRMATION) throw new BadRequestException(`Type ${DELETE_CONFIRMATION} to confirm.`);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
    if (!user || user.deletedAt) throw new UnauthorizedException();

    const [orders, openReturns, payouts] = await Promise.all([
      this.prisma.order.findMany({ where: { userId }, select: { status: true } }),
      this.prisma.returnRequest.count({ where: { userId, status: { in: ["REQUESTED", "APPROVED"] } } }),
      this.prisma.returnRequest.findMany({ where: { userId, status: "REFUNDED", paidOutAt: null, refundPaise: { gt: 0 }, order: { paymentMethod: "COD" } }, select: { id: true } }),
    ]);
    const blocked = deletionBlocker({ role: user.role, orderStatuses: orders.map((o) => o.status), openReturns, payoutsDue: payouts.length });
    if (blocked) throw new ConflictException(blocked);

    // Checked last so the code is only used up once nothing else stands in the way.
    await this.auth.verifyIdentity(userId, proof);

    const hadReviews = await this.prisma.$transaction(async (tx) => {
      const reviews = await tx.review.deleteMany({ where: { userId } });
      await tx.address.deleteMany({ where: { userId } });
      await tx.wishlistItem.deleteMany({ where: { userId } });
      await tx.stockAlert.deleteMany({ where: { userId } });
      await tx.productQuestion.deleteMany({ where: { userId } });
      await tx.cartSnapshot.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
      // A code made only for this customer is switched off; one shared with others keeps working for them.
      const access = await tx.couponCustomer.findMany({ where: { userId }, select: { couponId: true, coupon: { select: { _count: { select: { customers: true } } } } } });
      await tx.coupon.updateMany({ where: { id: { in: access.filter((a) => a.coupon._count.customers === 1).map((a) => a.couponId) } }, data: { active: false } });
      await tx.productView.updateMany({ where: { userId }, data: { userId: null } });
      await tx.returnRequest.updateMany({ where: { userId }, data: { payoutUpi: null } });
      const placeholder = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
      await tx.user.update({
        where: { id: userId },
        data: { email: null, phone: null, googleId: null, name: "Deleted customer", passwordHash: placeholder, passwordSet: false, emailVerifiedAt: null, phoneVerifiedAt: null, cartRemindersOff: true, deletedAt: new Date(), tokenVersion: { increment: 1 } },
      });
      return reviews.count > 0;
    });
    // Product pages show the average rating, so a removed review must not linger in the cache.
    if (hadReviews) await this.cache.invalidate();
  }
}
