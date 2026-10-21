// What a customer chooses between for one product (a size, a colour, a wattage, a battery) and what each choice costs.
// The admin names the choices; there are one or two kinds, like Colour and Size.

export const MAX_OPTIONS = 60;
export const MAX_KINDS = 2;

export interface OptionInput {
  id?: string;
  label?: string;
  values?: string[];
  pricePaise: number;
  mrpPaise?: number | null;
  stock: number;
  costPaise?: number | null;
  imageUrl?: string | null;
  sku?: string | null;
  weightGrams?: number | null;
}

export interface ShapedOption {
  id?: string;
  label: string;
  values: string[];
  pricePaise: number;
  mrpPaise: number | null;
  stock: number;
  costPaise: number | null;
  imageUrl: string | null;
  sku: string | null;
  weightGrams: number | null;
}

export const cleanLabel = (label: string) => label.trim().replace(/\s+/g, " ");

// Checks the admin's options and puts them in the form stored: named kinds, one value per kind, and a label made of the values.
// A single unnamed kind (options made before kinds had names) is called "Size". Problems are things the admin can fix.
export function shapeOptions(names: string[] | undefined, options: OptionInput[]): { names: string[]; options: ShapedOption[]; errors: string[] } {
  if (options.length === 0) return { names: [], options: [], errors: [] };
  const errors: string[] = [];
  if (options.length > MAX_OPTIONS) errors.push(`A product can have up to ${MAX_OPTIONS} options`);

  const given = (names ?? []).map(cleanLabel).filter(Boolean);
  const valuesOf = options.map((o) => (o.values?.length ? o.values : [o.label ?? ""]).map(cleanLabel));
  let kinds = given;
  if (kinds.length === 0) {
    if (valuesOf[0].length === 1) kinds = ["Size"];
    else errors.push("Name what the customer chooses, like Size or Colour");
  }
  if (kinds.length > MAX_KINDS) errors.push(`Use at most ${MAX_KINDS} kinds of option, like Colour and Size`);
  if (new Set(kinds.map((k) => k.toLowerCase())).size !== kinds.length) errors.push("Each kind of option needs a different name");

  const seen = new Set<string>();
  const skus = new Set<string>();
  let incomplete = false;
  const shaped = options.map((o, n) => {
    const values = valuesOf[n];
    if (values.length !== kinds.length || values.some((v) => !v)) incomplete = true;
    const label = values.join(" / ");
    if (values.length > 0 && values.every(Boolean)) {
      if (seen.has(label.toLowerCase())) errors.push(`The option "${label}" is listed twice`);
      seen.add(label.toLowerCase());
    }
    if (o.mrpPaise != null && o.mrpPaise < o.pricePaise) errors.push(`The MRP of "${label}" cannot be lower than its price`);
    const sku = o.sku?.trim() || null;
    if (sku) {
      if (skus.has(sku.toLowerCase())) errors.push(`The SKU "${sku}" is used on two options`);
      skus.add(sku.toLowerCase());
    }
    return { id: o.id, label, values, pricePaise: o.pricePaise, mrpPaise: o.mrpPaise ?? null, stock: o.stock, costPaise: o.costPaise ?? null, imageUrl: o.imageUrl || null, sku, weightGrams: o.weightGrams ?? null };
  });
  if (incomplete && kinds.length) errors.push(`Every option needs a ${kinds.join(" and a ")}`);
  return { names: kinds, options: shaped, errors };
}

// The product itself shows the lowest price (with that option's MRP) and the total stock, so lists, sorting and stock alerts keep working.
export function summariseOptions(options: { pricePaise: number; mrpPaise?: number | null; stock: number }[]) {
  const cheapest = options.reduce((best, o) => (o.pricePaise < best.pricePaise ? o : best), options[0]);
  return {
    pricePaise: cheapest.pricePaise,
    mrpPaise: cheapest.mrpPaise ?? null,
    stock: options.reduce((n, o) => n + o.stock, 0),
  };
}

export const lineKey = (productId: string, optionId?: string | null) => (optionId ? `${productId}:${optionId}` : productId);

export type OptionChoice<T extends { id: string }> = { ok: true; option: T | null } | { ok: false; reason: "CHOOSE" | "UNKNOWN" };

// Which option a basket line means: a product with options needs one, a product without must not name one.
export function chooseOption<T extends { id: string }>(options: T[], optionId?: string | null): OptionChoice<T> {
  if (options.length === 0) return optionId ? { ok: false, reason: "UNKNOWN" } : { ok: true, option: null };
  if (!optionId) return { ok: false, reason: "CHOOSE" };
  const option = options.find((o) => o.id === optionId);
  return option ? { ok: true, option } : { ok: false, reason: "UNKNOWN" };
}

// What the storefront may see: no cost and no exact stock.
export function publicOptions(options: { id: string; label: string; values: string[]; imageUrl: string | null; pricePaise: number; mrpPaise: number | null; stock: number }[]) {
  return options.map((o) => ({ id: o.id, label: o.label, values: o.values.length ? o.values : [o.label], imageUrl: o.imageUrl, pricePaise: o.pricePaise, mrpPaise: o.mrpPaise, inStock: o.stock > 0 }));
}
