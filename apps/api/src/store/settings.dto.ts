import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { IN_STATES } from "./states";

export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// An area whose PIN codes start with any of these digits pays its own delivery fee.
export class DeliveryZoneDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(60) @Matches(/^[1-9]\d{0,5}$/, { each: true, message: "PIN codes must be 1 to 6 digits and not start with 0" }) pincodes!: string[];
  @IsInt() @Min(0) @Max(100_000) feePaise!: number;
  // 0 means regular items are never free to this area.
  @IsInt() @Min(0) @Max(100_000_000) freeOverPaise!: number;
}

export class GiftTierDto {
  @IsInt() @Min(1) @Max(100_000_000) atPaise!: number;
  @IsString() @MinLength(1) @MaxLength(60) title!: string;
  // GIFT (the default) is a free gift packed with the order; PERCENT takes a percentage off the whole order.
  @IsOptional() @IsIn(["GIFT", "PERCENT"]) kind?: "GIFT" | "PERCENT";
  @IsOptional() @IsInt() @Min(1) @Max(90) percent?: number;
  // 0 means no cap on a percentage reward.
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) maxDiscountPaise?: number;
}

export class UpdateSettingsDto {
  @IsInt() @Min(0) @Max(100_000) shippingFeePaise!: number;
  // 0 means delivery is never free.
  @IsInt() @Min(0) @Max(100_000_000) freeShippingOverPaise!: number;
  // 0 turns the free-everything amount off. Leaving it out keeps what is saved.
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) freeAllOverPaise?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => DeliveryZoneDto) deliveryZones?: DeliveryZoneDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => GiftTierDto) giftTiers?: GiftTierDto[];

  @IsBoolean() gstEnabled!: boolean;
  // An empty string clears the number.
  @IsOptional() @IsString() @Matches(/^(|\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])$/, { message: "gstin must be a valid 15-character GST number" }) gstin?: string;
  @IsOptional() @IsString() @MaxLength(120) legalName?: string;
  @IsOptional() @IsString() @MaxLength(300) businessAddress?: string;
  @IsOptional() @IsIn([...IN_STATES, ""]) businessState?: string;
  @IsOptional() @IsInt() @Min(0) @Max(90) returnWindowDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) lowStockThreshold?: number;
  @IsOptional() @IsIn(["OFF", "WEEKLY", "MONTHLY"]) reportSchedule?: string;
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "reportEmail must be a valid email address" }) reportEmail?: string;
  // An empty string turns the emails off.
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "alertEmail must be a valid email address" }) alertEmail?: string;
  @IsInt() @IsIn([0, 5, 12, 18, 28]) shippingGstPercent!: number;
  @IsString() @Matches(/^[A-Z0-9]{1,6}$/, { message: "invoicePrefix must be 1-6 capital letters or digits" }) invoicePrefix!: string;
}
