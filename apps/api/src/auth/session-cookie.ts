import type { CookieOptions, Request, Response } from "express";

export const SESSION_COOKIE = "dmg_session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const base = (): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  domain: process.env.COOKIE_DOMAIN || undefined,
});

export const setSessionCookie = (res: Response, token: string) => res.cookie(SESSION_COOKIE, token, { ...base(), maxAge: SESSION_MAX_AGE_MS });
export const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE, base());

export function readSessionCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export const webOrigins = () => (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim());

// Cookies are attached automatically by browsers, so state-changing requests must come from our own site.
export function isTrustedOrigin(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  let origin = req.headers.origin;
  // A malformed Referer header is treated as an untrusted origin instead of crashing the request.
  if (!origin && req.headers.referer) { try { origin = new URL(req.headers.referer).origin; } catch { return false; } }
  return !origin || webOrigins().includes(origin);
}
