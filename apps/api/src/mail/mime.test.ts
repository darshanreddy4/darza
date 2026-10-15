import test from "node:test";
import assert from "node:assert/strict";
import { buildRawEmail } from "./mime";

const base = { from: "shop@example.com", to: "owner@example.com", subject: "Weekly report", text: "Hello ₹100", html: "<p>Hello</p>", attachments: [{ filename: "report 1.csv", contentType: "text/csv; charset=utf-8", content: "a,b\r\n1,2\r\n" }] };

test("the message has text, html and the attachment in separate parts", () => {
  const raw = buildRawEmail(base);
  assert.match(raw, /Content-Type: multipart\/mixed; boundary="mixed_/);
  assert.match(raw, /Content-Type: multipart\/alternative/);
  assert.match(raw, /Content-Type: text\/plain; charset="UTF-8"/);
  assert.match(raw, /Content-Type: text\/html; charset="UTF-8"/);
  assert.match(raw, /Content-Disposition: attachment; filename="report 1.csv"/);
  assert.ok(raw.includes(Buffer.from("a,b\r\n1,2\r\n").toString("base64")));
  assert.ok(raw.includes(Buffer.from("Hello ₹100").toString("base64")));
});

test("a subject with non-ASCII characters is encoded, plain ones are left alone", () => {
  assert.match(buildRawEmail(base), /^Subject: Weekly report$/m);
  const encoded = buildRawEmail({ ...base, subject: "Sales ₹ report" });
  assert.match(encoded, /^Subject: =\?UTF-8\?B\?/m);
});

test("unsafe characters in a file name cannot break out of the header", () => {
  const raw = buildRawEmail({ ...base, attachments: [{ ...base.attachments[0], filename: 'x"\r\nBcc: evil@example.com.csv' }] });
  assert.ok(!raw.includes("Bcc: evil"));
});

test("long content is wrapped so no line is over 76 characters", () => {
  const raw = buildRawEmail({ ...base, attachments: [{ ...base.attachments[0], content: "x".repeat(5000) }] });
  const body = raw.split("\r\n").filter((l) => /^[A-Za-z0-9+/=]{60,}$/.test(l));
  assert.ok(body.length > 5 && body.every((l) => l.length <= 76));
});
