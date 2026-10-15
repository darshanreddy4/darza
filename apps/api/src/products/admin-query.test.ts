import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminProductQuery, parseAdminProductQuery } from "./admin-query";

test("defaults to most recently updated first with no filters", () => {
  const q = parseAdminProductQuery({});
  assert.deepEqual(buildAdminProductQuery(q), { where: {}, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
});

test("ignores unknown or malformed values", () => {
  const q = parseAdminProductQuery({ type: "WRONG", status: "x", stock: "lots", minPricePaise: "-5", maxPricePaise: "abc", sort: "hack", dir: "sideways" });
  assert.deepEqual(q, { q: undefined, type: undefined, status: undefined, stock: undefined, minPricePaise: undefined, maxPricePaise: undefined, sort: "updated", dir: "desc" });
});

test("price range and ascending price sort", () => {
  const { where, orderBy } = buildAdminProductQuery(parseAdminProductQuery({ minPricePaise: "50000", maxPricePaise: "200000", sort: "price", dir: "asc" }));
  assert.deepEqual(where, { AND: [{ pricePaise: { gte: 50000, lte: 200000 } }] });
  assert.deepEqual(orderBy[0], { pricePaise: "asc" });
});

test("only a minimum or only a maximum price", () => {
  assert.deepEqual(buildAdminProductQuery(parseAdminProductQuery({ minPricePaise: "100" })).where, { AND: [{ pricePaise: { gte: 100 } }] });
  assert.deepEqual(buildAdminProductQuery(parseAdminProductQuery({ maxPricePaise: "0" })).where, { AND: [{ pricePaise: { lte: 0 } }] });
});

test("stock filters apply to DMG products only", () => {
  const out = buildAdminProductQuery(parseAdminProductQuery({ stock: "out" })).where;
  assert.deepEqual(out, { AND: [{ productType: "OWN" }, { stock: { lte: 0 } }] });
  const low = buildAdminProductQuery(parseAdminProductQuery({ stock: "low" })).where;
  assert.deepEqual(low, { AND: [{ productType: "OWN" }, { stock: { gte: 1, lte: 5 } }] });
  const inStock = buildAdminProductQuery(parseAdminProductQuery({ stock: "in" })).where;
  assert.deepEqual(inStock, { AND: [{ productType: "OWN" }, { stock: { gt: 0 } }] });
});

test("stock sort keeps affiliate products (no stock) last in both directions", () => {
  assert.deepEqual(buildAdminProductQuery(parseAdminProductQuery({ sort: "stock", dir: "asc" })).orderBy[0], { stock: { sort: "asc", nulls: "last" } });
  assert.deepEqual(buildAdminProductQuery(parseAdminProductQuery({ sort: "stock", dir: "desc" })).orderBy[0], { stock: { sort: "desc", nulls: "last" } });
});

test("type, status and search combine", () => {
  const { where } = buildAdminProductQuery(parseAdminProductQuery({ type: "AFFILIATE", status: "DRAFT", q: "  phone " }));
  assert.deepEqual(where, { AND: [
    { OR: [{ name: { contains: "phone", mode: "insensitive" } }, { slug: { contains: "phone", mode: "insensitive" } }, { brand: { contains: "phone", mode: "insensitive" } }, { sku: { contains: "phone", mode: "insensitive" } }] },
    { productType: "AFFILIATE" },
    { status: "DRAFT" },
  ] });
});
