import { Global, Module } from "@nestjs/common";
import { AddressesController } from "./addresses.controller";
import { AddressesService } from "./addresses.service";
import { CouponsController, MyCouponsController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Global()
@Module({
  controllers: [SettingsController, CouponsController, MyCouponsController, AddressesController],
  providers: [SettingsService, CouponsService, AddressesService],
  exports: [SettingsService, CouponsService],
})
export class StoreModule {}
