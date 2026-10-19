import test from "node:test";
import assert from "node:assert/strict";
import { emailKey, identityMatches, identityOf, phoneKey } from "./identity";

test("email keys ignore case, +tags and Gmail dots", () => {
  assert.equal(emailKey("Jane.Doe+shop@Gmail.com"), "janedoe@gmail.com");
  assert.equal(emailKey("jane.doe@googlemail.com"), "janedoe@gmail.com");
  assert.equal(emailKey("Jane.Doe+x@Example.IN"), "jane.doe@example.in");
  assert.equal(emailKey(" a@b.co "), "a@b.co");
  for (const bad of [null, undefined, "", "nope", "@x.com", "a@", "+tag@x.com"]) assert.equal(emailKey(bad), null, String(bad));
});

test("phone keys are the last ten digits", () => {
  for (const same of ["9876543210", "+91 98765 43210", "09876543210", "(+91)-98765-43210", "+919876543210"]) assert.equal(phoneKey(same), "9876543210", same);
  for (const bad of [null, undefined, "", "12345", "abc"]) assert.equal(phoneKey(bad), null, String(bad));
});

test("an identity matches by account, email and either phone", () => {
  const who = identityOf({ id: "u1", email: "A.B+x@gmail.com", phone: "+919876543210" }, "9123456789");
  assert.deepEqual(identityMatches(who), [
    { userId: "u1" }, { buyerEmailKey: "ab@gmail.com" },
    { buyerPhoneKey: { in: ["9876543210", "9123456789"] } }, { shipPhoneKey: { in: ["9876543210", "9123456789"] } },
  ]);
  assert.deepEqual(identityMatches(identityOf({ id: "u2", email: null, phone: null })), [{ userId: "u2" }]);
});
