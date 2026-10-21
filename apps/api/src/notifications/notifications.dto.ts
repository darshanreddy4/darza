import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class CartItemDto {
  @IsString() @MaxLength(40) productId!: string;
  @IsOptional() @IsString() @MaxLength(40) optionId?: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}

export class CartSnapshotDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartItemDto)
  items!: CartItemDto[];
}

export class EmailPreferencesDto {
  @IsBoolean() cartReminders!: boolean;
}

export class UnsubscribeDto {
  @IsString() @MaxLength(200) token!: string;
}
