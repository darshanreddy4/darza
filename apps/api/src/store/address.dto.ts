import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { IN_STATES } from "./states";

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(30) label?: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @Matches(/^[6-9]\d{9}$/, { message: "phone must be a valid 10-digit Indian mobile number" }) phone!: string;
  @IsString() @MinLength(3) @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(1) @MaxLength(80) city!: string;
  @IsIn(IN_STATES) state!: string;
  @Matches(/^[1-9]\d{5}$/, { message: "Enter a valid 6-digit PIN code" }) pincode!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
