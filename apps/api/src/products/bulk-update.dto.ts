import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import type { BulkChanges } from "./bulk-update";

export class BulkChangesDto implements BulkChanges {
  @IsOptional() @IsIn(["PUBLISHED", "DRAFT"]) status?: "PUBLISHED" | "DRAFT";
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsString() @MaxLength(40) dealLabel?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) pricePaise?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(-90) @Max(500) priceChangePercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) mrpPaise?: number;
  @IsOptional() @IsBoolean() clearMrp?: boolean;
  @IsOptional() @IsBoolean() mrpFromOldPrice?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) stock?: number;
  @IsOptional() @IsBoolean() showRating?: boolean;
  @IsOptional() @IsBoolean() showAddToCart?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(30) deliveryDays?: number;
  @IsOptional() @IsBoolean() clearDelivery?: boolean;
  @IsOptional() @IsBoolean() freeDelivery?: boolean;
}

export class BulkUpdateProductsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({ each: true }) @MaxLength(40, { each: true }) ids!: string[];
  @ValidateNested() @Type(() => BulkChangesDto) changes!: BulkChangesDto;
  // Reports what would change without saving anything.
  @IsOptional() @IsBoolean() dryRun?: boolean;
}
