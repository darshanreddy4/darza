import { toCsv } from "../users/csv";

// The spreadsheet columns, in the order they are exported. An import may use any subset, but it must include slug.
export const PRODUCT_COLUMNS = ["slug", "name", "type", "status", "category", "brand", "sku", "price", "mrp", "cost", "stock", "gst_percent", "featured", "platform", "affiliate_url", "highlights", "images", "description"] as const;

export const MAX_IMPORT_ROWS = 2000;

// RFC 4180: quoted cells may hold commas, quotes ("") and line breaks.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  // Spreadsheets leave empty lines at the bottom.
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ProductRecord { line: number; cells: Record<string, string> }

export function readProductSheet(csv: string): { header: string[]; records: ProductRecord[] } {
  const [head = [], ...body] = parseCsv(csv);
  const header = head.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const records = body.map((cells, i) => ({ line: i + 2, cells: Object.fromEntries(header.map((h, col) => [h, (cells[col] ?? "").trim()])) }));
  return { header, records };
}

// "1499", "1,499.50" or "₹1499" to paise; null when it is not a plain amount.
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

// The export puts a quote in front of text a spreadsheet would run as a formula; take it off again.
const unquote = (s: string) => s.replace(/^'(?=[=+\-@\t\r])/, "");

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0"]);

export interface RowChanges {
  slug: string;
  // Only the cells that were filled in; a blank cell leaves an existing product as it is.
  values: Record<string, unknown>;
  categoryRef?: string;
  errors: string[];
}

export function rowChanges(cells: Record<string, string>): RowChanges {
  const errors: string[] = [];
  const values: Record<string, unknown> = {};
  const slug = (cells.slug ?? "").toLowerCase();
  if (!slug) errors.push("slug is empty");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push("slug may only use lowercase letters, numbers and single hyphens");

  const text = (col: string, key: string) => { if (cells[col]) values[key] = unquote(cells[col]); };
  text("name", "name"); text("brand", "brand"); text("sku", "sku"); text("platform", "platform"); text("description", "description");
  text("affiliate_url", "affiliateUrl");

  if (cells.type) {
    const t = cells.type.toUpperCase();
    if (t === "OWN" || t === "AFFILIATE") values.productType = t; else errors.push("type must be OWN or AFFILIATE");
  }
  if (cells.status) {
    const s = cells.status.toUpperCase();
    if (s === "PUBLISHED" || s === "DRAFT") values.status = s; else errors.push("status must be PUBLISHED or DRAFT");
  }
  for (const [col, key] of [["price", "pricePaise"], ["mrp", "mrpPaise"], ["cost", "costPaise"]] as const) {
    if (!cells[col]) continue;
    const paise = parseMoney(cells[col]);
    if (paise === null) errors.push(`${col} must be an amount such as 1499 or 1499.50`); else values[key] = paise;
  }
  if (cells.stock) {
    if (/^\d+$/.test(cells.stock)) values.stock = Number(cells.stock); else errors.push("stock must be a whole number");
  }
  if (cells.gst_percent) {
    const g = Number(cells.gst_percent.replace("%", ""));
    if ([0, 5, 12, 18, 28].includes(g)) values.gstRatePercent = g; else errors.push("gst_percent must be 0, 5, 12, 18 or 28");
  }
  if (cells.featured) {
    const f = cells.featured.toLowerCase();
    if (YES.has(f)) values.featured = true; else if (NO.has(f)) values.featured = false; else errors.push("featured must be yes or no");
  }
  const list = (col: string) => (cells[col] ?? "").split("|").map((s) => unquote(s.trim())).filter(Boolean);
  if (cells.highlights) values.highlights = list("highlights");
  if (cells.images) values.images = list("images").map((url) => ({ url }));

  return { slug, values, categoryRef: cells.category || undefined, errors };
}

export interface ExportProduct {
  slug: string; name: string; productType: string; status: string; brand: string | null; sku: string | null;
  pricePaise: number; mrpPaise: number | null; costPaise: number | null; stock: number | null; gstRatePercent: number; featured: boolean;
  platform: string | null; affiliateUrl: string | null; highlights: string[]; description: string;
  category: { slug: string }; images: { url: string }[];
}

const rupees = (paise: number | null) => (paise === null ? "" : (paise / 100).toFixed(2));

export function productsToCsv(products: ExportProduct[]): string {
  return toCsv([...PRODUCT_COLUMNS], products.map((p) => [
    p.slug, p.name, p.productType, p.status, p.category.slug, p.brand ?? "", p.sku ?? "", rupees(p.pricePaise), rupees(p.mrpPaise), rupees(p.costPaise),
    p.stock ?? "", p.gstRatePercent, p.featured ? "yes" : "no", p.platform ?? "", p.affiliateUrl ?? "", p.highlights.join(" | "), p.images.map((i) => i.url).join(" | "), p.description,
  ]));
}
