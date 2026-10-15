export const DEFAULT_BRAND = process.env.BRAND_NAME || "DMG";

// Text typed in the admin can contain {brand}; it is swapped for the current brand name when shown.
export function applyBrand<T>(value: T, brand: string): T {
  if (typeof value === "string") return (value.includes("{brand}") ? value.split("{brand}").join(brand) : value) as T;
  if (Array.isArray(value)) return value.map((v) => applyBrand(v, brand)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyBrand(v, brand)])) as T;
  }
  return value;
}
