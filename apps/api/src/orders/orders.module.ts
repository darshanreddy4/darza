import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { OrdersController } from "./orders.controller";
import { InvoiceService } from "./invoice.service";
import { OrdersService } from "./orders.service";
import { ReturnsController } from "./returns.controller";
import { ReturnsService } from "./returns.service";

@Module({ imports: [PaymentsModule], controllers: [OrdersController, ReturnsController], providers: [OrdersService, InvoiceService, ReturnsService] })
export class OrdersModule {}
