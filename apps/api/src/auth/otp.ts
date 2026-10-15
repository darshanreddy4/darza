import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60_000;
// Gap before another code can be requested. Overridable so end-to-end tests do not have to wait.
export const OTP_RESEND_MS = Number(process.env.OTP_RESEND_SECONDS ?? 30) * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;

export const newOtp = () => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

// Only this hash is stored. Tying it to the phone number and the server secret stops a stolen row being replayed elsewhere.
export const hashOtp = (phone: string, code: string, secret: string) => createHash("sha256").update(`${phone}:${code}:${secret}`).digest("hex");

export function otpMatches(phone: string, code: string, secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(phone, code, secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type OtpCheck = "ok" | "expired" | "locked" | "wrong";

export function checkOtp(row: { expiresAt: Date; attempts: number; consumedAt: Date | null }, correct: boolean, now = new Date()): OtpCheck {
  if (row.consumedAt || row.expiresAt <= now) return "expired";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  return correct ? "ok" : "wrong";
}
