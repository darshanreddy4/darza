import { IsArray, IsOptional, IsString, MaxLength, MinLength, ArrayMaxSize } from "class-validator";
import { Transform } from "class-transformer";

export class StaffRoleDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString() @MinLength(2) @MaxLength(60) name!: string;

  @IsOptional() @IsString() @MaxLength(200) description?: string;

  @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) permissions!: string[];
}
