import { API_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

// The ads.txt file Google looks for, listing every AdSense account used on the home page.
export async function GET() {
  const data: { widgets: { type: string; config: { publisherId?: string } }[] } | null = await fetch(`${API_URL}/home`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  const ids = [...new Set((data?.widgets ?? []).filter((w) => w.type === "adsense").map((w) => w.config.publisherId ?? "").filter((id) => /^ca-pub-\d+$/.test(id)))];
  if (ids.length === 0) return new Response("Not found", { status: 404 });

  const body = ids.map((id) => `google.com, ${id.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`).join("\n") + "\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
