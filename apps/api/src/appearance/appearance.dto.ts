import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { CURRENCY_CODES, MAX_CURRENCIES, THEME_KEYS } from "./appearance";

export class UpdateAppearanceDto {
  @IsOptional() @IsIn(THEME_KEYS) theme?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_CURRENCIES + 1) @IsIn(CURRENCY_CODES, { each: true }) currencyCodes?: string[];
  @IsOptional() @IsString() currencyDefault?: string;
  // Rupees for one unit of a currency, for example { USD: 83.5 }; null removes the manual rate and goes back to the live one.
  @IsOptional() @IsObject() manualRates?: Record<string, number | null>;
}
