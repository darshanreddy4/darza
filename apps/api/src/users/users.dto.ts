import { Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class SetRoleDto {
  @IsEnum(Role) role!: Role;
  // The team role of a STAFF user; null or left out for the others.
  @IsOptional() @IsString() staffRoleId?: string | null;
}
