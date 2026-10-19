import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const upper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

export class CouponDto {
  @Transform(upper) @IsString() @Matches(/^[A-Z0-9_-]{3,20}$/, { message: "code must be 3-20 letters, digits, - or _" }) code!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsIn(["PERCENT", "FLAT"]) type!: "PERCENT" | "FLAT";
  // Percent 1-100, or paise for a flat amount.
  @IsInt() @Min(1) @Max(100_000_000) value!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) minOrderPaise?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100_000_000) maxDiscountPaise?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) usageLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) perUserLimit?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  // Emails or mobile numbers of the customers who may use the code, separated by commas or new lines; an empty string makes it public again.
  @IsOptional() @IsString() @MaxLength(5000) customers?: string;
  @IsOptional() @IsBoolean() firstOrderOnly?: boolean;
  // Show the code to the customers who can use it (default), or keep it a code they have to be given.
  @IsOptional() @IsBoolean() visible?: boolean;
}
