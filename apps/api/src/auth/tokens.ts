import { createHash, randomBytes } from "node:crypto";

// The raw token only travels by email; the database keeps its SHA-256 hash.
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
