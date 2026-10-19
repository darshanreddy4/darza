// What a product's pack size is measured in depends on the product: gadgets by count, a shampoo in ml, groceries in grams or litres.
export type PackKind = "none" | "pieces" | "volume" | "weight" | "custom";

export const PACK_KINDS: { value: PackKind; label: string }[] = [
  { value: "none", label: "Not shown" },
  { value: "pieces", label: "Quantity (pieces), for gadgets and electricals" },
  { value: "volume", label: "Volume (ml or L), for shampoo, oil, drinks" },
  { value: "weight", label: "Weight (g or kg), for groceries and food" },
  { value: "custom", label: "Something else (type it)" },
];

export const PACK_UNITS: Record<"volume" | "weight", string[]> = { volume: ["ml", "L"], weight: ["g", "kg"] };

const UNIT_NAMES: Record<string, { kind: "pieces" | "volume" | "weight"; unit: string }> = {
  ml: { kind: "volume", unit: "ml" }, l: { kind: "volume", unit: "L" }, litre: { kind: "volume", unit: "L" }, litres: { kind: "volume", unit: "L" }, liter: { kind: "volume", unit: "L" }, liters: { kind: "volume", unit: "L" },
  g: { kind: "weight", unit: "g" }, gm: { kind: "weight", unit: "g" }, gram: { kind: "weight", unit: "g" }, grams: { kind: "weight", unit: "g" }, kg: { kind: "weight", unit: "kg" }, kgs: { kind: "weight", unit: "kg" },
  pc: { kind: "pieces", unit: "" }, pcs: { kind: "pieces", unit: "" }, piece: { kind: "pieces", unit: "" }, pieces: { kind: "pieces", unit: "" }, unit: { kind: "pieces", unit: "" }, units: { kind: "pieces", unit: "" },
};

export interface PackParts { kind: PackKind; amount: string; unit: string; custom: string }

// Reads a saved pack size such as "1750 ml", "2 pieces" or "600 ml, 800 ml" back into its parts for editing.
export function parsePack(text: string | null | undefined): PackParts {
  const t = (text ?? "").trim();
  if (!t) return { kind: "none", amount: "1", unit: "ml", custom: "" };
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/.exec(t);
  const hit = m ? UNIT_NAMES[m[2].toLowerCase()] : undefined;
  if (m && hit) return { kind: hit.kind, amount: m[1], unit: hit.unit || (hit.kind === "volume" ? "ml" : "g"), custom: "" };
  return { kind: "custom", amount: "1", unit: "ml", custom: t };
}

// The text shown on the product: "1 piece", "3 pieces", "750 ml", "1.5 kg".
export function formatPack(p: PackParts): string {
  const amount = p.amount.trim();
  if (p.kind === "none") return "";
  if (p.kind === "custom") return p.custom.trim();
  if (!amount || Number(amount) <= 0) return "";
  if (p.kind === "pieces") return Number(amount) === 1 ? "1 piece" : `${amount} pieces`;
  return `${amount} ${p.unit}`;
}

// What to call the size options for a product: capacity for liquids, weight for food, pack for counted goods.
export function packLabel(text: string | null | undefined): string {
  const { kind } = parsePack(text);
  return kind === "volume" ? "Capacity" : kind === "weight" ? "Weight" : kind === "pieces" ? "Pack" : "Size";
}
