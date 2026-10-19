import assert from "node:assert/strict";
import test from "node:test";
import { CacheService } from "../cache/cache.service";
import { PINCODE_FORMAT, knownState, parsePostOfficeAnswer, prefixInfo, stateFitsPincode } from "./pincode";
import { PincodeService } from "./pincode.service";

test("a PIN code is six digits and does not start with zero", () => {
  for (const ok of ["411001", "110001", "682553"]) assert.ok(PINCODE_FORMAT.test(ok), ok);
  for (const bad of ["011001", "41100", "4110011", "41100a", "", "4 11001"]) assert.ok(!PINCODE_FORMAT.test(bad), bad);
});

test("the first digits say which states a PIN code can belong to", () => {
  assert.deepEqual(prefixInfo("411001").states, ["Maharashtra"]);
  assert.deepEqual(prefixInfo("110001").states, ["Delhi"]);
  assert.deepEqual(prefixInfo("560001").states, ["Karnataka"]);
  assert.ok(prefixInfo("403001").states.includes("Goa"));
  assert.ok(prefixInfo("248001").states.includes("Uttarakhand"));
  assert.ok(prefixInfo("737101").states.includes("Sikkim"));
  assert.equal(prefixInfo("900001").army, true);
});

test("prefixes India Post does not use are not valid", () => {
  for (const pin of ["100001", "290001", "350001", "540001", "550001", "650001", "660001", "860001", "890001", "041001"]) assert.equal(prefixInfo(pin).known, false, pin);
});

test("India Post's spelling of a state becomes the name the shop uses", () => {
  assert.equal(knownState("Jammu And Kashmir"), "Jammu and Kashmir");
  assert.equal(knownState("Andaman & Nicobar Islands"), "Andaman and Nicobar Islands");
  assert.equal(knownState("Orissa"), "Odisha");
  assert.equal(knownState("Daman and Diu"), "Dadra and Nagar Haveli and Daman and Diu");
  assert.equal(knownState("Somewhere"), "Somewhere");
});

test("a lookup answer is read as found, not found, or not understood", () => {
  const found = parsePostOfficeAnswer([{ Status: "Success", PostOffice: [{ Name: "Pune City", District: "Pune", State: "Maharashtra" }, { Name: "Shaniwar Peth", District: "Pune", State: "Maharashtra" }] }]);
  assert.deepEqual(found, { found: true, city: "Pune", district: "Pune", state: "Maharashtra", areas: ["Pune City", "Shaniwar Peth"] });
  assert.deepEqual(parsePostOfficeAnswer([{ Status: "Error", PostOffice: null }]), { found: false });
  assert.deepEqual(parsePostOfficeAnswer([{ Status: "404", PostOffice: null }]), { found: false });
  assert.equal(parsePostOfficeAnswer([{ Status: "Success", PostOffice: [] }]), null);
  assert.equal(parsePostOfficeAnswer("<html>"), null);
  assert.equal(parsePostOfficeAnswer([]), null);
});

test("a state that does not fit the PIN code is spotted, and unknowns never block", () => {
  assert.equal(stateFitsPincode("Maharashtra", { states: ["Maharashtra"] }), true);
  assert.equal(stateFitsPincode("Kerala", { states: ["Maharashtra"] }), false);
  assert.equal(stateFitsPincode("Kerala", { states: [] }), true);
});

const service = (answer: () => Promise<{ ok: boolean; json(): Promise<unknown> }>) => {
  const s = new PincodeService(new CacheService(null));
  s.fetcher = answer;
  return s;
};

test("the lookup returns the place India Post has on record", async () => {
  const r = await service(async () => ({ ok: true, json: async () => [{ Status: "Success", PostOffice: [{ Name: "Pune City", District: "Pune", State: "Maharashtra" }] }] })).lookup("411001");
  assert.deepEqual([r.valid, r.city, r.state, r.source], [true, "Pune", "Maharashtra", "post-office"]);
});

test("a PIN code India Post has never heard of is refused", async () => {
  const s = service(async () => ({ ok: true, json: async () => [{ Status: "Error", PostOffice: null }] }));
  assert.equal((await s.lookup("411999")).valid, false);
  await assert.rejects(() => s.assertValid("411999"), /couldn't find PIN code 411999/);
  await assert.rejects(() => s.assertValid("12345"), /valid 6-digit/);
});

test("when the lookup is down the first digits decide, so an outage never stops an order", async () => {
  const down = service(async () => { throw new Error("offline"); });
  const r = await down.lookup("411001");
  assert.deepEqual([r.valid, r.state, r.source], [true, "Maharashtra", "region"]);
  assert.equal((await down.lookup("100001")).valid, false);
  const garbage = service(async () => ({ ok: true, json: async () => "oops" }));
  assert.equal((await garbage.lookup("560001")).valid, true);
});
