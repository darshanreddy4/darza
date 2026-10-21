import assert from "node:assert/strict";
import test from "node:test";
import { onlineChargePaise, splitRefund } from "./payment";
import { payoutAmount, payoutDue } from "./returns";

test("an online payment covers the advance for a part-paid order and everything otherwise", () => {
  assert.equal(onlineChargePaise({ advancePaise: 30000, totalPaise: 100000 }), 30000);
  assert.equal(onlineChargePaise({ advancePaise: 0, totalPaise: 100000 }), 100000);
});

test("a refund goes back online up to what was paid online and the rest is paid out by UPI", () => {
  assert.deepEqual(splitRefund(20000, 30000), { onlinePaise: 20000, payoutPaise: 0 });
  assert.deepEqual(splitRefund(100000, 30000), { onlinePaise: 30000, payoutPaise: 70000 });
  assert.deepEqual(splitRefund(50000, 0), { onlinePaise: 0, payoutPaise: 50000 });
  assert.deepEqual(splitRefund(50000, -10), { onlinePaise: 0, payoutPaise: 50000 });
});

test("a payout is due for what the online payment could not cover, until it is marked paid", () => {
  const r = { status: "REFUNDED", refundPaise: 100000, payoutPaise: 70000 as number | null, paidOutAt: null as Date | null };
  assert.equal(payoutAmount(r, "ONLINE"), 70000);
  assert.equal(payoutDue(r, "ONLINE"), true);
  assert.equal(payoutDue({ ...r, paidOutAt: new Date() }, "ONLINE"), false);
  assert.equal(payoutDue({ ...r, payoutPaise: 0 }, "ONLINE"), false);
  assert.equal(payoutDue({ ...r, status: "APPROVED" }, "ONLINE"), false);
});

test("requests made before part payment existed pay out all of a cash refund and nothing for an online one", () => {
  const old = { status: "REFUNDED", refundPaise: 50000, paidOutAt: null as Date | null };
  assert.equal(payoutAmount(old, "COD"), 50000);
  assert.equal(payoutDue(old, "ONLINE"), false);
});
