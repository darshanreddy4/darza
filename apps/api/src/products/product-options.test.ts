import assert from "node:assert/strict";
import test from "node:test";
import { chooseOption, lineKey, publicOptions, shapeOptions, summariseOptions } from "./product-options";
import { itemName } from "./stock";

const rice = [
  { id: "a", label: "1 kg", values: ["1 kg"], imageUrl: null, pricePaise: 8000, mrpPaise: 9000, stock: 10 },
  { id: "b", label: "25 kg", values: ["25 kg"], imageUrl: null, pricePaise: 180000, mrpPaise: 210000, stock: 4 },
  { id: "c", label: "50 kg", values: ["50 kg"], imageUrl: null, pricePaise: 340000, mrpPaise: null, stock: 0 },
];

test("the product shows the lowest option price, that option's MRP and the total stock", () => {
  assert.deepEqual(summariseOptions(rice), { pricePaise: 8000, mrpPaise: 9000, stock: 14 });
  assert.equal(summariseOptions([{ pricePaise: 500, stock: 1 }, { pricePaise: 300, stock: 2 }]).mrpPaise, null);
});

test("any kind of option works: sizes, wattage, battery", () => {
  const tee = shapeOptions(["Size"], [{ values: ["L"], pricePaise: 49900, stock: 5 }, { values: ["XXXL"], pricePaise: 54900, stock: 2 }]);
  assert.deepEqual(tee.errors, []);
  assert.deepEqual(tee.options.map((o) => o.label), ["L", "XXXL"]);
  const charger = shapeOptions(["Wattage"], [{ values: ["20W"], pricePaise: 79900, stock: 1 }, { values: ["40W"], pricePaise: 129900, stock: 1 }]);
  assert.deepEqual([charger.names, charger.errors], [["Wattage"], []]);
  const phone = shapeOptions([" Battery  "], [{ label: "5000 mAh", pricePaise: 1, stock: 1 }]);
  assert.deepEqual([phone.names, phone.options[0].values], [["Battery"], ["5000 mAh"]]);
});

test("two kinds give one value each, joined into the label", () => {
  const shirt = shapeOptions(["Colour", "Size"], [{ values: ["Black", "L"], pricePaise: 100, stock: 1 }, { values: ["Black", "XL"], pricePaise: 100, stock: 1 }]);
  assert.deepEqual(shirt.errors, []);
  assert.deepEqual(shirt.options.map((o) => o.label), ["Black / L", "Black / XL"]);
  assert.ok(shapeOptions(["Colour", "Size"], [{ values: ["Black"], pricePaise: 1, stock: 1 }]).errors[0].includes("Colour and a Size"));
  assert.ok(shapeOptions(["A", "B", "C"], [{ values: ["1", "2", "3"], pricePaise: 1, stock: 1 }]).errors.some((e) => e.includes("at most 2")));
  assert.ok(shapeOptions(["Size", "size"], [{ values: ["a", "b"], pricePaise: 1, stock: 1 }]).errors.some((e) => e.includes("different name")));
});

test("options made before kinds had names are called Size", () => {
  const old = shapeOptions(undefined, [{ label: "1 kg", pricePaise: 1, stock: 1 }]);
  assert.deepEqual([old.names, old.errors], [["Size"], []]);
  assert.ok(shapeOptions(undefined, [{ values: ["Black", "L"], pricePaise: 1, stock: 1 }]).errors[0].includes("Name what the customer chooses"));
});

test("options need a value, a unique label and an MRP that is not below the price", () => {
  assert.deepEqual(shapeOptions(["Size"], []).errors, []);
  assert.ok(shapeOptions(["Size"], [{ values: [" "], pricePaise: 1, stock: 1 }]).errors[0].includes("Every option needs"));
  assert.ok(shapeOptions(["Size"], [{ values: ["L"], pricePaise: 1, stock: 1 }, { values: ["l"], pricePaise: 2, stock: 1 }]).errors[0].includes("listed twice"));
  assert.ok(shapeOptions(["Size"], [{ values: ["L"], pricePaise: 500, mrpPaise: 400, stock: 1 }]).errors[0].includes("MRP"));
  assert.ok(shapeOptions(["Size"], Array.from({ length: 61 }, (_, i) => ({ values: [`o${i}`], pricePaise: 1, stock: 1 }))).errors[0].includes("up to 60"));
});

test("a product with options needs one chosen, and one without must not name any", () => {
  assert.deepEqual(chooseOption(rice, "b"), { ok: true, option: rice[1] });
  assert.deepEqual(chooseOption(rice), { ok: false, reason: "CHOOSE" });
  assert.deepEqual(chooseOption(rice, "zzz"), { ok: false, reason: "UNKNOWN" });
  assert.deepEqual(chooseOption([], undefined), { ok: true, option: null });
  assert.deepEqual(chooseOption([], "a"), { ok: false, reason: "UNKNOWN" });
});

test("each option of a product is its own basket line", () => {
  assert.notEqual(lineKey("p1", "a"), lineKey("p1", "b"));
  assert.equal(lineKey("p1"), "p1");
  assert.equal(lineKey("p1", null), "p1");
});

test("shoppers get names, prices, picture and whether it is in stock, never the exact stock", () => {
  assert.deepEqual(publicOptions(rice)[2], { id: "c", label: "50 kg", values: ["50 kg"], imageUrl: null, pricePaise: 340000, mrpPaise: null, inStock: false });
  assert.equal("stock" in publicOptions(rice)[0], false);
  assert.deepEqual(publicOptions([{ ...rice[0], values: [] }])[0].values, ["1 kg"]);
});

test("an order line reads with its option", () => {
  assert.equal(itemName("Basmati Rice", "25 kg"), "Basmati Rice (25 kg)");
  assert.equal(itemName("T-Shirt", "Black / L"), "T-Shirt (Black / L)");
  assert.equal(itemName("Basmati Rice", null), "Basmati Rice");
});

test("each option can carry its own SKU and weight, and one SKU cannot be on two options", () => {
  const ok = shapeOptions(["Size"], [{ values: ["L"], pricePaise: 100, stock: 1, sku: " TEE-L ", weightGrams: 250 }, { values: ["XL"], pricePaise: 100, stock: 1 }]);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual([ok.options[0].sku, ok.options[0].weightGrams, ok.options[1].sku, ok.options[1].weightGrams], ["TEE-L", 250, null, null]);
  const twice = shapeOptions(["Size"], [{ values: ["L"], pricePaise: 100, stock: 1, sku: "TEE-1" }, { values: ["XL"], pricePaise: 100, stock: 1, sku: "tee-1" }]);
  assert.ok(twice.errors.some((e) => e.includes("used on two options")));
});
