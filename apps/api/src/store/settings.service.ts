import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma, StoreSettings } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CacheService } from "../cache/cache.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { parseGifts, parseZones, zoneFor } from "./delivery";
import { codRulesOf } from "./cod";
import { guestRulesOf } from "./guest";
import { UpdateSettingsDto } from "./settings.dto";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private whatsapp: WhatsAppService, private cache: CacheService) {}

  // One row holds all store settings; it is created with the defaults on first use.
  get(): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  }

  async update(dto: UpdateSettingsDto) {
    const gstin = dto.gstin?.trim() || null;
    const legalName = dto.legalName?.trim() || null;
    const businessAddress = dto.businessAddress?.trim() || null;
    const businessState = dto.businessState || null;

    if (dto.gstEnabled) {
      const missing = [!gstin && "GST number", !legalName && "business name", !businessAddress && "business address", !businessState && "state"].filter(Boolean);
      if (missing.length) throw new BadRequestException(`To switch GST on, add your ${missing.join(", ")}.`);
    }

    const current = await this.get();
    const schedule = dto.reportSchedule ?? current.reportSchedule;
    const reportEmail = dto.reportEmail !== undefined ? dto.reportEmail.trim() || null : current.reportEmail;
    if (schedule !== "OFF" && !reportEmail) throw new BadRequestException("Add the email address the sales report should go to.");

    const saved = await this.prisma.storeSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {
        shippingFeePaise: dto.shippingFeePaise,
        freeShippingOverPaise: dto.freeShippingOverPaise > 0 ? dto.freeShippingOverPaise : null,
        ...(dto.freeAllOverPaise !== undefined && { freeAllOverPaise: dto.freeAllOverPaise > 0 ? dto.freeAllOverPaise : null }),
        ...(dto.deliveryZones && {
          deliveryZones: dto.deliveryZones.map((z) => ({ name: z.name.trim(), pincodes: [...new Set(z.pincodes)], feePaise: z.feePaise, freeOverPaise: z.freeOverPaise > 0 ? z.freeOverPaise : null })) as Prisma.InputJsonValue,
        }),
        ...(dto.giftTiers && { giftTiers: this.tiers(dto.giftTiers) as Prisma.InputJsonValue }),
        gstEnabled: dto.gstEnabled, gstin, legalName, businessAddress, businessState,
        shippingGstPercent: dto.shippingGstPercent, invoicePrefix: dto.invoicePrefix, returnWindowDays: dto.returnWindowDays, lowStockThreshold: dto.lowStockThreshold,
        ...(dto.alertEmail !== undefined && { alertEmail: dto.alertEmail.trim() || null }),
        ...(dto.codEnabled !== undefined && { codEnabled: dto.codEnabled }),
        ...(dto.advanceEnabled !== undefined && { advanceEnabled: dto.advanceEnabled }),
        ...(dto.skuWeightEnabled !== undefined && { skuWeightEnabled: dto.skuWeightEnabled }),
        ...(dto.optionStockAlerts !== undefined && { optionStockAlerts: dto.optionStockAlerts }),
        ...(dto.orderProgressEnabled !== undefined && { orderProgressEnabled: dto.orderProgressEnabled }),
        ...(dto.guestCheckoutEnabled !== undefined && { guestCheckoutEnabled: dto.guestCheckoutEnabled }),
        ...(dto.guestCodEnabled !== undefined && { guestCodEnabled: dto.guestCodEnabled }),
        ...(dto.guestMinAdvancePaise !== undefined && { guestMinAdvancePaise: dto.guestMinAdvancePaise }),
        ...(dto.codFeePaise !== undefined && { codFeePaise: dto.codFeePaise }),
        ...(dto.codMaxOrderPaise !== undefined && { codMaxOrderPaise: dto.codMaxOrderPaise > 0 ? dto.codMaxOrderPaise : null }),
        reportSchedule: schedule, reportEmail,
        // Switching reports on starts counting from now, so the first one arrives at the next week or month boundary.
        ...(schedule !== "OFF" && current.reportSchedule === "OFF" && { reportLastSentAt: new Date() }),
      },
    });
    // Product pages show settings such as part payment, so cached copies go.
    await this.cache.invalidate();
    return saved;
  }

  // Gifts keep just their amount and name; a percentage reward also keeps its percentage and cap.
  private tiers(list: NonNullable<UpdateSettingsDto["giftTiers"]>) {
    return list
      .map((g) => {
        if (g.kind !== "PERCENT") return { atPaise: g.atPaise, title: g.title.trim() };
        if (!g.percent) throw new BadRequestException(`${g.title.trim()}: enter the percentage off`);
        return { atPaise: g.atPaise, title: g.title.trim(), kind: "PERCENT", percent: g.percent, ...(g.maxDiscountPaise ? { maxPaise: g.maxDiscountPaise } : {}) };
      })
      .sort((a, b) => a.atPaise - b.atPaise);
  }

  async publicConfig() {
    const s = await this.get();
    return {
      shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise, freeAllOverPaise: s.freeAllOverPaise, giftTiers: parseGifts(s.giftTiers),
      gstEnabled: s.gstEnabled, returnWindowDays: s.returnWindowDays, whatsappUpdates: this.whatsapp.available,
      cod: codRulesOf(s), advanceEnabled: s.advanceEnabled, lowStockThreshold: s.lowStockThreshold, skuWeightEnabled: s.skuWeightEnabled, optionStockAlerts: s.optionStockAlerts, orderProgressEnabled: s.orderProgressEnabled, guest: guestRulesOf(s),
    };
  }

  // What delivering to one PIN code costs: the area's own fee when it has one, otherwise the store's.
  async deliveryTo(pincode: string) {
    const s = await this.get();
    const zone = zoneFor(parseZones(s.deliveryZones), pincode);
    return {
      pincode, zone: zone?.name ?? null,
      feePaise: zone ? zone.feePaise : s.shippingFeePaise,
      freeOverPaise: zone ? zone.freeOverPaise : s.freeShippingOverPaise,
      freeAllOverPaise: s.freeAllOverPaise,
    };
  }
}
