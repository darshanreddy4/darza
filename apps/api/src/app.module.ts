import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma.service";
import { CacheModule } from "./cache/cache.service";
import { MailModule } from "./mail/mail.service";
import { SmsModule } from "./sms/sms.service";
import { StorageModule } from "./storage/storage.service";
import { WhatsAppModule } from "./whatsapp/whatsapp.service";
import { HealthModule } from "./health/health.module";
import { AuditModule } from "./audit/audit.module";
import { AccountModule } from "./account/account.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { ProductsModule } from "./products/products.module";
import { UploadsModule } from "./uploads/uploads.module";
import { OrdersModule } from "./orders/orders.module";
import { EngagementModule } from "./engagement/engagement.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { BannersModule } from "./banners/banners.module";
import { StoreModule } from "./store/store.module";
import { UsersModule } from "./users/users.module";
import { HomeModule } from "./home/home.module";
import { SiteModule } from "./site/site.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    // The end-to-end tests send far more requests from one address than a person would.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }], skipIf: () => !!process.env.DISABLE_RATE_LIMIT }),
    PrismaModule,
    CacheModule,
    MailModule,
    SmsModule,
    StorageModule,
    HealthModule,
    WhatsAppModule,
    AuditModule,
    AuthModule,
    AccountModule,
    CategoriesModule,
    ProductsModule,
    UploadsModule,
    OrdersModule,
    EngagementModule,
    AnalyticsModule,
    BannersModule,
    StoreModule,
    UsersModule,
    HomeModule,
    SiteModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
