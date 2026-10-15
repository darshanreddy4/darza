import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CategoryDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() parentId?: string | null;
}
