import { Equals, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MaxLength(128) password!: string;
  // Ticked on the sign-up form; recorded with the time so we can show when the terms were accepted.
  @Equals(true, { message: "Please accept the Terms & Conditions and Privacy Policy" }) termsAccepted!: boolean;
}

export class SendOtpDto {
  @IsString() @MaxLength(30) phone!: string;
  @IsIn(["login", "signup"]) purpose!: "login" | "signup";
}

export class VerifyOtpDto {
  @IsString() @MaxLength(30) phone!: string;
  @IsIn(["login", "signup"]) purpose!: "login" | "signup";
  @IsString() @Matches(/^\d{6}$/, { message: "Enter the 6-digit code" }) code!: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() termsAccepted?: boolean;
}

export class SetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}

export class AddEmailDto {
  @IsEmail() email!: string;
}

export class PhoneLinkDto {
  @IsString() @MaxLength(30) phone!: string;
}

export class PhoneLinkVerifyDto extends PhoneLinkDto {
  @IsString() @Matches(/^\d{6}$/, { message: "Enter the 6-digit code" }) code!: string;
}

export class GoogleDto {
  @IsString() @Length(20, 4096) credential!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MaxLength(128) password!: string;
}

export class TokenDto {
  @IsString() @MinLength(20) @MaxLength(100) token!: string;
}

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
