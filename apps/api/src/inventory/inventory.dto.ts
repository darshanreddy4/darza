import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class WarehouseDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name!: string;
  // A short label that fits on a stock sheet, such as BLR or DEL2.
  @Transform(trim) @IsString() @Matches(/^[A-Za-z0-9]{2,10}$/, { message: "code must be 2 to 10 letters or numbers" }) code!: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class StockTargetDto {
  @IsString() @MaxLength(40) productId!: string;
  // Needed for a product that has options.
  @IsOptional() @IsString() @MaxLength(40) optionId?: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class ReceiveStockDto extends StockTargetDto {
  @IsString() @MaxLength(40) warehouseId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export class AdjustStockDto extends StockTargetDto {
  @IsString() @MaxLength(40) warehouseId!: string;
  // Plus to add units found, minus to take away units lost or damaged.
  @IsInt() @Min(-1_000_000) @Max(1_000_000) delta!: number;
}

export class TransferStockDto extends StockTargetDto {
  @IsString() @MaxLength(40) fromWarehouseId!: string;
  @IsString() @MaxLength(40) toWarehouseId!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export const REASONS = ["SALE", "CANCELLED", "RETURNED", "RECEIVED", "ADJUSTMENT", "TRANSFER", "EDIT", "IMPORT"] as const;
export class MovementQueryDto {
  @IsOptional() @IsString() @MaxLength(40) productId?: string;
  @IsOptional() @IsString() @MaxLength(40) warehouseId?: string;
  @IsOptional() @IsIn(REASONS) reason?: (typeof REASONS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000) page?: number;
}
