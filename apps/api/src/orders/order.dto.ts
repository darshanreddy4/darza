import { Type } from "class-transformer";
import { IN_STATES } from "../store/states";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { OrderStatus } from "@prisma/client";
import { CANCEL_REASONS } from "./cancel";
import { RETURN_REASONS, UPI_PATTERN, type ReturnAction } from "./returns";

export class OrderItemDto {
  @IsString() productId!: string;
  // The size or weight chosen, for a product that has options.
  @IsOptional() @IsString() @MaxLength(40) optionId?: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}

export class ShippingDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @Matches(/^[6-9]\d{9}$/, { message: "phone must be a valid 10-digit Indian mobile number" }) phone!: string;
  @IsString() @MinLength(3) @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MinLength(1) @MaxLength(80) city!: string;
  @IsIn(IN_STATES) state!: string;
  @Matches(/^[1-9]\d{5}$/, { message: "Enter a valid 6-digit PIN code" }) pincode!: string;
}

export class CreateOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ValidateNested() @Type(() => ShippingDto)
  shipping!: ShippingDto;

  // DELIVERY_ADVANCE is for guests: the delivery charge now, the rest in cash on delivery.
  @IsOptional() @IsIn(["COD", "ONLINE", "ADVANCE", "DELIVERY_ADVANCE"]) paymentMethod?: "COD" | "ONLINE" | "ADVANCE" | "DELIVERY_ADVANCE";

  @IsOptional() @IsString() @MaxLength(30) couponCode?: string;

  @IsOptional() @IsBoolean() whatsappUpdates?: boolean;
}

// Prices a basket (goods, coupon, delivery) without placing an order.
export class QuoteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional() @IsString() @MaxLength(30) couponCode?: string;

  // The delivery PIN code, when known, so area delivery fees are included.
  @IsOptional() @Matches(/^[1-9]\d{5}$/) pincode?: string;

  // The way the shopper means to pay, so the pay-on-delivery fee is included when it is COD.
  @IsOptional() @IsIn(["COD", "ONLINE", "ADVANCE", "DELIVERY_ADVANCE"]) paymentMethod?: "COD" | "ONLINE" | "ADVANCE" | "DELIVERY_ADVANCE";
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
  // Courier details, when marking the order shipped.
  @IsOptional() @IsString() @MaxLength(80) courierName?: string;
  @IsOptional() @IsString() @MaxLength(80) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) trackingUrl?: string;
}

// Adds or corrects the courier details of an order that has shipped.
export class TrackingDto {
  @IsOptional() @IsString() @MaxLength(80) courierName?: string;
  @IsOptional() @IsString() @MaxLength(80) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) trackingUrl?: string;
}

// One parcel's tracking number in a bulk shipment.
export class BulkTrackingDto {
  @IsString() @MaxLength(40) id!: string;
  @IsString() @MaxLength(80) trackingNumber!: string;
}

// Orders to mark shipped together with one courier.
export class BulkShipDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(40, { each: true }) ids!: string[];
  @IsOptional() @IsString() @MaxLength(80) courierName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => BulkTrackingDto) trackingNumbers?: BulkTrackingDto[];
  // The courier's tracking page with {number} where the tracking number goes.
  @IsOptional() @IsString() @MaxLength(500) trackingUrlTemplate?: string;
}

export class VerifyPaymentDto {
  @IsString() @MaxLength(100) razorpay_order_id!: string;
  @IsString() @MaxLength(100) razorpay_payment_id!: string;
  @IsString() @MaxLength(200) razorpay_signature!: string;
}

export class ReturnItemDto {
  @IsString() @MaxLength(40) orderItemId!: string;
  @IsInt() @Min(1) @Max(99) quantity!: number;
}

export class RequestReturnDto {
  @IsIn([...RETURN_REASONS]) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  // Which items and how many; leaving it out returns everything that can still be returned.
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ReturnItemDto)
  items?: ReturnItemDto[];
  // Where to send the money for a pay-on-delivery order; required for those, ignored for online payments.
  @IsOptional() @IsString() @Matches(UPI_PATTERN, { message: "Enter a valid UPI ID, like name@bank" }) upiId?: string;
}

export class CancelOrderDto {
  @IsIn([...CANCEL_REASONS]) reason!: string;
  @IsOptional() @IsString() @MaxLength(200) details?: string;
}

export class DecideReturnDto {
  @IsIn(["approve", "reject", "refund", "paid"]) action!: ReturnAction;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  // For "paid": the UPI transaction reference of the payout.
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}
