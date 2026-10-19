import { Global, Module } from "@nestjs/common";
import { AddressesController } from "./addresses.controller";
import { AddressesService } from "./addresses.service";
import { CouponsController, MyCouponsController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";
import { PincodeController, PincodeService } from "./pincode.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Global()
@Module({
  controllers: [SettingsController, CouponsController, MyCouponsController, AddressesController, PincodeController],
  providers: [SettingsService, CouponsService, AddressesService, PincodeService],
  exports: [SettingsService, CouponsService, PincodeService],
})
export class StoreModule {}
