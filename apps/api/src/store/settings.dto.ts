import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { IN_STATES } from "./states";

export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export class UpdateSettingsDto {
  @IsInt() @Min(0) @Max(100_000) shippingFeePaise!: number;
  // 0 means delivery is never free.
  @IsInt() @Min(0) @Max(100_000_000) freeShippingOverPaise!: number;

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
