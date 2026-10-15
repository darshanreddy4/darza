import { API_URL } from "@/lib/api";

// True when a Google AdSense widget with an ad connected is switched on, so notices can say so.
export async function adsEnabled(): Promise<boolean> {
  const data: { widgets: { type: string; config: { publisherId?: string } }[] } | null = await fetch(`${API_URL}/home`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return !!data?.widgets.some((w) => w.type === "adsense" && w.config.publisherId);
}
