import { createHmac, timingSafeEqual } from "node:crypto";

const sign = (userId: string, secret: string) => createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("base64url").slice(0, 32);

// A link in an email can opt its recipient out without logging in, so it must not be guessable.
export function unsubscribeToken(userId: string, secret = process.env.JWT_SECRET ?? ""): string {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId, secret)}`;
}

export function userFromUnsubscribeToken(token: string, secret = process.env.JWT_SECRET ?? ""): string | null {
  const [id, mac, extra] = token.split(".");
  if (!id || !mac || extra !== undefined) return null;
  const userId = Buffer.from(id, "base64url").toString();
  const expected = Buffer.from(sign(userId, secret));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}
