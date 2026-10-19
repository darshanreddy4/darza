import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeProfile, whatsappDigits, type SiteProfileData } from "./profile";

const ok = (input: unknown): SiteProfileData => {
  const r = sanitizeProfile(input);
  if ("errors" in r) assert.fail(r.errors.join("; "));
  return r.profile;
};
const errors = (input: unknown) => {
  const r = sanitizeProfile(input);
  assert.ok("errors" in r, "expected errors");
  return r.errors.join("; ");
};

test("an empty profile is valid and everything is blank", () => {
  const p = ok({});
  assert.equal(p.brandName, "");
  assert.deepEqual([p.socials, p.otherLinks, p.whatsappButton], [{}, [], false]);
});

test("text is trimmed and cut to length", () => {
  const p = ok({ brandName: "  DMG  ", about: "x".repeat(9000) });
  assert.equal(p.brandName, "DMG");
  assert.equal(p.about.length, 4000);
});

test("the logo must be an upload or an https address", () => {
  assert.match(errors({ logoUrl: "http://x.test/logo.png" }), /logo/);
  assert.match(errors({ logoUrl: "javascript:alert(1)" }), /logo/);
  assert.equal(ok({ logoUrl: "/uploads/abc.png" }).logoUrl, "/uploads/abc.png");
});

test("email and phone are checked", () => {
  assert.match(errors({ email: "not-an-email" }), /email/);
  assert.match(errors({ phone: "call me" }), /phone/);
  const p = ok({ email: "care@dmg.in", phone: "+91 98765-43210" });
  assert.deepEqual([p.email, p.phone], ["care@dmg.in", "+91 98765-43210"]);
});

test("WhatsApp keeps digits only and needs a country code length", () => {
  assert.equal(whatsappDigits("+91 (98765) 43210"), "919876543210");
  assert.equal(ok({ whatsapp: "+91 98765 43210" }).whatsapp, "919876543210");
  assert.match(errors({ whatsapp: "12345" }), /country code/);
});

test("the floating WhatsApp button needs a number", () => {
  assert.equal(ok({ whatsappButton: true }).whatsappButton, false);
  assert.equal(ok({ whatsapp: "919876543210", whatsappButton: true }).whatsappButton, true);
});

test("social handles become links and full links must be https", () => {
  const p = ok({ socials: { instagram: "@dmg.in", x: "dmg", youtube: "https://youtube.com/@dmg", linkedin: "https://linkedin.com/company/dmg" } });
  assert.deepEqual(p.socials, {
    instagram: "https://instagram.com/dmg.in",
    x: "https://x.com/dmg",
    youtube: "https://youtube.com/@dmg",
    linkedin: "https://linkedin.com/company/dmg",
  });
  assert.match(errors({ socials: { instagram: "http://instagram.com/dmg" } }), /instagram/);
  assert.match(errors({ socials: { linkedin: "dmg" } }), /linkedin/);
  assert.match(errors({ socials: { facebook: "javascript:alert(1)" } }), /facebook/);
});

test("unknown platforms and blank entries are ignored", () => {
  const p = ok({ socials: { myspace: "https://myspace.com/x", instagram: "   " } });
  assert.deepEqual(p.socials, {});
});

test("other links need a name and an https address, and at most six are kept", () => {
  assert.match(errors({ otherLinks: [{ label: "Blog", url: "http://blog.test" }] }), /Blog/);
  assert.match(errors({ otherLinks: [{ label: "", url: "https://blog.test" }] }), /name/);
  const many = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: `https://x.test/${i}` }));
  assert.equal(ok({ otherLinks: [...many, { label: "", url: "" }] }).otherLinks.length, 6);
});

test("the website address is reduced to its origin and must be https", () => {
  assert.equal(ok({ siteUrl: "https://www.acme.in/some/page?x=1" }).siteUrl, "https://www.acme.in");
  assert.equal(ok({ siteUrl: "acme.in" }).siteUrl, "https://acme.in");
  assert.equal(ok({ siteUrl: "http://localhost:3000/" }).siteUrl, "http://localhost:3000");
  assert.equal(ok({ siteUrl: "" }).siteUrl, "");
  assert.match(errors({ siteUrl: "http://acme.in" }), /website address/);
  assert.match(errors({ siteUrl: "javascript:alert(1)" }), /website address/);
});

test("legal details are checked and the footer messages default to on", () => {
  const p = ok({ legalName: " Acme Pvt Ltd ", gstin: "29abcde1234f1z5", grievanceOfficer: "A. Rao", grievanceEmail: "grievance@acme.test" });
  assert.deepEqual([p.legalName, p.gstin, p.grievanceOfficer, p.grievanceEmail], ["Acme Pvt Ltd", "29ABCDE1234F1Z5", "A. Rao", "grievance@acme.test"]);
  assert.deepEqual([p.announcementOn, p.transparencyOn, p.announcement, p.transparencyNote], [true, true, "", ""]);
  assert.match(errors({ gstin: "12345" }), /GSTIN/);
  assert.match(errors({ grievanceEmail: "nope" }), /grievance/);
});

test("the top bar message and footer note can be rewritten or switched off", () => {
  const p = ok({ announcement: "Free delivery this week", announcementOn: false, transparencyNote: "x".repeat(900), transparencyOn: false });
  assert.deepEqual([p.announcement, p.announcementOn, p.transparencyOn], ["Free delivery this week", false, false]);
  assert.equal(p.transparencyNote.length, 600);
});
