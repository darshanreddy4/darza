import { randomBytes } from "node:crypto";

export interface MailAttachment { filename: string; contentType: string; content: string | Buffer }

export interface RawEmail { from: string; to: string; subject: string; text: string; html: string; attachments: MailAttachment[] }

const wrap = (b64: string) => b64.replace(/(.{76})/g, "$1\r\n");
const b64 = (data: string | Buffer) => wrap(Buffer.from(data).toString("base64"));
// Header text with non-ASCII characters (the rupee sign, accents) must be encoded.
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);
const safeName = (s: string) => s.replace(/[^\w.\- ]/g, "_");

// SES only accepts attachments in a complete MIME message, so the message is built here.
export function buildRawEmail(m: RawEmail): string {
  const mixed = `mixed_${randomBytes(12).toString("hex")}`;
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const lines = [
    `From: ${m.from}`, `To: ${m.to}`, `Subject: ${encodeHeader(m.subject)}`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${mixed}"`, "",
    `--${mixed}`, `Content-Type: multipart/alternative; boundary="${alt}"`, "",
    `--${alt}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.text),
    `--${alt}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(m.html),
    `--${alt}--`,
  ];
  for (const a of m.attachments) {
    const name = safeName(a.filename);
    lines.push(`--${mixed}`, `Content-Type: ${a.contentType}; name="${name}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${name}"`, "", b64(a.content));
  }
  lines.push(`--${mixed}--`, "");
  return lines.join("\r\n");
}
