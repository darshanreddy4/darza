import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { LEGACY_STAFF_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_REQUIRES, ROLE_TEMPLATES, normalisePermissions } from "../auth/permissions";
import { PrismaService } from "../prisma.service";
import { StaffRoleDto } from "./roles.dto";

// Team roles: an admin decides what each kind of team member may do. Only admins can see or change them.
@Controller("admin/roles")
@UseGuards(AuthGuard)
@Roles("ADMIN")
export class RolesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    const [roles, unassigned] = await Promise.all([
      this.prisma.staffRole.findMany({ orderBy: { name: "asc" }, include: { members: { where: { deletedAt: null }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } } } }),
      this.prisma.user.findMany({ where: { role: "STAFF", staffRoleId: null, deletedAt: null }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    ]);
    return {
      roles: roles.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions, members: r.members, updatedAt: r.updatedAt })),
      // Team members who were added before roles existed; they keep the original staff access until given a role.
      unassigned,
      legacyPermissions: LEGACY_STAFF_PERMISSIONS,
      groups: PERMISSION_GROUPS,
      requires: PERMISSION_REQUIRES,
      templates: ROLE_TEMPLATES,
    };
  }

  @Post()
  async create(@Body() dto: StaffRoleDto) {
    const data = this.clean(dto);
    try {
      const role = await this.prisma.staffRole.create({ data });
      return { id: role.id, name: role.name, description: role.description, permissions: role.permissions };
    } catch (e) {
      throw this.mapError(e);
    }
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: StaffRoleDto) {
    const data = this.clean(dto);
    try {
      const role = await this.prisma.staffRole.update({ where: { id }, data });
      return { id: role.id, name: role.name, description: role.description, permissions: role.permissions };
    } catch (e) {
      throw this.mapError(e);
    }
  }

  @Delete(":id")
  @HttpCode(200)
  async remove(@Param("id") id: string) {
    const members = await this.prisma.user.count({ where: { staffRoleId: id } });
    if (members) throw new ConflictException(`${members} team member${members === 1 ? " is" : "s are"} using this role. Move them to another role first.`);
    const res = await this.prisma.staffRole.deleteMany({ where: { id } });
    if (!res.count) throw new NotFoundException();
    return { ok: true };
  }

  private clean(dto: StaffRoleDto) {
    const { permissions, unknown } = normalisePermissions(dto.permissions);
    if (unknown.length) throw new BadRequestException(`Unknown permission: ${unknown.join(", ")}`);
    if (!permissions.length) throw new BadRequestException("Choose at least one permission for this role.");
    return { name: dto.name.trim(), description: dto.description?.trim() ?? "", permissions };
  }

  private mapError(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return new ConflictException("A role with this name already exists.");
      if (e.code === "P2025") return new NotFoundException();
    }
    return e;
  }
}
