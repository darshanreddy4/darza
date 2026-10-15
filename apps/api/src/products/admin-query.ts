import type { Prisma } from "@prisma/client";

// Matches the red "low" highlight in the admin table.
export const LOW_STOCK_MAX = 5;

export const SORT_FIELDS = ["updated", "created", "name", "price", "stock"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type StockFilter = "in" | "low" | "out";

export interface AdminProductQuery {
  q?: string;
  type?: "OWN" | "AFFILIATE";
  status?: "PUBLISHED" | "DRAFT";
  stock?: StockFilter;
  minPricePaise?: number;
  maxPricePaise?: number;
  sort: SortField;
  dir: "asc" | "desc";
}

const intOrUndefined = (v?: string) => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
};

// Unknown or malformed values are ignored rather than rejected, so a stale bookmark still loads.
export function parseAdminProductQuery(raw: Record<string, string | undefined>): AdminProductQuery {
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
  const sort = pick(raw.sort, SORT_FIELDS) ?? "updated";
  const dir = pick(raw.dir, ["asc", "desc"] as const) ?? "desc";
  return {
    q: raw.q?.trim().slice(0, 100) || undefined,
    type: pick(raw.type, ["OWN", "AFFILIATE"] as const),
    status: pick(raw.status, ["PUBLISHED", "DRAFT"] as const),
    stock: pick(raw.stock, ["in", "low", "out"] as const),
    minPricePaise: intOrUndefined(raw.minPricePaise),
    maxPricePaise: intOrUndefined(raw.maxPricePaise),
    sort,
    dir,
  };
}

export function buildAdminProductQuery(query: AdminProductQuery, lowStockMax = LOW_STOCK_MAX): { where: Prisma.ProductWhereInput; orderBy: Prisma.ProductOrderByWithRelationInput[] } {
  const and: Prisma.ProductWhereInput[] = [];

  if (query.q) {
    and.push({ OR: [
      { name: { contains: query.q, mode: "insensitive" } },
      { slug: { contains: query.q, mode: "insensitive" } },
      { brand: { contains: query.q, mode: "insensitive" } },
      { sku: { contains: query.q, mode: "insensitive" } },
    ] });
  }
  if (query.type) and.push({ productType: query.type });
  if (query.status) and.push({ status: query.status });

  // Only our own products track stock, so a stock filter implies that type.
  if (query.stock) {
    and.push({ productType: "OWN" });
    and.push({ stock: query.stock === "in" ? { gt: 0 } : query.stock === "low" ? { gte: 1, lte: lowStockMax } : { lte: 0 } });
  }

  if (query.minPricePaise !== undefined || query.maxPricePaise !== undefined) {
    and.push({ pricePaise: { ...(query.minPricePaise !== undefined && { gte: query.minPricePaise }), ...(query.maxPricePaise !== undefined && { lte: query.maxPricePaise }) } });
  }

  const dir = query.dir;
  const primary: Prisma.ProductOrderByWithRelationInput =
    query.sort === "price" ? { pricePaise: dir }
    : query.sort === "name" ? { name: dir }
    : query.sort === "created" ? { createdAt: dir }
    : query.sort === "stock" ? { stock: { sort: dir, nulls: "last" } }
    : { updatedAt: dir };

  // id keeps the order stable when many products share a price or stock level.
  return { where: and.length ? { AND: and } : {}, orderBy: [primary, { id: "asc" }] };
}
