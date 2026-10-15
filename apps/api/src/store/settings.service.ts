import { BadRequestException, Injectable } from "@nestjs/common";
import type { StoreSettings } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { UpdateSettingsDto } from "./settings.dto";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private whatsapp: WhatsAppService) {}

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

    return this.prisma.storeSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {
        shippingFeePaise: dto.shippingFeePaise,
        freeShippingOverPaise: dto.freeShippingOverPaise > 0 ? dto.freeShippingOverPaise : null,
        gstEnabled: dto.gstEnabled, gstin, legalName, businessAddress, businessState,
        shippingGstPercent: dto.shippingGstPercent, invoicePrefix: dto.invoicePrefix, returnWindowDays: dto.returnWindowDays, lowStockThreshold: dto.lowStockThreshold,
        ...(dto.alertEmail !== undefined && { alertEmail: dto.alertEmail.trim() || null }),
        reportSchedule: schedule, reportEmail,
        // Switching reports on starts counting from now, so the first one arrives at the next week or month boundary.
        ...(schedule !== "OFF" && current.reportSchedule === "OFF" && { reportLastSentAt: new Date() }),
      },
    });
  }

  async publicConfig() {
    const s = await this.get();
    return { shippingFeePaise: s.shippingFeePaise, freeShippingOverPaise: s.freeShippingOverPaise, gstEnabled: s.gstEnabled, returnWindowDays: s.returnWindowDays, whatsappUpdates: this.whatsapp.available };
  }
}
