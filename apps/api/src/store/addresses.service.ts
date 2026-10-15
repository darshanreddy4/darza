import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { AddressDto } from "./address.dto";

const MAX_ADDRESSES = 10;

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  }

  async create(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new BadRequestException(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
    return this.prisma.$transaction(async (tx) => {
      // The first address is the default; otherwise only when asked.
      const makeDefault = count === 0 || !!dto.isDefault;
      if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({ data: { ...this.fields(dto), userId, isDefault: makeDefault } });
    });
  }

  async update(userId: string, id: string, dto: AddressDto) {
    await this.owned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { ...this.fields(dto), ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }) } });
    });
  }

  async remove(userId: string, id: string) {
    const addr = await this.owned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    // Keep one address marked as the default.
    if (addr.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  private async owned(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new NotFoundException();
    return addr;
  }

  private fields(dto: AddressDto) {
    return {
      label: dto.label?.trim() || null, name: dto.name.trim(), phone: dto.phone, line1: dto.line1.trim(), line2: dto.line2?.trim() || null,
      city: dto.city.trim(), state: dto.state, pincode: dto.pincode,
    };
  }
}
