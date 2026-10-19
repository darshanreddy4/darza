import assert from "node:assert/strict";
import test from "node:test";
import { maskEmail, maskPhone, reviewerName } from "./reviewer-name";

test("a review shows the name the customer gave", () => {
  assert.equal(reviewerName({ name: "  Asha   Kulkarni ", email: "a@b.in", phone: null }), "Asha Kulkarni");
  assert.equal(reviewerName({ name: "x".repeat(80), email: null, phone: null }).length, 40);
});

test("without a name, half of the phone number is shown and half hidden", () => {
  assert.equal(maskPhone("9856123456"), "98561*****");
  assert.equal(maskPhone("+919856123456"), "98561*****");
  assert.equal(reviewerName({ name: "", email: null, phone: "+919856123456" }), "98561*****");
  assert.equal(reviewerName({ name: "   ", email: "x@y.in", phone: "9856123456" }), "98561*****");
});

test("without a name or phone, half of the email is shown and the domain stays", () => {
  assert.equal(maskEmail("rahulsharma@gmail.com"), "rahul******@gmail.com");
  assert.equal(maskEmail("ab@x.in"), "a*@x.in");
  assert.equal(reviewerName({ name: "", email: "rahulsharma@gmail.com", phone: null }), "rahul******@gmail.com");
});

test("a name that is just the email or phone number counts as no name", () => {
  assert.equal(reviewerName({ name: "rahulsharma@gmail.com", email: "rahulsharma@gmail.com", phone: null }), "rahul******@gmail.com");
  assert.equal(reviewerName({ name: "9856123456", email: null, phone: "9856123456" }), "98561*****");
  assert.equal(reviewerName({ name: "+91 98561 23456", email: null, phone: "9856123456" }), "98561*****");
});

test("an account with nothing at all is a plain customer", () => {
  assert.equal(reviewerName({ name: null, email: null, phone: null }), "Customer");
});
