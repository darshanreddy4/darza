import { Module } from "@nestjs/common";
import { CartRemindersService } from "./cart-reminders.service";
import { InventoryAlertsService } from "./inventory-alerts.service";
import { NotificationsController } from "./notifications.controller";
import { SalesReportController, SalesReportService } from "./sales-report.service";
import { StockAlertsController } from "./stock-alerts.controller";
import { StockAlertsService } from "./stock-alerts.service";

@Module({
  controllers: [NotificationsController, StockAlertsController, SalesReportController],
  providers: [CartRemindersService, StockAlertsService, InventoryAlertsService, SalesReportService],
  exports: [CartRemindersService, StockAlertsService],
})
export class NotificationsModule {}
