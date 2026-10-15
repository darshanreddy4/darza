export interface GoogleProfile { sub: string; email: string; name: string; picture?: string }

type Fetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

// Asks Google to check the ID token's signature, then makes sure it was issued for this site and is current.
export async function verifyGoogleIdToken(idToken: string, clientId: string, fetcher: Fetcher = fetch as Fetcher, now = Date.now()): Promise<GoogleProfile | null> {
  if (!idToken || idToken.length > 4096 || !clientId) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const res = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, { signal: abort.signal });
    if (!res.ok) return null;
    const t = (await res.json()) as Record<string, string | undefined>;
    const issuerOk = t.iss === "accounts.google.com" || t.iss === "https://accounts.google.com";
    const fresh = Number(t.exp) * 1000 > now;
    if (t.aud !== clientId || !issuerOk || !fresh || !t.sub || !t.email || String(t.email_verified) !== "true") return null;
    return { sub: t.sub, email: t.email.toLowerCase(), name: (t.name || t.email.split("@")[0]).slice(0, 100), picture: t.picture };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
