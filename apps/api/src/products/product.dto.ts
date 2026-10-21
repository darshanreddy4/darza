import { ProductStatus, ProductType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from "class-validator";

export class ProductImageDto {
  // Either a remote HTTPS image or a file served from /uploads.
  @IsString() @MaxLength(2000) @Matches(/^(https:\/\/\S+|\/uploads\/[A-Za-z0-9._-]+)$/) url!: string;
  @IsOptional() @IsString() @MaxLength(200) alt?: string;
}

export class ProductOptionDto {
  // Set when editing an option that already exists, so carts and orders keep pointing at it.
  @IsOptional() @IsString() @MaxLength(40) id?: string;
  // Either the values (one per kind of option, like ["Black", "L"]) or, for a single kind, just a label.
  @IsOptional() @IsString() @MaxLength(40) label?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({ each: true }) @MaxLength(40, { each: true }) values?: string[];
  // One of the product's own pictures.
  @IsOptional() @IsString() @MaxLength(2000) @Matches(/^(https:\/\/\S+|\/uploads\/[A-Za-z0-9._-]+)$/) imageUrl?: string;
  @IsInt() @Min(0) @Max(100_000_000) pricePaise!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) mrpPaise?: number;
  @IsInt() @Min(0) @Max(1_000_000) stock!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) costPaise?: number;
}

export class ProductDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(200) slug!: string;
  @IsString() @MinLength(1) @MaxLength(10_000) description!: string;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @IsObject() specifications?: Record<string, string>;
  @IsString() categoryId!: string;

  @IsEnum(ProductType) productType!: ProductType;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsBoolean() featured?: boolean;

  @IsInt() @Min(0) @Max(100_000_000) pricePaise!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) mrpPaise?: number;
  @IsOptional() @IsString() @MaxLength(100) sellerName?: string;
  @IsOptional() @IsString() @MaxLength(1000) deliveryInfo?: string;
  @IsOptional() @IsString() @MaxLength(1000) returnPolicy?: string;

  @IsOptional() @IsBoolean() showRating?: boolean;
  @IsOptional() @IsString() @MaxLength(40) dealLabel?: string;
  @IsOptional() @IsInt() @Min(0) @Max(30) deliveryDays?: number;
  @IsOptional() @IsBoolean() freeDelivery?: boolean;
  // Heavy or bulky: always pays delivery, deliveryFeePaise (or the store fee when left out) per order.
  @IsOptional() @IsBoolean() chargeDelivery?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) deliveryFeePaise?: number;
  @IsOptional() @IsBoolean() showAddToCart?: boolean;
  @IsOptional() @IsString() @MaxLength(60) packSize?: string;
  @IsOptional() @IsIn(["TOP_DISCOUNT", "LOWEST_PRICE"]) saleTag?: string;
  @IsOptional() @IsBoolean() showSold?: boolean;
  @IsOptional() @IsInt() @Min(2) @Max(10) multiBuyQty?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) multiBuyPercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) salePricePaise?: number;
  @IsOptional() @IsDateString() saleEndsAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(90) returnDays?: number;
  @IsOptional() @IsString() @MaxLength(80) @Matches(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/) variantGroup?: string;
  @IsOptional() @IsString() @MaxLength(40) colorName?: string;
  @IsOptional() @IsString() @MaxLength(200) warranty?: string;
  @IsOptional() @IsString() @MaxLength(1000) manufacturerInfo?: string;
  @IsOptional() @IsInt() @IsIn([0, 5, 12, 18, 28]) gstRatePercent?: number;

  @IsOptional() @IsString() @MaxLength(64) sku?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) costPaise?: number;

  @IsOptional() @IsString() @MaxLength(60) platform?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) affiliateUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) affiliateDisclosure?: string;

  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => ProductImageDto)
  images!: ProductImageDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(500, { each: true })
  videoUrls?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) @MaxLength(400, { each: true })
  highlights?: string[];

  // What the customer chooses between, like Colour and Size, named by the admin. Up to two; each option then has one value per name.
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({ each: true }) @MaxLength(30, { each: true })
  optionNames?: string[];

  // Versions of the product with their own price and stock. Left out means the product's current options stay as they are; an empty list removes them.
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => ProductOptionDto)
  options?: ProductOptionDto[];
}
