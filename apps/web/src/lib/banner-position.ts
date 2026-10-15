export const BANNER_POSITIONS = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
] as const;
export type BannerPosition = (typeof BANNER_POSITIONS)[number];

export const DEFAULT_TEXT_POSITION: BannerPosition = "middle-left";

export const isBannerPosition = (v: unknown): v is BannerPosition => BANNER_POSITIONS.includes(v as BannerPosition);

export function splitPosition(pos: BannerPosition) {
  const [v, h] = pos.split("-") as ["top" | "middle" | "bottom", "left" | "center" | "right"];
  return { v, h };
}
