import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseMoney, productsToCsv, readProductSheet, rowChanges, type ExportProduct } from "./product-csv";

test("quoted cells keep commas, quotes and line breaks", () => {
  const rows = parseCsv('slug,name,description\r\nkettle,"Kettle, 1.5L","Says ""hot""\nand loud"\r\n');
  assert.deepEqual(rows, [["slug", "name", "description"], ["kettle", "Kettle, 1.5L", 'Says "hot"\nand loud']]);
});

test("a byte order mark and blank lines are ignored", () => {
  assert.deepEqual(parseCsv("\uFEFFslug,name\n\na,b\n,\n"), [["slug", "name"], ["a", "b"]]);
});

test("headers are matched however they are capitalised or spaced", () => {
  const { header, records } = readProductSheet("Slug, GST Percent ,Affiliate-URL\nkettle,18,https://x.test\n");
  assert.deepEqual(header, ["slug", "gst_percent", "affiliate_url"]);
  assert.equal(records[0].line, 2);
  assert.equal(records[0].cells.gst_percent, "18");
});

test("money is read as rupees and stored as paise", () => {
  assert.equal(parseMoney("1499"), 149900);
  assert.equal(parseMoney("₹1,499.50"), 149950);
  assert.equal(parseMoney("12.5"), 1250);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney("-5"), null);
  assert.equal(parseMoney("1.999"), null);
});

test("filled cells become typed values and blank cells are left out", () => {
  const r = rowChanges({ slug: "Kettle-1", name: "Kettle", type: "own", status: "published", price: "1,499", mrp: "", stock: "7", gst_percent: "18%", featured: "Yes", highlights: "Fast | Quiet", images: "https://a.test/1.jpg | https://a.test/2.jpg" });
  assert.deepEqual(r.errors, []);
  assert.equal(r.slug, "kettle-1");
  assert.deepEqual(r.values, { name: "Kettle", productType: "OWN", status: "PUBLISHED", pricePaise: 149900, stock: 7, gstRatePercent: 18, featured: true, highlights: ["Fast", "Quiet"], images: [{ url: "https://a.test/1.jpg" }, { url: "https://a.test/2.jpg" }] });
  assert.ok(!("mrpPaise" in r.values));
});

test("bad cells are reported in plain words", () => {
  const r = rowChanges({ slug: "Bad Slug", type: "gift", status: "live", price: "cheap", stock: "2.5", gst_percent: "7", featured: "maybe" });
  assert.equal(r.errors.length, 7);
  assert.ok(r.errors.some((e) => e.startsWith("slug may only")));
  assert.ok(r.errors.includes("type must be OWN or AFFILIATE"));
  assert.ok(r.errors.includes("price must be an amount such as 1499 or 1499.50"));
  assert.ok(rowChanges({ slug: "" }).errors.includes("slug is empty"));
});

test("the export round-trips through the reader and neutralises formulas", () => {
  const product: ExportProduct = {
    slug: "kettle", name: "=SUM(A1)", productType: "OWN", status: "PUBLISHED", brand: null, sku: "K-1", pricePaise: 149900, mrpPaise: null, costPaise: 90000, stock: 7,
    gstRatePercent: 18, featured: true, platform: null, affiliateUrl: null, highlights: ["Fast", "Quiet"], description: "Boils, quickly", category: { slug: "home" }, images: [{ url: "https://a.test/1.jpg" }],
  };
  const { records } = readProductSheet(productsToCsv([product]));
  const c = records[0].cells;
  assert.equal(c.name, "'=SUM(A1)");
  assert.equal(c.price, "1499.00");
  assert.equal(c.mrp, "");
  assert.equal(c.description, "Boils, quickly");
  assert.equal(c.highlights, "Fast | Quiet");
  assert.equal(c.category, "home");
  assert.deepEqual(rowChanges(c).values.highlights, ["Fast", "Quiet"]);
  assert.equal(rowChanges(c).values.name, "=SUM(A1)");
});
