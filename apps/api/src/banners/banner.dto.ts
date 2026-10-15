import { BannerTone } from "@prisma/client";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { IsBannerVideoUrl } from "./banner-video";

export const BANNER_POSITIONS = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"] as const;

// An uploaded file or a remote https image.
const IMAGE = /^(https:\/\/\S+|\/uploads\/[A-Za-z0-9._-]+)$/;
// A site path ("/products?type=OWN") or an https URL; protocol-relative "//" links are not allowed.
const LINK = /^(\/(?!\/)\S*|https:\/\/\S+)$/;

export class BannerDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string | null;
  @IsOptional() @IsString() @MaxLength(220) subtitle?: string | null;
  @IsString() @MaxLength(2000) @Matches(IMAGE) imageUrl!: string;
  @IsOptional() @IsString() @MaxLength(40) ctaLabel?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) @Matches(LINK, { message: "linkUrl must be a site path like /products or an https URL" }) linkUrl?: string | null;
  @IsOptional() @IsEnum(BannerTone) textTone?: BannerTone;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsBoolean() showCountdown?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) @IsBannerVideoUrl() videoUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(60) sponsorName?: string | null;
  @IsOptional() @IsIn(BANNER_POSITIONS) textPosition?: string;
  // Null means the button sits under the text.
  @IsOptional() @IsIn(BANNER_POSITIONS) buttonPosition?: string | null;
}

export class ReorderBannersDto {
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) ids!: string[];
}
