import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseMoney, parseOptionsCell, productsToCsv, readProductSheet, rowChanges, type ExportProduct } from "./product-csv";

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

test("the HSN code must be 4, 6 or 8 digits", () => {
  assert.equal(rowChanges({ slug: "a", hsn: "8504" }).values.hsnCode, "8504");
  assert.equal(rowChanges({ slug: "a", hsn: "8504 40 90" }).values.hsnCode, "85044090");
  assert.deepEqual(rowChanges({ slug: "a", hsn: "" }).values, {});
  assert.ok(rowChanges({ slug: "a", hsn: "85" }).errors.includes("hsn must be 4, 6 or 8 digits"));
  assert.ok(rowChanges({ slug: "a", hsn: "85044" }).errors.length > 0);
  assert.ok(rowChanges({ slug: "a", hsn: "ABCD" }).errors.length > 0);
});

test("the options cell lists each option with its values, price, MRP, stock and cost", () => {
  const r = parseOptionsCell("Black > L ; 499 ; 799 ; 3 ; 300 | Blue > XL ; 1,549.50 ;  ; 0");
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.options, [
    { values: ["Black", "L"], pricePaise: 49900, mrpPaise: 79900, stock: 3, costPaise: 30000 },
    { values: ["Blue", "XL"], pricePaise: 154950, stock: 0 },
  ]);
  assert.deepEqual(parseOptionsCell("20W ; 799 ; ; 4").options[0].values, ["20W"]);
  assert.deepEqual(parseOptionsCell(" - "), { options: [], errors: [] });
});

test("mistakes in the options cell are named", () => {
  assert.ok(parseOptionsCell("L ; cheap ; ; 3").errors[0].includes("price of \"L\""));
  assert.ok(parseOptionsCell("L ; 499 ; ; some").errors[0].includes("stock of \"L\""));
  assert.ok(parseOptionsCell("L ; 499 ; x ; 3").errors[0].includes("MRP"));
  assert.ok(parseOptionsCell("L ; 499 ; ; 3 ; y").errors[0].includes("cost"));
  assert.ok(parseOptionsCell("; 499 ; ; 3").errors[0].includes("needs its values"));
  assert.ok(parseOptionsCell("Black > ; 499 ; ; 3").errors[0].includes("needs its values"));
  assert.ok(parseOptionsCell(" | ").errors[0].includes("no options found"));
});

test("a row can name its options and a dash removes them", () => {
  const r = rowChanges({ slug: "tee", option_names: "Colour | Size", options: "Black > L ; 499 ; ; 3" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.values.optionNames, ["Colour", "Size"]);
  assert.equal((r.values.options as unknown[]).length, 1);
  const gone = rowChanges({ slug: "tee", options: "-" });
  assert.deepEqual([gone.values.options, gone.values.optionNames], [[], []]);
  assert.ok(rowChanges({ slug: "tee", options: "L ; x ; ; 1" }).errors.length > 0);
  assert.ok(!("options" in rowChanges({ slug: "tee", options: "" }).values));
});

test("options export in the form the import reads", () => {
  const product: ExportProduct = {
    slug: "tee", name: "Tee", productType: "OWN", status: "PUBLISHED", brand: null, sku: "T-1", pricePaise: 49900, mrpPaise: 79900, costPaise: null, stock: 5,
    gstRatePercent: 18, featured: false, platform: null, affiliateUrl: null, highlights: [], description: "A tee", category: { slug: "clothes" }, images: [],
    optionNames: ["Colour", "Size"],
    options: [{ label: "Black / L", values: ["Black", "L"], pricePaise: 49900, mrpPaise: 79900, stock: 3, costPaise: null }, { label: "Blue / XL", values: ["Blue", "XL"], pricePaise: 54900, mrpPaise: null, stock: 2, costPaise: 30000 }],
  };
  const c = readProductSheet(productsToCsv([product])).records[0].cells;
  assert.equal(c.option_names, "Colour | Size");
  assert.equal(c.options, "Black > L ; 499.00 ; 799.00 ; 3 | Blue > XL ; 549.00 ;  ; 2 ; 300.00");
  assert.deepEqual(parseOptionsCell(c.options).options.map((o) => o.pricePaise), [49900, 54900]);
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

test("an option can list its SKU and weight after the cost, and an export reads back the same", () => {
  const parsed = parseOptionsCell("Black > L ; 499 ; 799 ; 3 ; 300 ; TEE-BL-L ; 250 | Blue > XL ; 549 ; ; 2");
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual([parsed.options[0].sku, parsed.options[0].weightGrams, parsed.options[1].sku, parsed.options[1].weightGrams], ["TEE-BL-L", 250, undefined, undefined]);
  assert.ok(parseOptionsCell("L ; 499 ; ; 3 ; ; bad sku ; 5").errors[0].includes("SKU"));
  assert.ok(parseOptionsCell("L ; 499 ; ; 3 ; ; S-1 ; heavy").errors[0].includes("weight"));
  assert.ok(parseOptionsCell("L ; 499 ; ; 3 ; ; S-1 ; 0").errors[0].includes("weight"));
});

test("a product weight comes from the weight_g column", () => {
  assert.equal(rowChanges({ slug: "a", weight_g: "1200" }).values.weightGrams, 1200);
  assert.equal(rowChanges({ slug: "a", weight_g: "250 g" }).values.weightGrams, 250);
  assert.ok(rowChanges({ slug: "a", weight_g: "1.5" }).errors[0].includes("weight_g"));
});
